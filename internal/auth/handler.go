package auth

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 认证相关的 HTTP handler。
type Handler struct {
	svc Service
}

// NewHandler 创建认证 Handler。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// registerRequest 注册请求参数。
type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=72"`
}

// loginRequest 登录请求参数。
type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// refreshRequest 刷新 Token 请求参数。
type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// userResponse 用户信息响应，不包含密码。
type userResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Role     string `json:"role"`
}

// Register POST /api/v1/auth/register — 用户注册。
func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	user, err := h.svc.Register(req.Email, req.Username, req.Password)
	if err != nil {
		if errors.Is(err, ErrUserExists) {
			response.Error(c, http.StatusConflict, response.CodeUserExists, "email already registered")
			return
		}
		if errors.Is(err, ErrUsernameExists) {
			response.Error(c, http.StatusConflict, response.CodeUsernameExists, "username already taken")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "failed to create user")
		return
	}

	response.Created(c, userResponse{
		ID: user.ID, Email: user.Email, Username: user.Username, Role: user.Role,
	})
}

// Login POST /api/v1/auth/login — 用户登录。
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	tokens, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCreds) {
			response.Error(c, http.StatusUnauthorized, response.CodeInvalidCreds, "invalid email or password")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "login failed")
		return
	}

	response.Success(c, tokens)
}

// Refresh POST /api/v1/auth/refresh — 用 refresh token 换取新的 token 对。
func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	tokens, err := h.svc.Refresh(req.RefreshToken)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, response.CodeInvalidCreds, "invalid or expired refresh token")
		return
	}

	response.Success(c, tokens)
}

// Me GET /api/v1/auth/me — 获取当前用户信息。需要 JWT 认证。
func (h *Handler) Me(c *gin.Context) {
	userID := c.GetString("userID")
	user, err := h.svc.GetByID(userID)
	if err != nil {
		response.Error(c, http.StatusNotFound, response.CodeUserNotFound, "user not found")
		return
	}

	response.Success(c, userResponse{
		ID: user.ID, Email: user.Email, Username: user.Username,
		Nickname: user.Nickname, Avatar: user.Avatar, Role: user.Role,
	})
}

// ListUsers GET /api/v1/users — 返回所有用户列表，供成员选择器使用。仅管理员可访问。
func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.svc.ListUsers()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "failed to list users")
		return
	}

	list := make([]userResponse, 0, len(users))
	for _, u := range users {
		list = append(list, userResponse{
			ID: u.ID, Email: u.Email, Username: u.Username,
			Nickname: u.Nickname, Avatar: u.Avatar, Role: u.Role,
		})
	}

	response.Success(c, list)
}

// updateProfileReq 更新用户资料的请求体。
type updateProfileReq struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

// UpdateProfile PUT /api/v1/auth/profile — 更新当前用户的昵称和头像。
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")

	var req updateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	user, err := h.svc.UpdateProfile(userID, req.Nickname, req.Avatar)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "update profile failed")
		return
	}

	response.Success(c, userResponse{
		ID: user.ID, Email: user.Email, Username: user.Username,
		Nickname: user.Nickname, Avatar: user.Avatar, Role: user.Role,
	})
}

// UploadAvatar POST /api/v1/auth/avatar — 上传头像文件到 frontend/resource/avatar/。
func (h *Handler) UploadAvatar(c *gin.Context) {
	userID := c.GetString("userID")

	file, err := c.FormFile("avatar")
	if err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, "avatar file required")
		return
	}

	// validate file size (max 2MB)
	if file.Size > 2*1024*1024 {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, "file too large, max 2MB")
		return
	}

	// validate extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, "only jpg/png/gif/webp allowed")
		return
	}

	// save to frontend/resource/avatar/{userID}{ext}
	avatarDir := filepath.Join("frontend", "resource", "avatar")
	_ = os.MkdirAll(avatarDir, 0o755)

	filename := fmt.Sprintf("%s%s", userID, ext)
	savePath := filepath.Join(avatarDir, filename)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "save file failed")
		return
	}

	// update user avatar path in DB
	avatarURL := "/avatars/" + filename
	user, err := h.svc.UpdateProfile(userID, "", avatarURL)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "update avatar failed")
		return
	}

	response.Success(c, userResponse{
		ID: user.ID, Email: user.Email, Username: user.Username,
		Nickname: user.Nickname, Avatar: user.Avatar, Role: user.Role,
	})
}

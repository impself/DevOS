package project

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 处理项目相关的 HTTP 请求，将请求参数校验后委托给 Service。
type Handler struct {
	svc Service
}

// NewHandler 创建并返回一个 Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// createProjectReq 创建项目的请求体。
type createProjectReq struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description" binding:"max=1000"`
}

// updateProjectReq 更新项目的请求体。
type updateProjectReq struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description" binding:"max=1000"`
}

// addMemberReq 添加项目成员的请求体，通过 username 而非 UUID 标识用户。
type addMemberReq struct {
	Username string `json:"username" binding:"required"`
	Role     string `json:"role" binding:"required,oneof=owner admin developer viewer"`
}

// updateMemberRoleReq 修改成员角色的请求体。
type updateMemberRoleReq struct {
	Role string `json:"role" binding:"required,oneof=owner admin developer viewer"`
}

// Create 处理 POST /projects，创建一个新项目。
func (h *Handler) Create(c *gin.Context) {
	var req createProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	userID := c.GetString("userID")
	p, err := h.svc.Create(req.Name, req.Description, userID)
	if err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "only admin can create projects")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "create project failed")
		return
	}

	response.Created(c, p)
}

// Get 处理 GET /projects/:id，查询单个项目详情。
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	p, err := h.svc.GetByID(id, userID)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeProjectNotFound, "project not found")
			return
		}
		response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		return
	}

	response.Success(c, p)
}

// List 处理 GET /projects，分页查询当前用户的项目列表。
func (h *Handler) List(c *gin.Context) {
	userID := c.GetString("userID")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	projects, total, err := h.svc.List(userID, page, pageSize)
	if err != nil {
		log.Printf("list projects error: %v", err)
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "list projects failed")
		return
	}

	response.SuccessWithPagination(c, projects, page, pageSize, total)
}

// Update 处理 PUT /projects/:id，更新项目信息。
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	var req updateProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	p, err := h.svc.Update(id, userID, req.Name, req.Description)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeProjectNotFound, "project not found")
			return
		}
		response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		return
	}

	response.Success(c, p)
}

// Delete 处理 DELETE /projects/:id，删除项目（仅 owner 可操作）。
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	if err := h.svc.Delete(id, userID); err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeProjectNotFound, "project not found")
			return
		}
		response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		return
	}

	response.OK(c)
}

// AddMember 处理 POST /projects/:id/members，添加项目成员。
func (h *Handler) AddMember(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req addMemberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	if err := h.svc.AddMember(projectID, userID, req.Username, req.Role); err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			response.Error(c, http.StatusNotFound, response.CodeProjectNotFound, "project not found")
		case errors.Is(err, ErrUserNotFound):
			response.Error(c, http.StatusNotFound, response.CodeUserNotFound, "user not found")
		case errors.Is(err, ErrAlreadyMember):
			response.Error(c, http.StatusConflict, response.CodeAlreadyMember, "user is already a member")
		default:
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		}
		return
	}

	response.OK(c)
}

// RemoveMember 处理 DELETE /projects/:id/members/:memberID，移除项目成员。
func (h *Handler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	memberID := c.Param("memberID")
	userID := c.GetString("userID")

	if err := h.svc.RemoveMember(projectID, userID, memberID); err != nil {
		response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		return
	}

	response.OK(c)
}

// ListMembers 处理 GET /projects/:id/members，查询项目成员列表。
func (h *Handler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	members, err := h.svc.ListMembers(projectID, userID)
	if err != nil {
		response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		return
	}

	response.Success(c, members)
}

// UpdateMemberRole 处理 PUT /projects/:id/members/:memberID/role，修改成员角色。
func (h *Handler) UpdateMemberRole(c *gin.Context) {
	projectID := c.Param("id")
	memberUserID := c.Param("memberID")
	operatorID := c.GetString("userID")

	var req updateMemberRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	if err := h.svc.UpdateMemberRole(projectID, operatorID, memberUserID, req.Role); err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			response.Error(c, http.StatusNotFound, response.CodeProjectNotFound, "project not found")
		case errors.Is(err, ErrNoPermission):
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		default:
			response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "update role failed")
		}
		return
	}

	response.OK(c)
}

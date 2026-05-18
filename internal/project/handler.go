package project

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
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

// addMemberReq 添加项目成员的请求体。
type addMemberReq struct {
	UserID string `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required,oneof=owner admin developer viewer"`
}

// Create 处理 POST /projects，创建一个新项目。
func (h *Handler) Create(c *gin.Context) {
	var req createProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	// 从认证中间件注入的上下文中获取当前用户 ID
	userID := c.GetString("userID")
	p, err := h.svc.Create(req.Name, req.Description, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "create project failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success", "data": p})
}

// Get 处理 GET /projects/:id，查询单个项目详情。
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	p, err := h.svc.GetByID(id, userID)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "PROJECT_NOT_FOUND", "message": "project not found"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": p})
}

// List 处理 GET /projects，分页查询当前用户的项目列表。
func (h *Handler) List(c *gin.Context) {
	userID := c.GetString("userID")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	projects, total, err := h.svc.List(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "list projects failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0, "message": "success",
		"data": projects,
		"pagination": gin.H{"page": page, "page_size": pageSize, "total": total},
	})
}

// Update 处理 PUT /projects/:id，更新项目信息。
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	var req updateProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	p, err := h.svc.Update(id, userID, req.Name, req.Description)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "PROJECT_NOT_FOUND", "message": "project not found"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": p})
}

// Delete 处理 DELETE /projects/:id，删除项目（仅 owner 可操作）。
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("userID")

	if err := h.svc.Delete(id, userID); err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "PROJECT_NOT_FOUND", "message": "project not found"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

// AddMember 处理 POST /projects/:id/members，添加项目成员。
func (h *Handler) AddMember(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req addMemberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	if err := h.svc.AddMember(projectID, userID, req.UserID, req.Role); err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			c.JSON(http.StatusNotFound, gin.H{"code": "PROJECT_NOT_FOUND", "message": "project not found"})
		case errors.Is(err, ErrAlreadyMember):
			c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_MEMBER", "message": "user is already a member"})
		default:
			c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

// RemoveMember 处理 DELETE /projects/:id/members/:memberID，移除项目成员。
func (h *Handler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	memberID := c.Param("memberID")
	userID := c.GetString("userID")

	if err := h.svc.RemoveMember(projectID, userID, memberID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

// ListMembers 处理 GET /projects/:id/members，查询项目成员列表。
func (h *Handler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	members, err := h.svc.ListMembers(projectID, userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": members})
}

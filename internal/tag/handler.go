package tag

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 处理标签相关的 HTTP 请求。
type Handler struct {
	svc Service
}

// NewHandler 创建标签 Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// createTagReq 创建标签的请求体。
type createTagReq struct {
	Name  string `json:"name" binding:"required,min=1,max=50"`
	Color string `json:"color"`
}

// updateTagReq 更新标签的请求体，所有字段可选。
type updateTagReq struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

// Create 处理 POST /projects/:id/tags，创建标签。
func (h *Handler) Create(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req createTagReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	t := &Tag{
		ProjectID: projectID,
		Name:      req.Name,
		Color:     req.Color,
	}

	result, err := h.svc.Create(t, userID)
	if err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "create tag failed")
		return
	}

	response.Created(c, result)
}

// List 处理 GET /projects/:id/tags，获取项目标签列表。
func (h *Handler) List(c *gin.Context) {
	projectID := c.Param("id")

	tags, err := h.svc.ListByProject(projectID, "")
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "list tags failed")
		return
	}

	response.Success(c, tags)
}

// Update 处理 PUT /projects/:id/tags/:tagID，更新标签。
func (h *Handler) Update(c *gin.Context) {
	tagID := c.Param("tagID")
	userID := c.GetString("userID")

	var req updateTagReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Color != nil {
		updates["color"] = *req.Color
	}

	result, err := h.svc.Update(tagID, userID, updates)
	if err != nil {
		switch {
		case errors.Is(err, ErrTagNotFound):
			response.Error(c, http.StatusNotFound, response.CodeTagNotFound, "tag not found")
		case errors.Is(err, ErrNoPermission):
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		default:
			response.Error(c, http.StatusBadRequest, response.CodeBadRequest, err.Error())
		}
		return
	}

	response.Success(c, result)
}

// Delete 处理 DELETE /projects/:id/tags/:tagID，删除标签。
func (h *Handler) Delete(c *gin.Context) {
	tagID := c.Param("tagID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(tagID, userID); err != nil {
		switch {
		case errors.Is(err, ErrTagNotFound):
			response.Error(c, http.StatusNotFound, response.CodeTagNotFound, "tag not found")
		case errors.Is(err, ErrNoPermission):
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		default:
			response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "delete tag failed")
		}
		return
	}

	response.OK(c)
}

// setTaskTagsReq 设置任务标签的请求体。
type setTaskTagsReq struct {
	TagIDs []string `json:"tag_ids"`
}

// SetTaskTags 处理 PUT /projects/:id/tasks/:taskID/tags，设置任务的标签（全量替换）。
func (h *Handler) SetTaskTags(c *gin.Context) {
	taskID := c.Param("taskID")

	var req setTaskTagsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	if err := h.svc.SetTaskTags(taskID, req.TagIDs); err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "set task tags failed")
		return
	}

	response.OK(c)
}

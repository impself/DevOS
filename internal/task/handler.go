package task

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler 处理任务相关的 HTTP 请求。
type Handler struct {
	svc Service
}

// NewHandler 创建任务 Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// createTaskReq 创建任务的请求体。
type createTaskReq struct {
	Title       string `json:"title" binding:"required,min=1,max=200"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Priority    string `json:"priority"`
	AssigneeID  string `json:"assignee_id"`
	ParentID    string `json:"parent_id"`
}

// updateTaskReq 更新任务的请求体，所有字段可选。
type updateTaskReq struct {
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Type        *string  `json:"type"`
	Status      *string  `json:"status"`
	Priority    *string  `json:"priority"`
	AssigneeID  *string  `json:"assignee_id"`
	StoryPoints *int     `json:"story_points"`
	DueDate     *string  `json:"due_date"`
	SortOrder   *float64 `json:"sort_order"`
}

// Create 处理 POST /projects/:id/tasks，创建任务。
func (h *Handler) Create(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req createTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	t := &Task{
		ProjectID:   projectID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Priority:    req.Priority,
		CreatedBy:   userID,
	}
	if req.AssigneeID != "" {
		t.AssigneeID = &req.AssigneeID
	}
	if req.ParentID != "" {
		t.ParentID = &req.ParentID
	}

	result, err := h.svc.Create(t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "create task failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success", "data": result})
}

// Get 处理 GET /projects/:id/tasks/:taskID，查询单个任务。
func (h *Handler) Get(c *gin.Context) {
	taskID := c.Param("taskID")
	userID := c.GetString("userID")

	t, err := h.svc.GetByID(taskID, userID)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "TASK_NOT_FOUND", "message": "task not found"})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": t})
}

// Update 处理 PUT /projects/:id/tasks/:taskID，更新任务。
func (h *Handler) Update(c *gin.Context) {
	taskID := c.Param("taskID")
	userID := c.GetString("userID")

	var req updateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.AssigneeID != nil {
		updates["assignee_id"] = *req.AssigneeID
	}
	if req.StoryPoints != nil {
		updates["story_points"] = float64(*req.StoryPoints)
	}
	if req.DueDate != nil {
		updates["due_date"] = *req.DueDate
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	result, err := h.svc.Update(taskID, userID, updates)
	if err != nil {
		switch {
		case errors.Is(err, ErrTaskNotFound):
			c.JSON(http.StatusNotFound, gin.H{"code": "TASK_NOT_FOUND", "message": "task not found"})
		case errors.Is(err, ErrNoPermission):
			c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": result})
}

// Delete 处理 DELETE /projects/:id/tasks/:taskID，删除任务。
func (h *Handler) Delete(c *gin.Context) {
	taskID := c.Param("taskID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(taskID, userID); err != nil {
		switch {
		case errors.Is(err, ErrTaskNotFound):
			c.JSON(http.StatusNotFound, gin.H{"code": "TASK_NOT_FOUND", "message": "task not found"})
		case errors.Is(err, ErrNoPermission):
			c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "delete task failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

// List 处理 GET /projects/:id/tasks，查询任务列表。
func (h *Handler) List(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := ListFilters{
		Status:   c.Query("status"),
		Priority: c.Query("priority"),
		Type:     c.Query("type"),
		Assignee: c.Query("assignee"),
		SprintID: c.Query("sprint_id"),
		ParentID: c.Query("parent_id"),
		Search:   c.Query("search"),
		Page:     page,
		PageSize: pageSize,
	}

	tasks, total, err := h.svc.List(projectID, userID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "list tasks failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0, "message": "success",
		"data": tasks,
		"pagination": gin.H{"page": page, "page_size": pageSize, "total": total},
	})
}

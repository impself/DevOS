package sprint

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 处理 Sprint 相关的 HTTP 请求。
type Handler struct {
	svc Service
}

// NewHandler 创建 Sprint Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// createSprintReq 创建 Sprint 的请求体。
type createSprintReq struct {
	Name      string `json:"name" binding:"required,min=1,max=100"`
	Goal      string `json:"goal"`
	StartDate string `json:"start_date" binding:"required"`
	EndDate   string `json:"end_date" binding:"required"`
}

// updateSprintReq 更新 Sprint 的请求体，所有字段可选。
type updateSprintReq struct {
	Name      *string `json:"name"`
	Goal      *string `json:"goal"`
	Status    *string `json:"status"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

// Create 处理 POST /projects/:id/sprints，创建 Sprint。
func (h *Handler) Create(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req createSprintReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	startDate, err := parseDateStr(req.StartDate)
	if err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, "invalid start_date format")
		return
	}
	endDate, err := parseDateStr(req.EndDate)
	if err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, "invalid end_date format")
		return
	}

	sprint := &Sprint{
		ProjectID: projectID,
		Name:      req.Name,
		Goal:      req.Goal,
		Status:    "planning",
		StartDate: startDate,
		EndDate:   endDate,
	}

	result, err := h.svc.Create(sprint, userID)
	if err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
			return
		}
		if errors.Is(err, ErrInvalidDateRange) {
			response.Error(c, http.StatusBadRequest, response.CodeValidationError, "end_date must be after start_date")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "create sprint failed")
		return
	}

	response.Created(c, result)
}

// List 处理 GET /projects/:id/sprints，获取项目 Sprint 列表。
func (h *Handler) List(c *gin.Context) {
	projectID := c.Param("id")

	sprints, taskCounts, err := h.svc.ListByProject(projectID, "")
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "list sprints failed")
		return
	}

	response.Success(c, gin.H{"sprints": sprints, "task_counts": taskCounts})
}

// Update 处理 PUT /projects/:id/sprints/:sprintID，更新 Sprint。
func (h *Handler) Update(c *gin.Context) {
	sprintID := c.Param("sprintID")
	userID := c.GetString("userID")

	var req updateSprintReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Goal != nil {
		updates["goal"] = *req.Goal
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.StartDate != nil {
		updates["start_date"] = *req.StartDate
	}
	if req.EndDate != nil {
		updates["end_date"] = *req.EndDate
	}

	result, err := h.svc.Update(sprintID, userID, updates)
	if err != nil {
		switch {
		case errors.Is(err, ErrSprintNotFound):
			response.Error(c, http.StatusNotFound, response.CodeSprintNotFound, "sprint not found")
		case errors.Is(err, ErrNoPermission):
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		case errors.Is(err, ErrInvalidStatus):
			response.Error(c, http.StatusBadRequest, response.CodeValidationError, "invalid status")
		case errors.Is(err, ErrActiveSprintExists):
			response.Error(c, http.StatusConflict, response.CodeSprintNotFound, "project already has an active sprint")
		case errors.Is(err, ErrInvalidDateRange):
			response.Error(c, http.StatusBadRequest, response.CodeValidationError, "end_date must be after start_date")
		default:
			response.Error(c, http.StatusBadRequest, response.CodeBadRequest, err.Error())
		}
		return
	}

	response.Success(c, result)
}

// Delete 处理 DELETE /projects/:id/sprints/:sprintID，删除 Sprint。
func (h *Handler) Delete(c *gin.Context) {
	sprintID := c.Param("sprintID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(sprintID, userID); err != nil {
		switch {
		case errors.Is(err, ErrSprintNotFound):
			response.Error(c, http.StatusNotFound, response.CodeSprintNotFound, "sprint not found")
		case errors.Is(err, ErrNoPermission):
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
		default:
			response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "delete sprint failed")
		}
		return
	}

	response.OK(c)
}

package comment

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 处理评论相关的 HTTP 请求。
type Handler struct {
	svc Service
}

// NewHandler 创建评论 Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// createCommentReq 创建评论的请求体。
type createCommentReq struct {
	Content string `json:"content" binding:"required,min=1"`
}

// Create 处理 POST /tasks/:taskID/comments，创建评论。
func (h *Handler) Create(c *gin.Context) {
	taskID := c.Param("taskID")
	userID := c.GetString("userID")

	var req createCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	comment, err := h.svc.Create(taskID, userID, req.Content)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "create comment failed")
		return
	}

	response.Created(c, comment)
}

// List 处理 GET /tasks/:taskID/comments，查询评论列表。
func (h *Handler) List(c *gin.Context) {
	taskID := c.Param("taskID")

	comments, err := h.svc.List(taskID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "list comments failed")
		return
	}

	response.Success(c, comments)
}

// Delete 处理 DELETE /tasks/:taskID/comments/:commentID，删除评论。
func (h *Handler) Delete(c *gin.Context) {
	commentID := c.Param("commentID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(commentID, userID); err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, "no permission")
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "delete comment failed")
		return
	}

	response.OK(c)
}

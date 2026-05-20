package comment

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

var ErrNoPermission = errors.New("no permission")

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
		c.JSON(http.StatusBadRequest, gin.H{"code": "VALIDATION_ERROR", "message": err.Error()})
		return
	}

	comment, err := h.svc.Create(taskID, userID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "create comment failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success", "data": comment})
}

// List 处理 GET /tasks/:taskID/comments，查询评论列表。
func (h *Handler) List(c *gin.Context) {
	taskID := c.Param("taskID")

	comments, err := h.svc.List(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "list comments failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": comments})
}

// Delete 处理 DELETE /tasks/:taskID/comments/:commentID，删除评论。
func (h *Handler) Delete(c *gin.Context) {
	commentID := c.Param("commentID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(commentID, userID); err != nil {
		if errors.Is(err, ErrNoPermission) {
			c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no permission"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "delete comment failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

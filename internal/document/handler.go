package document

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/response"
)

// Handler 文档 HTTP 处理器。
type Handler struct {
	svc Service
}

// NewHandler 创建文档 Handler 实例。
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

type createDocReq struct {
	Title   string          `json:"title" binding:"required,min=1,max=200"`
	Content json.RawMessage `json:"content"`
}

type updateDocReq struct {
	Title   *string         `json:"title"`
	Content json.RawMessage `json:"content"`
}

// Create 创建文档。
func (h *Handler) Create(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")

	var req createDocReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	doc, err := h.svc.Create(projectID, userID, req.Title, req.Content)
	if err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "create document failed")
		return
	}

	response.Created(c, doc)
}

// List 获取项目文档列表。
func (h *Handler) List(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.GetString("userID")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	docs, total, err := h.svc.List(projectID, userID, search, page, pageSize)
	if err != nil {
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "list documents failed")
		return
	}

	response.SuccessWithPagination(c, docs, page, pageSize, total)
}

// Get 获取单个文档（含完整 content）。
func (h *Handler) Get(c *gin.Context) {
	projectID := c.Param("id")
	docID := c.Param("docID")
	userID := c.GetString("userID")

	doc, err := h.svc.Get(projectID, docID, userID)
	if err != nil {
		if errors.Is(err, ErrDocumentNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeDocumentNotFound, err.Error())
			return
		}
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "get document failed")
		return
	}

	response.Success(c, doc)
}

// Update 更新文档标题或内容。
func (h *Handler) Update(c *gin.Context) {
	projectID := c.Param("id")
	docID := c.Param("docID")
	userID := c.GetString("userID")

	var req updateDocReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
		return
	}

	title := ""
	if req.Title != nil {
		title = *req.Title
	}

	var content json.RawMessage
	if len(req.Content) > 0 {
		content = req.Content
	}

	doc, err := h.svc.Update(projectID, docID, userID, title, content)
	if err != nil {
		if errors.Is(err, ErrDocumentNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeDocumentNotFound, err.Error())
			return
		}
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "update document failed")
		return
	}

	response.Success(c, doc)
}

// Delete 删除文档。
func (h *Handler) Delete(c *gin.Context) {
	projectID := c.Param("id")
	docID := c.Param("docID")
	userID := c.GetString("userID")

	if err := h.svc.Delete(projectID, docID, userID); err != nil {
		if errors.Is(err, ErrDocumentNotFound) {
			response.Error(c, http.StatusNotFound, response.CodeDocumentNotFound, err.Error())
			return
		}
		if errors.Is(err, ErrNoPermission) {
			response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "delete document failed")
		return
	}

	response.OK(c)
}

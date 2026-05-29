package collab

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// JWTClaims 与 pkg/middleware/auth.go 中的 Claims 保持一致。
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// AccessChecker 校验用户是否有权限访问指定项目的文档。
type AccessChecker interface {
	CanAccessProject(projectID, userID string) bool
}

// Handler 处理 WebSocket 协同编辑连接。
type Handler struct {
	hub       *Hub
	store     StateStore
	access    AccessChecker
	jwtSecret string
	upgrader  websocket.Upgrader
}

// NewHandler 创建协同编辑 Handler。
func NewHandler(hub *Hub, store StateStore, access AccessChecker, jwtSecret string) *Handler {
	return &Handler{
		hub:    hub,
		store:  store,
		access: access,
		jwtSecret: jwtSecret,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
	}
}

// HandleCollab 处理 WebSocket 升级请求。
// URL: GET /api/v1/projects/:projectID/collab/:docID?token=xxx
func (h *Handler) HandleCollab(c *gin.Context) {
	projectID := c.Param("id")
	docID := c.Param("docID")

	// JWT 认证：从 query param 读取 token（WebSocket 无法设 Authorization header）
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "missing token"})
		return
	}

	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "invalid token"})
		return
	}

	userID := claims.UserID

	// 权限校验
	if !h.access.CanAccessProject(projectID, userID) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "no access"})
		return
	}

	// WebSocket 升级
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := NewClient(h.hub, conn, docID, userID, h.store)
	h.hub.Register(client)

	// 连接成功后，发送服务端存储的 Yjs 状态（如果有的话）
	go h.sendInitialState(client)

	go client.WritePump()
	go client.ReadPump()
}

// sendInitialState 从 DB 加载 Yjs 二进制状态发送给新连接的客户端。
func (h *Handler) sendInitialState(c *Client) {
	state, err := h.store.GetYjsState(c.docID)
	if err != nil {
		// 没有存储的状态（新文档），跳过
		return
	}
	if len(state) == 0 {
		return
	}

	// 用带前缀的消息发送：[MsgSyncState][state bytes]
	msg := make([]byte, 1+len(state))
	msg[0] = MsgSyncState
	copy(msg[1:], state)

	select {
	case c.send <- msg:
	case <-time.After(5 * time.Second):
		// 超时放弃，客户端会从 REST API 加载内容
	}
}

// ParseTokenFromQuery 从 WebSocket URL 的 query param 中解析 JWT token。
func ParseTokenFromQuery(tokenStr, secret string) (userID string, ok bool) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return "", false
	}
	return claims.UserID, true
}

// trimBearer 去掉 "Bearer " 前缀。
func trimBearer(s string) string {
	return strings.TrimPrefix(s, "Bearer ")
}

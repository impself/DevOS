package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/pkg/middleware"
)

// buildRouter 构建 Gin 引擎并注册所有路由。
func buildRouter(h *Handlers, jwtSecret string, mode string) *gin.Engine {
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(1000, time.Minute))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.Static("/avatars", "./frontend/resource/avatar")

	api := r.Group("/api/v1")
	registerPublicRoutes(api, h)
	registerProtectedRoutes(api, h, jwtSecret)

	return r
}

// registerPublicRoutes 公开路由，无需认证。
func registerPublicRoutes(api *gin.RouterGroup, h *Handlers) {
	g := api.Group("/auth")
	g.POST("/register", h.Auth.Register)
	g.POST("/login", h.Auth.Login)
	g.POST("/refresh", h.Auth.Refresh)
}

// registerProtectedRoutes 认证路由，JWT 校验。
func registerProtectedRoutes(api *gin.RouterGroup, h *Handlers, jwtSecret string) {
	authed := api.Group("")
	authed.Use(middleware.Auth(jwtSecret))

	authed.GET("/auth/me", h.Auth.Me)
	authed.PUT("/auth/profile", h.Auth.UpdateProfile)
	authed.POST("/auth/avatar", h.Auth.UploadAvatar)
	authed.GET("/users", h.Auth.ListUsers)

	registerProjectRoutes(authed, h)
}

// registerProjectRoutes 项目相关路由（/projects/:id/*）。
func registerProjectRoutes(authed *gin.RouterGroup, h *Handlers) {
	p := authed.Group("/projects")

	// 项目 CRUD
	p.POST("", h.Project.Create)
	p.GET("", h.Project.List)
	p.GET("/:id", h.Project.Get)
	p.PUT("/:id", h.Project.Update)
	p.DELETE("/:id", h.Project.Delete)

	// 成员管理
	p.POST("/:id/members", h.Project.AddMember)
	p.PUT("/:id/members/:memberID/role", h.Project.UpdateMemberRole)
	p.DELETE("/:id/members/:memberID", h.Project.RemoveMember)
	p.GET("/:id/members", h.Project.ListMembers)

	// 任务 CRUD
	p.POST("/:id/tasks", h.Task.Create)
	p.GET("/:id/tasks", h.Task.List)
	p.GET("/:id/tasks/:taskID", h.Task.Get)
	p.PUT("/:id/tasks/:taskID", h.Task.Update)
	p.DELETE("/:id/tasks/:taskID", h.Task.Delete)

	// 评论
	p.POST("/:id/tasks/:taskID/comments", h.Comment.Create)
	p.GET("/:id/tasks/:taskID/comments", h.Comment.List)
	p.DELETE("/:id/tasks/:taskID/comments/:commentID", h.Comment.Delete)

	// Sprint CRUD
	p.POST("/:id/sprints", h.Sprint.Create)
	p.GET("/:id/sprints", h.Sprint.List)
	p.PUT("/:id/sprints/:sprintID", h.Sprint.Update)
	p.DELETE("/:id/sprints/:sprintID", h.Sprint.Delete)

	// 标签 CRUD
	p.POST("/:id/tags", h.Tag.Create)
	p.GET("/:id/tags", h.Tag.List)
	p.PUT("/:id/tags/:tagID", h.Tag.Update)
	p.DELETE("/:id/tags/:tagID", h.Tag.Delete)
	p.PUT("/:id/tasks/:taskID/tags", h.Tag.SetTaskTags)

	// 文档 CRUD
	p.POST("/:id/documents", h.Doc.Create)
	p.GET("/:id/documents", h.Doc.List)
	p.GET("/:id/documents/:docID", h.Doc.Get)
	p.PUT("/:id/documents/:docID", h.Doc.Update)
	p.DELETE("/:id/documents/:docID", h.Doc.Delete)

	// 协同编辑 WebSocket
	p.GET("/:id/collab/:docID", h.Collab.HandleCollab)
}

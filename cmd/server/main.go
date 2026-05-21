// Package main 是 DevOS 服务器的入口，负责初始化配置、数据库、依赖注入和 HTTP 路由。
// 启动后监听指定端口，支持优雅关闭。
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/impself/DevOS/internal/auth"
	"github.com/impself/DevOS/internal/comment"
	"github.com/impself/DevOS/internal/project"
	"github.com/impself/DevOS/internal/task"
	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/database"
	"github.com/impself/DevOS/pkg/logger"
	"github.com/impself/DevOS/pkg/middleware"
)

func main() {
	// 加载应用配置（环境变量 / 配置文件）
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	// 初始化全局日志，根据运行模式调整日志级别
	logger.Init(cfg.Server.Mode)
	defer logger.L.Sync()

	// 连接 PostgreSQL 和 Redis
	if err := database.InitPostgres(&cfg.Database); err != nil {
		logger.L.Fatalf("init postgres: %v", err)
	}
	if err := database.InitRedis(&cfg.Redis); err != nil {
		logger.L.Fatalf("init redis: %v", err)
	}

	// 自动迁移数据库表结构，开发阶段使用，生产环境应改用 migration 工具
	if err := database.DB.AutoMigrate(&auth.User{}, &project.Project{}, &project.Member{}, &task.Task{}, &comment.Comment{}); err != nil {
		logger.L.Fatalf("auto migrate: %v", err)
	}

	// 依赖注入：逐层构建各模块的 repo -> service -> handler
	authRepo := auth.NewRepository(database.DB)
	authSvc := auth.NewService(authRepo, cfg.JWT)
	authHandler := auth.NewHandler(authSvc)

	projectRepo := project.NewRepository(database.DB)
	projectSvc := project.NewService(projectRepo, authRepo)
	projectHandler := project.NewHandler(projectSvc)

	taskRepo := task.NewRepository(database.DB)
	taskSvc := task.NewService(taskRepo, authRepo, projectRepo)
	taskHandler := task.NewHandler(taskSvc)

	commentRepo := comment.NewRepository(database.DB)
	commentSvc := comment.NewService(commentRepo, authRepo)
	commentHandler := comment.NewHandler(commentSvc)

	// Gin 引擎初始化
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(1000, time.Minute))

	// 健康检查端点，用于负载均衡器和监控探活
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 静态文件：头像访问
	r.Static("/avatars", "./frontend/resource/avatar")

	// API 路由注册
	api := r.Group("/api/v1")
	{
		// 公开路由：注册和登录，无需认证
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
		}

		// 需要认证的路由：通过 JWT 中间件校验 token
		authed := api.Group("")
		authed.Use(middleware.Auth(cfg.JWT.Secret))
		{
			authed.GET("/auth/me", authHandler.Me)
			authed.PUT("/auth/profile", authHandler.UpdateProfile)
			authed.POST("/auth/avatar", authHandler.UploadAvatar)

			// 用户列表，供成员选择器使用
			authed.GET("/users", authHandler.ListUsers)

			// 项目 CRUD + 成员管理
			p := authed.Group("/projects")
			{
				p.POST("", projectHandler.Create)
				p.GET("", projectHandler.List)
				p.GET("/:id", projectHandler.Get)
				p.PUT("/:id", projectHandler.Update)
				p.DELETE("/:id", projectHandler.Delete)

				p.POST("/:id/members", projectHandler.AddMember)
				p.PUT("/:id/members/:memberID/role", projectHandler.UpdateMemberRole)
				p.DELETE("/:id/members/:memberID", projectHandler.RemoveMember)
				p.GET("/:id/members", projectHandler.ListMembers)

				// 任务 CRUD
				p.POST("/:id/tasks", taskHandler.Create)
				p.GET("/:id/tasks", taskHandler.List)
				p.GET("/:id/tasks/:taskID", taskHandler.Get)
				p.PUT("/:id/tasks/:taskID", taskHandler.Update)
				p.DELETE("/:id/tasks/:taskID", taskHandler.Delete)

				// 评论
				p.POST("/:id/tasks/:taskID/comments", commentHandler.Create)
				p.GET("/:id/tasks/:taskID/comments", commentHandler.List)
				p.DELETE("/:id/tasks/:taskID/comments/:commentID", commentHandler.Delete)
			}
		}
	}

	// 启动 HTTP 服务，在独立 goroutine 中运行以便主 goroutine 监听关闭信号
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		logger.L.Infof("server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.L.Fatalf("listen: %v", err)
		}
	}()

	// 优雅关闭：等待 SIGINT / SIGTERM 信号，然后给服务 5 秒时间处理完已有请求
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.L.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.L.Fatalf("server forced shutdown: %v", err)
	}
	logger.L.Info("server exited")
}

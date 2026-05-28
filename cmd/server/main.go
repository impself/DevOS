// Package main 是 DevOS 服务器入口。
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/database"
	"github.com/impself/DevOS/pkg/logger"
)

func main() {
	cfg := mustLoadConfig()
	logger.Init(cfg.Server.Mode)
	defer logger.L.Sync()

	initDatabase(&cfg.Database)
	initRedis(&cfg.Redis)
	autoMigrate()

	h := setupDI(database.DB, cfg.JWT)
	srv := newServer(cfg, h)

	// 启动 HTTP 服务
	go func() {
		logger.L.Infof("server starting on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.L.Fatalf("listen: %v", err)
		}
	}()

	// 优雅关闭
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

// newServer 创建 HTTP 服务并注册路由。
func newServer(cfg *config.Config, h *Handlers) *http.Server {
	r := buildRouter(h, cfg.JWT.Secret, cfg.Server.Mode)
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	return &http.Server{Addr: addr, Handler: r}
}

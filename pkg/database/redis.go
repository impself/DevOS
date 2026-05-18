package database

import (
	"context"
	"fmt"

	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/logger"
	"github.com/redis/go-redis/v9"
)

// RDB 全局 Redis 客户端实例。
var RDB *redis.Client

// InitRedis 初始化 Redis 连接，启动时 Ping 验证连通性。
func InitRedis(cfg *config.RedisConfig) error {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return fmt.Errorf("connect redis: %w", err)
	}

	RDB = rdb
	logger.L.Info("redis connected")
	return nil
}

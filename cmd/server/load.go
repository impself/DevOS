package main

import (
	"log"

	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/database"
	"github.com/impself/DevOS/pkg/logger"
)

// mustLoadConfig 加载配置，失败直接退出。
func mustLoadConfig() *config.Config {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	return cfg
}

// initDatabase 连接 PostgreSQL 和 Redis。
func initDatabase(dbCfg *config.DatabaseConfig) {
	if err := database.InitPostgres(dbCfg); err != nil {
		logger.L.Fatalf("init postgres: %v", err)
	}

}
func initRedis(redisCfg *config.RedisConfig) {
	if err := database.InitRedis(redisCfg); err != nil {
		logger.L.Fatalf("init redis: %v", err)
	}
}

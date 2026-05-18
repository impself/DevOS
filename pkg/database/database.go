// Package database 提供数据库连接初始化。
// 包含 PostgreSQL（通过 GORM）和 Redis 的连接管理。
package database

import (
	"fmt"

	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// DB 全局 GORM 实例，初始化后可直接使用。
var DB *gorm.DB

// InitPostgres 初始化 PostgreSQL 连接。
// 配置连接池参数，启用 Prepared Statement 缓存提升性能。
func InitPostgres(cfg *config.DatabaseConfig) error {
	var logLevel gormlogger.LogLevel
	switch cfg.SSLMode {
	case "release":
		logLevel = gormlogger.Warn
	default:
		logLevel = gormlogger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger:                 gormlogger.Default.LogMode(logLevel),
		SkipDefaultTransaction: true, // 跳过默认事务包装，单个操作性能更好
		PrepareStmt:            true, // 预编译 SQL 缓存，减少解析开销
	})
	if err != nil {
		return fmt.Errorf("connect postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql.DB: %w", err)
	}

	// 连接池配置
	sqlDB.SetMaxOpenConns(25) // 最大打开连接数
	sqlDB.SetMaxIdleConns(10) // 最大空闲连接数

	DB = db
	logger.L.Info("postgres connected")
	return nil
}

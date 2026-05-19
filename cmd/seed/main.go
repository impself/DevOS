// Package main — DevOS 系统管理员种子脚本
// 用法: go run cmd/seed/main.go
// 在数据库中创建默认系统管理员（如不存在），确保至少有一个管理员账户。
package main

import (
	"log"

	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/database"
	"github.com/impself/DevOS/pkg/logger"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	logger.Init("debug")

	if err := database.InitPostgres(&cfg.Database); err != nil {
		log.Fatalf("init postgres: %v", err)
	}

	// 默认系统管理员凭证
	const (
		adminEmail    = "admin@devos.io"
		adminUsername = "admin"
		adminPassword = "admin123"
	)

	// 检查是否已存在
	var count int64
	database.DB.Table("users").Where("role = ?", "admin").Count(&count)
	if count > 0 {
		log.Printf("系统管理员已存在（共 %d 个），跳过创建", count)
		return
	}

	// 生成密码哈希
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}

	// 插入管理员
	result := database.DB.Exec(
		`INSERT INTO users (id, email, username, password, role, created_at, updated_at)
		 VALUES (gen_random_uuid(), ?, ?, ?, 'admin', now(), now())
		 ON CONFLICT (email) DO NOTHING`,
		adminEmail, adminUsername, string(hash),
	)
	if result.Error != nil {
		log.Fatalf("create admin: %v", result.Error)
	}
	if result.RowsAffected > 0 {
		log.Printf("系统管理员创建成功: %s / %s", adminEmail, adminPassword)
	}
}

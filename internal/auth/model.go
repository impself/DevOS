// Package auth 提供用户认证与权限管理。
// 包含用户注册、登录、JWT Token 生成与验证。
package auth

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型，对应 users 表。
// Password 字段 json:"-" 确保不会序列化到 API 响应中。
type User struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email     string         `gorm:"uniqueIndex;not null;size:255" json:"email"`
	Username  string         `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Password  string         `gorm:"not null" json:"-"`
	Nickname  string         `gorm:"size:50" json:"nickname"`
	Avatar    string         `gorm:"size:500" json:"avatar"`
	Role      string         `gorm:"size:20;not null;default:'user'" json:"role"` // user / admin
	Status    string         `gorm:"size:20;not null;default:'active'" json:"status"` // active / banned
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名。
func (User) TableName() string { return "users" }

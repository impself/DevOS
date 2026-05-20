// Package project 提供项目管理领域模型、数据仓储、业务逻辑和 HTTP 接口。
// 支持项目的增删改查、成员管理以及基于角色的访问控制。
package project

import (
	"time"

	"gorm.io/gorm"
)

// Project 表示一个项目实体，属于某个工作空间。
// 项目有 owner 和多个成员，支持 active / archived 两种状态。
type Project struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID string         `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name        string         `gorm:"not null;size:100" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	Status      string         `gorm:"size:20;not null;default:'active'" json:"status"` // active / archived
	OwnerID     string         `gorm:"type:uuid;not null;index" json:"owner_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定 Project 对应的数据库表名。
func (Project) TableName() string { return "projects" }

// Member 表示项目与用户的关联关系，即项目成员。
// 每个成员拥有一个角色：owner / admin / developer / viewer。
// Username, Email, Nickname, Avatar 通过 JOIN users 表填充，不持久化到 project_members 表。
type Member struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID string         `gorm:"type:uuid;not null;index" json:"project_id"`
	UserID    string         `gorm:"type:uuid;not null;index" json:"user_id"`
	Role      string         `gorm:"size:20;not null;default:'developer'" json:"role"` // owner / admin / developer / viewer
	Username  string         `gorm:"->" json:"username"`
	Email     string         `gorm:"->" json:"email"`
	Nickname  string         `gorm:"->" json:"nickname"`
	Avatar    string         `gorm:"->" json:"avatar"`
	JoinedAt  time.Time      `json:"joined_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定 Member 对应的数据库表名。
func (Member) TableName() string { return "project_members" }

// Package comment 提供任务评论的领域模型、数据仓储、业务逻辑和 HTTP 接口。
package comment

import (
	"time"

	"gorm.io/gorm"
)

// Comment 表示任务下的一条评论。
type Comment struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TaskID    string         `gorm:"type:uuid;not null;index" json:"task_id"`
	UserID    string         `gorm:"type:uuid;not null" json:"user_id"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// JOIN 虚字段
	Username  string `gorm:"->" json:"username"`
	Nickname  string `gorm:"->" json:"nickname"`
	Avatar    string `gorm:"->" json:"avatar"`
}

// TableName 指定 Comment 对应的数据库表名。
func (Comment) TableName() string { return "comments" }

// Package tag 提供项目标签领域模型、数据仓储、业务逻辑和 HTTP 接口。
// 标签属于项目级别，任务通过多对多关系关联标签。
package tag

import "time"

// Tag 项目级别的标签，用于对任务进行多维分类。
type Tag struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID string    `gorm:"type:uuid;not null;index" json:"project_id"`
	Name      string    `gorm:"not null;size:50" json:"name"`
	Color     string    `gorm:"not null;size:7;default:'#6B7280'" json:"color"` // hex color
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName 指定 Tag 对应的数据库表名。
func (Tag) TableName() string { return "tags" }

// TaskTag 任务-标签关联表。
type TaskTag struct {
	TaskID string `gorm:"type:uuid;primaryKey" json:"task_id"`
	TagID  string `gorm:"type:uuid;primaryKey" json:"tag_id"`
}

// TableName 指定 TaskTag 对应的数据库表名。
func (TaskTag) TableName() string { return "task_tags" }

// Package task 提供任务管理领域模型、数据仓储、业务逻辑和 HTTP 接口。
// 支持任务的增删改查、状态流转、指派、排序和多维度过滤。
package task

import (
	"time"

	"github.com/impself/DevOS/internal/tag"
	"gorm.io/gorm"
)

// Task 表示项目中的一个任务单元。
// 支持 Epic → Task → Subtask 三级层级结构（通过 parent_id 自引用）。
type Task struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID   string         `gorm:"type:uuid;not null;index" json:"project_id"`
	ParentID    *string        `gorm:"type:uuid;index" json:"parent_id"`
	Title       string         `gorm:"not null;size:200" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Type        string         `gorm:"size:20;not null;default:'task'" json:"type"`        // task / bug / feature / improvement
	Status      string         `gorm:"size:20;not null;default:'todo'" json:"status"`      // backlog / todo / in_progress / in_review / done / cancelled
	Priority    string         `gorm:"size:20;not null;default:'medium'" json:"priority"`   // high / medium / low
	StoryPoints *int           `gorm:"type:smallint" json:"story_points"`
	DueDate     *time.Time     `gorm:"type:timestamptz" json:"due_date"`
	AssigneeID  *string        `gorm:"type:uuid;index" json:"assignee_id"`
	CreatedBy   string         `gorm:"type:uuid;not null" json:"created_by"`
	SprintID    *string        `gorm:"type:uuid;index" json:"sprint_id"`
	SortOrder   float64        `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// JOIN 虚字段，不持久化
	AssigneeName     string `gorm:"->" json:"assignee_name,omitempty"`
	AssigneeNickname string `gorm:"->" json:"assignee_nickname,omitempty"`
	CreatorName      string `gorm:"->" json:"creator_name,omitempty"`
	CreatorNickname  string `gorm:"->" json:"creator_nickname,omitempty"`
	AssigneeEmail    string `gorm:"->" json:"assignee_email,omitempty"`
	Tags             []tag.Tag `gorm:"-" json:"tags,omitempty"`
}

// TableName 指定 Task 对应的数据库表名。
func (Task) TableName() string { return "tasks" }

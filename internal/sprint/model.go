// Package sprint 提供 Sprint 迭代管理领域模型、数据仓储、业务逻辑和 HTTP 接口。
// Sprint 属于项目级别，通过 task.sprint_id 与任务关联。
package sprint

import "time"

// Sprint 项目级别的迭代周期，用于 Scrum 工作流中的时间盒管理。
type Sprint struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID string    `gorm:"type:uuid;not null;index" json:"project_id"`
	Name      string    `gorm:"not null;size:100" json:"name"`
	Goal      string    `gorm:"type:text" json:"goal"`
	Status    string    `gorm:"size:20;not null;default:'planning'" json:"status"` // planning / active / completed
	StartDate time.Time `gorm:"type:date" json:"start_date"`
	EndDate   time.Time `gorm:"type:date" json:"end_date"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName 指定 Sprint 对应的数据库表名。
func (Sprint) TableName() string { return "sprints" }

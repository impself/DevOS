// Package document 提供文档 CRUD 业务逻辑。
package document

import (
	"time"

	"gorm.io/datatypes"
)

// Document 项目内富文本文档，内容存为 TipTap JSON 格式。
type Document struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID string         `gorm:"type:uuid;not null;index" json:"project_id"`
	Title     string         `gorm:"not null;size:200" json:"title"`
	Content   datatypes.JSON `gorm:"type:jsonb" json:"content,omitempty"`
	YjsState  []byte         `gorm:"type:bytea" json:"-"`
	CreatedBy string         `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`

	// 虚拟字段：通过 JOIN 查询填充
	CreatorName     string `gorm:"-" json:"creator_name,omitempty"`
	CreatorNickname string `gorm:"-" json:"creator_nickname,omitempty"`
}

// TableName 指定数据库表名。
func (Document) TableName() string { return "documents" }

package document

import (
	"gorm.io/gorm"
)

// Repository 文档数据访问接口。
type Repository interface {
	Create(doc *Document) error
	FindByID(id string) (*Document, error)
	ListByProject(projectID string, search string, page, pageSize int) ([]Document, int64, error)
	Update(doc *Document) error
	Delete(id string) error
	GetYjsState(docID string) ([]byte, error)
	SaveYjsState(docID string, state []byte) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建文档 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(doc *Document) error {
	return r.db.Create(doc).Error
}

func (r *repository) FindByID(id string) (*Document, error) {
	var doc Document
	err := r.db.
		Select("documents.*, "+
			"users.username as creator_name, "+
			"users.nickname as creator_nickname").
		Joins("LEFT JOIN users ON users.id = documents.created_by").
		First(&doc, "documents.id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *repository) ListByProject(projectID string, search string, page, pageSize int) ([]Document, int64, error) {
	var docs []Document
	var total int64

	q := r.db.Where("documents.project_id = ?", projectID)
	if search != "" {
		q = q.Where("documents.title ILIKE ?", "%"+search+"%")
	}

	if err := q.Model(&Document{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := q.
		Select("documents.id, documents.project_id, documents.title, documents.created_by, documents.created_at, documents.updated_at, "+
			"users.username as creator_name, users.nickname as creator_nickname").
		Joins("LEFT JOIN users ON users.id = documents.created_by").
		Order("documents.updated_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&docs).Error

	return docs, total, err
}

func (r *repository) Update(doc *Document) error {
	return r.db.Save(doc).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Delete(&Document{}, "id = ?", id).Error
}

// GetYjsState 读取文档的 Yjs 二进制状态。
func (r *repository) GetYjsState(docID string) ([]byte, error) {
	var doc Document
	if err := r.db.Select("yjs_state").First(&doc, "id = ?", docID).Error; err != nil {
		return nil, err
	}
	return doc.YjsState, nil
}

// SaveYjsState 写入文档的 Yjs 二进制状态。
func (r *repository) SaveYjsState(docID string, state []byte) error {
	return r.db.Model(&Document{}).Where("id = ?", docID).Update("yjs_state", state).Error
}

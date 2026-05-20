package comment

import "gorm.io/gorm"

// Repository 评论数据访问接口。
type Repository interface {
	Create(comment *Comment) error
	List(taskID string) ([]Comment, error)
	Delete(id string) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建评论 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(comment *Comment) error {
	return r.db.Create(comment).Error
}

func (r *repository) List(taskID string) ([]Comment, error) {
	var comments []Comment
	if err := r.db.Table("comments").
		Select("comments.*, users.username, users.nickname, users.avatar").
		Joins("JOIN users ON users.id = comments.user_id").
		Where("comments.task_id = ? AND comments.deleted_at IS NULL", taskID).
		Order("comments.created_at ASC").
		Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Comment{}).Error
}

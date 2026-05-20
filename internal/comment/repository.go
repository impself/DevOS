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
	err := r.db.Raw(`
		SELECT c.*, u.username, u.nickname, u.avatar
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.task_id = ? AND c.deleted_at IS NULL
		ORDER BY c.created_at ASC
	`, taskID).Scan(&comments).Error
	if err != nil {
		return nil, err
	}
	return comments, nil
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Comment{}).Error
}

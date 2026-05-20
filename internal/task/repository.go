package task

import (
	"fmt"

	"gorm.io/gorm"
)

// Repository 任务数据访问接口，抽象以便 mock 测试。
type Repository interface {
	Create(task *Task) error
	FindByID(id string) (*Task, error)
	Update(task *Task) error
	Delete(id string) error
	List(projectID string, filters ListFilters) ([]Task, int64, error)
	UpdateSortOrder(id string, sortOrder float64) error
}

// ListFilters 任务列表过滤条件。
type ListFilters struct {
	Status   string
	Priority string
	Type     string
	Assignee string
	SprintID string
	ParentID string
	Search   string
	Page     int
	PageSize int
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建任务 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(task *Task) error {
	return r.db.Create(task).Error
}

func (r *repository) FindByID(id string) (*Task, error) {
	var t Task
	if err := r.db.Table("tasks").
		Select("tasks.*, ua.username as assignee_name, ua.email as assignee_email, uc.username as creator_name").
		Joins("LEFT JOIN users ua ON ua.id = tasks.assignee_id").
		Joins("LEFT JOIN users uc ON uc.id = tasks.created_by").
		Where("tasks.id = ? AND tasks.deleted_at IS NULL", id).
		First(&t).Error; err != nil {
		return nil, fmt.Errorf("find task: %w", err)
	}
	return &t, nil
}

func (r *repository) Update(task *Task) error {
	return r.db.Save(task).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Task{}).Error
}

func (r *repository) List(projectID string, f ListFilters) ([]Task, int64, error) {
	query := r.db.Table("tasks").
		Select("tasks.*, ua.username as assignee_name, ua.email as assignee_email, uc.username as creator_name").
		Joins("LEFT JOIN users ua ON ua.id = tasks.assignee_id").
		Joins("LEFT JOIN users uc ON uc.id = tasks.created_by").
		Where("tasks.project_id = ? AND tasks.deleted_at IS NULL", projectID)

	if f.Status != "" {
		query = query.Where("tasks.status = ?", f.Status)
	}
	if f.Priority != "" {
		query = query.Where("tasks.priority = ?", f.Priority)
	}
	if f.Type != "" {
		query = query.Where("tasks.type = ?", f.Type)
	}
	if f.Assignee != "" {
		query = query.Where("tasks.assignee_id = ?", f.Assignee)
	}
	if f.SprintID != "" {
		query = query.Where("tasks.sprint_id = ?", f.SprintID)
	}
	if f.ParentID == "none" {
		query = query.Where("tasks.parent_id IS NULL")
	} else if f.ParentID != "" {
		query = query.Where("tasks.parent_id = ?", f.ParentID)
	}
	if f.Search != "" {
		like := "%" + f.Search + "%"
		query = query.Where("tasks.title ILIKE ? OR tasks.description ILIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 {
		f.PageSize = 20
	}
	offset := (f.Page - 1) * f.PageSize

	var tasks []Task
	if err := query.Order("tasks.sort_order ASC, tasks.created_at DESC").
		Limit(f.PageSize).Offset(offset).
		Find(&tasks).Error; err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func (r *repository) UpdateSortOrder(id string, sortOrder float64) error {
	return r.db.Model(&Task{}).Where("id = ?", id).Update("sort_order", sortOrder).Error
}

package task

import (
	"fmt"
	"strings"

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
	err := r.db.Raw(`
		SELECT t.*, ua.username AS assignee_name, ua.email AS assignee_email, uc.username AS creator_name
		FROM tasks t
		LEFT JOIN users ua ON ua.id = t.assignee_id
		LEFT JOIN users uc ON uc.id = t.created_by
		WHERE t.id = ? AND t.deleted_at IS NULL
	`, id).Scan(&t).Error
	if err != nil {
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
	// base SQL parts
	baseSelect := `
		SELECT t.*, ua.username AS assignee_name, ua.email AS assignee_email, uc.username AS creator_name
		FROM tasks t
		LEFT JOIN users ua ON ua.id = t.assignee_id
		LEFT JOIN users uc ON uc.id = t.created_by
		WHERE t.project_id = ? AND t.deleted_at IS NULL`
	baseArgs := []interface{}{projectID}

	extraWhere, extraArgs := buildWhere(f)
	sql := baseSelect + extraWhere

	var total int64
	countSQL := `SELECT COUNT(*) FROM tasks t WHERE t.project_id = ? AND t.deleted_at IS NULL` + strings.Replace(extraWhere, baseSelect, "", 1)
	// Rebuild count properly
	countSQL = "SELECT COUNT(*) FROM tasks t WHERE t.project_id = ? AND t.deleted_at IS NULL" + extraWhere
	allArgs := append(baseArgs, extraArgs...)
	if err := r.db.Raw(countSQL, allArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 {
		f.PageSize = 20
	}
	offset := (f.Page - 1) * f.PageSize

	sql += " ORDER BY t.sort_order ASC, t.created_at DESC LIMIT ? OFFSET ?"
	allArgs = append(allArgs, f.PageSize, offset)

	var tasks []Task
	if err := r.db.Raw(sql, allArgs...).Scan(&tasks).Error; err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func buildWhere(f ListFilters) (string, []interface{}) {
	var clauses []string
	var args []interface{}

	if f.Status != "" {
		clauses = append(clauses, "t.status = ?")
		args = append(args, f.Status)
	}
	if f.Priority != "" {
		clauses = append(clauses, "t.priority = ?")
		args = append(args, f.Priority)
	}
	if f.Type != "" {
		clauses = append(clauses, "t.type = ?")
		args = append(args, f.Type)
	}
	if f.Assignee != "" {
		clauses = append(clauses, "t.assignee_id = ?")
		args = append(args, f.Assignee)
	}
	if f.SprintID != "" {
		clauses = append(clauses, "t.sprint_id = ?")
		args = append(args, f.SprintID)
	}
	if f.ParentID == "none" {
		clauses = append(clauses, "t.parent_id IS NULL")
	} else if f.ParentID != "" {
		clauses = append(clauses, "t.parent_id = ?")
		args = append(args, f.ParentID)
	}
	if f.Search != "" {
		like := "%" + f.Search + "%"
		clauses = append(clauses, "(t.title ILIKE ? OR t.description ILIKE ?)")
		args = append(args, like, like)
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

func (r *repository) UpdateSortOrder(id string, sortOrder float64) error {
	return r.db.Model(&Task{}).Where("id = ?", id).Update("sort_order", sortOrder).Error
}

package sprint

import "gorm.io/gorm"

// Repository Sprint 数据访问接口。
type Repository interface {
	Create(sprint *Sprint) error
	FindByID(id string) (*Sprint, error)
	ListByProject(projectID string) ([]Sprint, error)
	Update(sprint *Sprint) error
	Delete(id string) error
	HasActiveSprint(projectID string) (bool, error)
	CountTasksBySprint(projectID string) (map[string]int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建 Sprint Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(sprint *Sprint) error {
	return r.db.Create(sprint).Error
}

func (r *repository) FindByID(id string) (*Sprint, error) {
	var s Sprint
	if err := r.db.Where("id = ?", id).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *repository) ListByProject(projectID string) ([]Sprint, error) {
	var sprints []Sprint
	err := r.db.Where("project_id = ?", projectID).Order("start_date DESC").Find(&sprints).Error
	return sprints, err
}

func (r *repository) Update(sprint *Sprint) error {
	return r.db.Save(sprint).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Sprint{}).Error
}

// HasActiveSprint 检查项目是否已有进行中的 Sprint。
func (r *repository) HasActiveSprint(projectID string) (bool, error) {
	var count int64
	err := r.db.Model(&Sprint{}).Where("project_id = ? AND status = 'active'", projectID).Count(&count).Error
	return count > 0, err
}

// CountTasksBySprint 统计每个 Sprint 下的任务数量，返回 map[sprintID]count。
func (r *repository) CountTasksBySprint(projectID string) (map[string]int64, error) {
	type row struct {
		SprintID string `gorm:"column:sprint_id"`
		Count    int64  `gorm:"column:cnt"`
	}
	var rows []row
	err := r.db.Raw(`
		SELECT sprint_id, COUNT(*) AS cnt
		FROM tasks
		WHERE project_id = ? AND sprint_id IS NOT NULL AND deleted_at IS NULL
		GROUP BY sprint_id
	`, projectID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]int64)
	for _, rw := range rows {
		result[rw.SprintID] = rw.Count
	}
	return result, nil
}

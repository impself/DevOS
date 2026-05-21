package tag

import "gorm.io/gorm"

// Repository 标签数据访问接口。
type Repository interface {
	Create(tag *Tag) error
	FindByID(id string) (*Tag, error)
	ListByProject(projectID string) ([]Tag, error)
	Update(tag *Tag) error
	Delete(id string) error
	AddTaskTags(taskID string, tagIDs []string) error
	RemoveTaskTags(taskID string, tagIDs []string) error
	RemoveAllTaskTags(taskID string) error
	GetTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error)
	GetTagsByTaskID(taskID string) ([]Tag, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建标签 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(tag *Tag) error {
	return r.db.Create(tag).Error
}

func (r *repository) FindByID(id string) (*Tag, error) {
	var t Tag
	if err := r.db.Where("id = ?", id).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *repository) ListByProject(projectID string) ([]Tag, error) {
	var tags []Tag
	err := r.db.Where("project_id = ?", projectID).Order("name ASC").Find(&tags).Error
	return tags, err
}

func (r *repository) Update(tag *Tag) error {
	return r.db.Save(tag).Error
}

func (r *repository) Delete(id string) error {
	// 先删关联，再删标签
	r.db.Where("tag_id = ?", id).Delete(&TaskTag{})
	return r.db.Where("id = ?", id).Delete(&Tag{}).Error
}

func (r *repository) AddTaskTags(taskID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		return nil
	}
	var records []TaskTag
	for _, tid := range tagIDs {
		records = append(records, TaskTag{TaskID: taskID, TagID: tid})
	}
	return r.db.Create(&records).Error
}

func (r *repository) RemoveTaskTags(taskID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		return nil
	}
	return r.db.Where("task_id = ? AND tag_id IN ?", taskID, tagIDs).Delete(&TaskTag{}).Error
}

func (r *repository) RemoveAllTaskTags(taskID string) error {
	return r.db.Where("task_id = ?", taskID).Delete(&TaskTag{}).Error
}

// GetTagsByTaskIDs 批量获取多个任务的标签，返回 map[taskID][]Tag。
func (r *repository) GetTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error) {
	if len(taskIDs) == 0 {
		return map[string][]Tag{}, nil
	}

	type row struct {
		TaskID    string `gorm:"column:task_id"`
		TagID     string `gorm:"column:tag_id"`
		ProjectID string `gorm:"column:project_id"`
		Name      string `gorm:"column:name"`
		Color     string `gorm:"column:color"`
	}

	var rows []row
	err := r.db.Raw(`
		SELECT tt.task_id, t.id AS tag_id, t.project_id, t.name, t.color
		FROM task_tags tt
		JOIN tags t ON t.id = tt.tag_id
		WHERE tt.task_id IN ?
	`, taskIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make(map[string][]Tag)
	for _, rw := range rows {
		result[rw.TaskID] = append(result[rw.TaskID], Tag{
			ID: rw.TagID, ProjectID: rw.ProjectID, Name: rw.Name, Color: rw.Color,
		})
	}
	return result, nil
}

// GetTagsByTaskID 获取单个任务的标签列表。
func (r *repository) GetTagsByTaskID(taskID string) ([]Tag, error) {
	var tags []Tag
	err := r.db.Raw(`
		SELECT t.id, t.project_id, t.name, t.color, t.created_at, t.updated_at
		FROM task_tags tt
		JOIN tags t ON t.id = tt.tag_id
		WHERE tt.task_id = ?
		ORDER BY t.name ASC
	`, taskID).Scan(&tags).Error
	return tags, err
}

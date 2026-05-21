package project

import (
	"fmt"

	"gorm.io/gorm"
)

// Repository 定义项目及成员的数据访问接口。
// 抽象出接口以便在 service 层进行 mock 测试。
type Repository interface {
	// Create 插入一条新项目记录。
	Create(project *Project) error
	// FindByID 根据 ID 查询单个项目。
	FindByID(id string) (*Project, error)
	// ListByOwner 查询用户拥有或参与的项目（含任务统计），支持分页。
	// 返回项目列表和总数，按创建时间倒序排列。
	ListByOwner(ownerID string, offset, limit int) ([]Project, int64, error)
	// ListAll 查询所有项目（含任务统计），仅限系统管理员使用。
	ListAll(offset, limit int) ([]Project, int64, error)
	// Update 保存项目字段的修改。
	Update(project *Project) error
	// Delete 软删除指定 ID 的项目（利用 gorm.DeletedAt）。
	Delete(id string) error

	// AddMember 添加一条项目成员记录。
	AddMember(member *Member) error
	// RemoveMember 软删除指定项目中的指定成员。
	RemoveMember(projectID, userID string) error
	// ListMembers 查询指定项目的全部成员。
	ListMembers(projectID string) ([]Member, error)
	// FindMember 查询指定项目中某个用户的成员记录，用于权限校验。
	FindMember(projectID, userID string) (*Member, error)
	// UpdateMemberRole 更新指定成员的角色。
	UpdateMemberRole(projectID, userID, role string) error
	// IsProjectMember 检查用户是否为项目成员（含 owner），满足 task.ProjectMembershipChecker 接口。
	IsProjectMember(projectID, userID string) bool
}

// repository 是 Repository 接口的 GORM 实现。
type repository struct {
	db *gorm.DB
}

// NewRepository 创建并返回一个基于 GORM 的 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(project *Project) error {
	return r.db.Create(project).Error
}

func (r *repository) FindByID(id string) (*Project, error) {
	var p Project
	if err := r.db.Where("id = ?", id).First(&p).Error; err != nil {
		return nil, fmt.Errorf("find project: %w", err)
	}
	return &p, nil
}

func (r *repository) ListByOwner(ownerID string, offset, limit int) ([]Project, int64, error) {
	var projects []Project
	var total int64

	// Count total projects the user owns or is a member of
	countFilter := "owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)"
	if err := r.db.Where(countFilter, ownerID, ownerID).Model(&Project{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Fetch projects with task stats via LEFT JOIN
		joinFilter := "p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)"
	err := r.db.Raw(`
		SELECT p.*,
			COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS task_total,
			COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.deleted_at IS NULL) AS task_done
		FROM projects p
		LEFT JOIN tasks t ON t.project_id = p.id
		WHERE p.deleted_at IS NULL AND (`+joinFilter+`)
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`, ownerID, ownerID, limit, offset).Scan(&projects).Error
	if err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

// ListAll 查询所有非软删除的项目（含任务统计），仅系统管理员调用。
func (r *repository) ListAll(offset, limit int) ([]Project, int64, error) {
	var projects []Project
	var total int64
	if err := r.db.Model(&Project{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := r.db.Raw(`
		SELECT p.*,
			COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS task_total,
			COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.deleted_at IS NULL) AS task_done
		FROM projects p
		LEFT JOIN tasks t ON t.project_id = p.id
		WHERE p.deleted_at IS NULL
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`, limit, offset).Scan(&projects).Error
	if err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

func (r *repository) Update(project *Project) error {
	return r.db.Save(project).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Project{}).Error
}

func (r *repository) AddMember(member *Member) error {
	return r.db.Create(member).Error
}

func (r *repository) RemoveMember(projectID, userID string) error {
	return r.db.Where("project_id = ? AND user_id = ?", projectID, userID).Delete(&Member{}).Error
}

func (r *repository) ListMembers(projectID string) ([]Member, error) {
	var members []Member
	err := r.db.Raw(`
		SELECT pm.*, u.username, u.email, u.nickname, u.avatar
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = ? AND pm.deleted_at IS NULL
	`, projectID).Scan(&members).Error
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (r *repository) FindMember(projectID, userID string) (*Member, error) {
	var m Member
	err := r.db.Raw(`
		SELECT pm.*, u.username, u.email, u.nickname, u.avatar
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = ? AND pm.user_id = ? AND pm.deleted_at IS NULL
	`, projectID, userID).Scan(&m).Error
	if err != nil {
		return nil, fmt.Errorf("find member: %w", err)
	}
	return &m, nil
}

// UpdateMemberRole 更新指定项目中指定成员的角色。
func (r *repository) UpdateMemberRole(projectID, userID, role string) error {
	return r.db.Model(&Member{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Update("role", role).Error
}

// IsProjectMember 检查用户是否为项目成员（包括 owner），满足 task.ProjectMembershipChecker 接口。
func (r *repository) IsProjectMember(projectID, userID string) bool {
	// Check owner
	var count int64
	r.db.Model(&Project{}).
		Where("id = ? AND owner_id = ? AND deleted_at IS NULL", projectID, userID).
		Count(&count)
	if count > 0 {
		return true
	}
	// Check member table
	r.db.Model(&Member{}).
		Where("project_id = ? AND user_id = ? AND deleted_at IS NULL", projectID, userID).
		Count(&count)
	return count > 0
}

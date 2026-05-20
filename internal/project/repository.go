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
	// ListByOwner 查询用户拥有或参与的项目，支持分页。
	// 返回项目列表和总数，按创建时间倒序排列。
	ListByOwner(ownerID string, offset, limit int) ([]Project, int64, error)
	// ListAll 查询所有项目，仅限系统管理员使用。
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

	// 查询用户作为 owner 或作为 member 的所有项目
	query := r.db.Where("owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)", ownerID, ownerID)
	if err := query.Model(&Project{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

// ListAll 查询所有非软删除的项目，仅系统管理员调用。
func (r *repository) ListAll(offset, limit int) ([]Project, int64, error) {
	var projects []Project
	var total int64
	if err := r.db.Model(&Project{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := r.db.Offset(offset).Limit(limit).Order("created_at DESC").Find(&projects).Error; err != nil {
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
	// JOIN users 表拉取 username / email / nickname / avatar，前端直接展示无需再查用户
	if err := r.db.Table("project_members").
		Select("project_members.*, users.username, users.email, users.nickname, users.avatar").
		Joins("JOIN users ON users.id = project_members.user_id").
		Where("project_members.project_id = ? AND project_members.deleted_at IS NULL", projectID).
		Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func (r *repository) FindMember(projectID, userID string) (*Member, error) {
	var m Member
	if err := r.db.Table("project_members").
		Select("project_members.*, users.username, users.email, users.nickname, users.avatar").
		Joins("JOIN users ON users.id = project_members.user_id").
		Where("project_members.project_id = ? AND project_members.user_id = ? AND project_members.deleted_at IS NULL", projectID, userID).
		First(&m).Error; err != nil {
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

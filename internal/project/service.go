package project

import (
	"errors"

	"github.com/google/uuid"
	"github.com/impself/DevOS/internal/auth"
)

// 业务层错误定义，handler 层根据这些错误返回对应的 HTTP 状态码。
var (
	ErrProjectNotFound = errors.New("project not found")
	ErrNoPermission    = errors.New("no permission")
	ErrAlreadyMember   = errors.New("already a member")
	ErrUserNotFound    = errors.New("user not found")
)

// Service 定义项目管理的业务逻辑接口。
type Service interface {
	// Create 创建项目并自动将创建者加为 owner 成员。
	Create(name, description, ownerID string) (*Project, error)
	// GetByID 查询项目详情，要求请求用户是项目 owner 或成员。
	GetByID(id, userID string) (*Project, error)
	// List 分页查询用户拥有或参与的项目。
	List(userID string, page, pageSize int) ([]Project, int64, error)
	// Update 修改项目信息，要求请求用户是 owner 或 admin。
	Update(id, userID, name, description string) (*Project, error)
	// Delete 删除项目，仅 owner 可操作。
	Delete(id, userID string) error

	// AddMember 添加项目成员，要求操作者是 owner 或 admin。
	AddMember(projectID, operatorID, username, role string) error
	// RemoveMember 移除项目成员，要求操作者是 owner 或 admin。
	RemoveMember(projectID, operatorID, userID string) error
	// ListMembers 查询项目成员列表，要求请求用户是项目成员或 owner。
	ListMembers(projectID, userID string) ([]Member, error)
}

// service 是 Service 接口的实现，持有数据仓储依赖。
type service struct {
	repo     Repository
	authRepo auth.Repository
}

// NewService 创建并返回一个 Service 实例。
func NewService(repo Repository, authRepo auth.Repository) Service {
	return &service{repo: repo, authRepo: authRepo}
}

func (s *service) Create(name, description, ownerID string) (*Project, error) {
	// 仅系统管理员可以创建项目
	if !s.isSystemAdmin(ownerID) {
		return nil, ErrNoPermission
	}
	project := &Project{
		Name:        name,
		Description: description,
		OwnerID:     ownerID,
		WorkspaceID: uuid.New().String(),
	}
	if err := s.repo.Create(project); err != nil {
		return nil, err
	}

	// 创建者自动成为 owner 成员
	member := &Member{
		ProjectID: project.ID,
		UserID:    ownerID,
		Role:      "owner",
	}
	_ = s.repo.AddMember(member)

	return project, nil
}

func (s *service) GetByID(id, userID string) (*Project, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	// 系统管理员可查看任意项目
	if s.isSystemAdmin(userID) {
		return p, nil
	}
	// owner 直接放行，否则需要是项目成员
	if p.OwnerID != userID {
		if _, err := s.repo.FindMember(id, userID); err != nil {
			return nil, ErrNoPermission
		}
	}
	return p, nil
}

func (s *service) List(userID string, page, pageSize int) ([]Project, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	// 系统管理员可以看到所有项目
	if s.isSystemAdmin(userID) {
		return s.repo.ListAll(offset, pageSize)
	}
	return s.repo.ListByOwner(userID, offset, pageSize)
}

func (s *service) Update(id, userID, name, description string) (*Project, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	if !s.canEdit(p, userID) {
		return nil, ErrNoPermission
	}
	p.Name = name
	p.Description = description
	if err := s.repo.Update(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *service) Delete(id, userID string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return ErrProjectNotFound
	}
	// 仅系统管理员可以删除项目
	if !s.isSystemAdmin(userID) {
		return ErrNoPermission
	}
	return s.repo.Delete(id)
}

func (s *service) AddMember(projectID, operatorID, username, role string) error {
	p, err := s.repo.FindByID(projectID)
	if err != nil {
		return ErrProjectNotFound
	}
	if !s.canManageMembers(p, operatorID) {
		return ErrNoPermission
	}
	// 通过 username 查找用户 ID
	user, err := s.authRepo.FindByUsername(username)
	if err != nil {
		return ErrUserNotFound
	}
	// 检查目标用户是否已经是成员，避免重复添加
	if _, err := s.repo.FindMember(projectID, user.ID); err == nil {
		return ErrAlreadyMember
	}
	return s.repo.AddMember(&Member{
		ProjectID: projectID,
		UserID:    user.ID,
		Role:      role,
	})
}

func (s *service) RemoveMember(projectID, operatorID, userID string) error {
	p, err := s.repo.FindByID(projectID)
	if err != nil {
		return ErrProjectNotFound
	}
	if !s.canManageMembers(p, operatorID) {
		return ErrNoPermission
	}
	return s.repo.RemoveMember(projectID, userID)
}

func (s *service) ListMembers(projectID, userID string) ([]Member, error) {
	// 系统管理员可查看任意项目的成员列表
	if s.isSystemAdmin(userID) {
		return s.repo.ListMembers(projectID)
	}
	// 用户必须是项目成员才能查看成员列表；如果是 owner 也可查看
	if _, err := s.repo.FindMember(projectID, userID); err != nil {
		if p, e := s.repo.FindByID(projectID); e != nil || p.OwnerID != userID {
			return nil, ErrNoPermission
		}
	}
	return s.repo.ListMembers(projectID)
}

// isSystemAdmin 判断用户是否为系统管理员，系统管理员可以绕过所有项目级权限检查。
func (s *service) isSystemAdmin(userID string) bool {
	ok, _ := s.authRepo.IsAdmin(userID)
	return ok
}

// canEdit 判断用户是否有权编辑项目信息，仅系统管理员可编辑。
func (s *service) canEdit(_ *Project, userID string) bool {
	return s.isSystemAdmin(userID)
}

// canManageMembers 判断用户是否有权管理项目成员，仅系统管理员可管理。
func (s *service) canManageMembers(_ *Project, userID string) bool {
	return s.isSystemAdmin(userID)
}

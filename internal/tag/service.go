package tag

import (
	"github.com/impself/DevOS/internal/auth"
)

// PresetColors 预设可选颜色。
var PresetColors = []string{
	"#EF4444", "#F97316", "#F59E0B", "#84CC16",
	"#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
	"#6366F1", "#8B5CF6", "#A855F7", "#EC4899",
	"#6B7280", "#78716C", "#64748B",
}

// ProjectMembershipChecker 抽象项目成员查询，避免 tag 包直接依赖 project 包。
type ProjectMembershipChecker interface {
	IsProjectMember(projectID, userID string) bool
}

// Service 标签业务接口。
type Service interface {
	Create(tag *Tag, userID string) (*Tag, error)
	ListByProject(projectID, userID string) ([]Tag, error)
	Update(id, userID string, updates map[string]interface{}) (*Tag, error)
	Delete(id, userID string) error
	SetTaskTags(taskID string, tagIDs []string) error
	GetTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error)
	GetTagsByTaskID(taskID string) ([]Tag, error)
}

type service struct {
	repo     Repository
	authRepo auth.Repository
	pmCheck  ProjectMembershipChecker
}

// NewService 创建标签 Service 实例。
func NewService(repo Repository, authRepo auth.Repository, pmCheck ProjectMembershipChecker) Service {
	return &service{repo: repo, authRepo: authRepo, pmCheck: pmCheck}
}

func (s *service) isAdmin(userID string) bool {
	ok, _ := s.authRepo.IsAdmin(userID)
	return ok
}

func (s *service) canManage(projectID, userID string) bool {
	if s.isAdmin(userID) {
		return true
	}
	if s.pmCheck != nil && s.pmCheck.IsProjectMember(projectID, userID) {
		return true
	}
	return false
}

func (s *service) Create(tag *Tag, userID string) (*Tag, error) {
	if !s.canManage(tag.ProjectID, userID) {
		return nil, ErrNoPermission
	}
	if tag.Color == "" {
		tag.Color = "#6B7280"
	}
	if err := s.repo.Create(tag); err != nil {
		return nil, err
	}
	return s.repo.FindByID(tag.ID)
}

func (s *service) ListByProject(projectID, userID string) ([]Tag, error) {
	return s.repo.ListByProject(projectID)
}

func (s *service) Update(id, userID string, updates map[string]interface{}) (*Tag, error) {
	tag, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrTagNotFound
	}
	if !s.canManage(tag.ProjectID, userID) {
		return nil, ErrNoPermission
	}
	if v, ok := updates["name"]; ok {
		tag.Name = v.(string)
	}
	if v, ok := updates["color"]; ok {
		tag.Color = v.(string)
	}
	if err := s.repo.Update(tag); err != nil {
		return nil, err
	}
	return s.repo.FindByID(id)
}

func (s *service) Delete(id, userID string) error {
	tag, err := s.repo.FindByID(id)
	if err != nil {
		return ErrTagNotFound
	}
	if !s.canManage(tag.ProjectID, userID) {
		return ErrNoPermission
	}
	return s.repo.Delete(id)
}

// SetTaskTags 替换任务的标签集合（先全删再添加）。
func (s *service) SetTaskTags(taskID string, tagIDs []string) error {
	if err := s.repo.RemoveAllTaskTags(taskID); err != nil {
		return err
	}
	return s.repo.AddTaskTags(taskID, tagIDs)
}

func (s *service) GetTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error) {
	return s.repo.GetTagsByTaskIDs(taskIDs)
}

func (s *service) GetTagsByTaskID(taskID string) ([]Tag, error) {
	return s.repo.GetTagsByTaskID(taskID)
}

package task

import (
	"errors"
	"time"

	"github.com/impself/DevOS/internal/auth"
)

var (
	ErrTaskNotFound  = errors.New("task not found")
	ErrNoPermission  = errors.New("no permission")
	ErrInvalidStatus = errors.New("invalid status")
)

// validStatuses 合法的任务状态值。
var validStatuses = map[string]bool{
	"backlog": true, "todo": true, "in_progress": true,
	"in_review": true, "done": true, "cancelled": true,
}

// validPriorities 合法的优先级值。
var validPriorities = map[string]bool{
	"low": true, "medium": true, "high": true,
}

// validTypes 合法的任务类型值。
var validTypes = map[string]bool{
	"task": true, "bug": true, "feature": true, "improvement": true,
}

// ProjectMembershipChecker 抽象项目成员查询，避免 task 包直接依赖 project 包。
type ProjectMembershipChecker interface {
	IsProjectMember(projectID, userID string) bool
}

// Service 任务业务接口。
type Service interface {
	Create(task *Task) (*Task, error)
	GetByID(id, userID string) (*Task, error)
	Update(id, userID string, updates map[string]interface{}) (*Task, error)
	Delete(id, userID string) error
	List(projectID, userID string, filters ListFilters) ([]Task, int64, error)
}

type service struct {
	repo              Repository
	authRepo          auth.Repository
	projectMembership ProjectMembershipChecker
}

// NewService 创建任务 Service 实例。
func NewService(repo Repository, authRepo auth.Repository, projectMembership ProjectMembershipChecker) Service {
	return &service{repo: repo, authRepo: authRepo, projectMembership: projectMembership}
}

func (s *service) isAdmin(userID string) bool {
	ok, _ := s.authRepo.IsAdmin(userID)
	return ok
}

// canManageTask 判断用户是否有权管理任务：系统管理员 > 任务创建者 > 指派人 > 项目成员。
func (s *service) canManageTask(t *Task, userID string) bool {
	if s.isAdmin(userID) {
		return true
	}
	if t.CreatedBy == userID {
		return true
	}
	if t.AssigneeID != nil && *t.AssigneeID == userID {
		return true
	}
	if s.projectMembership != nil && s.projectMembership.IsProjectMember(t.ProjectID, userID) {
		return true
	}
	return false
}

// canViewTask 判断用户是否有权查看任务。
func (s *service) canViewTask(t *Task, userID string) bool {
	return s.canManageTask(t, userID)
}

func (s *service) Create(task *Task) (*Task, error) {
	if !validStatuses[task.Status] {
		task.Status = "todo"
	}
	if !validPriorities[task.Priority] {
		task.Priority = "medium"
	}
	if !validTypes[task.Type] {
		task.Type = "task"
	}
	if err := s.repo.Create(task); err != nil {
		return nil, err
	}
	return s.repo.FindByID(task.ID)
}

func (s *service) GetByID(id, userID string) (*Task, error) {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	if !s.canViewTask(t, userID) {
		return nil, ErrNoPermission
	}
	return t, nil
}

func (s *service) Update(id, userID string, updates map[string]interface{}) (*Task, error) {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	if !s.canManageTask(t, userID) {
		return nil, ErrNoPermission
	}
	// 按字段更新
	if v, ok := updates["title"]; ok {
		t.Title = v.(string)
	}
	if v, ok := updates["description"]; ok {
		t.Description = v.(string)
	}
	if v, ok := updates["status"]; ok {
		sv := v.(string)
		if !validStatuses[sv] {
			return nil, ErrInvalidStatus
		}
		t.Status = sv
	}
	if v, ok := updates["priority"]; ok {
		p := v.(string)
		if !validPriorities[p] {
			return nil, errors.New("invalid priority")
		}
		t.Priority = p
	}
	if v, ok := updates["type"]; ok {
		tp := v.(string)
		if !validTypes[tp] {
			return nil, errors.New("invalid type")
		}
		t.Type = tp
	}
	if v, ok := updates["assignee_id"]; ok {
		aid := v.(string)
		if aid == "" {
			t.AssigneeID = nil
		} else {
			t.AssigneeID = &aid
		}
	}
	if v, ok := updates["due_date"]; ok {
		ds := v.(string)
		if ds == "" {
			t.DueDate = nil
		} else if parsed, err := time.Parse(time.RFC3339, ds); err == nil {
			t.DueDate = &parsed
		} else if parsed, err := time.Parse("2006-01-02", ds); err == nil {
			t.DueDate = &parsed
		} else {
			return nil, errors.New("invalid due_date format, use RFC3339 or YYYY-MM-DD")
		}
	}
	if v, ok := updates["story_points"]; ok {
		sp := int(v.(float64))
		t.StoryPoints = &sp
	}
	if v, ok := updates["sort_order"]; ok {
		t.SortOrder = v.(float64)
	}

	if err := s.repo.Update(t); err != nil {
		return nil, err
	}
	return s.repo.FindByID(id)
}

func (s *service) Delete(id, userID string) error {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return ErrTaskNotFound
	}
	if !s.canManageTask(t, userID) {
		return ErrNoPermission
	}
	return s.repo.Delete(id)
}

func (s *service) List(projectID, userID string, filters ListFilters) ([]Task, int64, error) {
	return s.repo.List(projectID, filters)
}

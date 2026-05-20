package task

import (
	"errors"

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

// Service 任务业务接口。
type Service interface {
	Create(task *Task) (*Task, error)
	GetByID(id, userID string) (*Task, error)
	Update(id, userID string, updates map[string]interface{}) (*Task, error)
	Delete(id, userID string) error
	List(projectID, userID string, filters ListFilters) ([]Task, int64, error)
}

type service struct {
	repo     Repository
	authRepo auth.Repository
}

// NewService 创建任务 Service 实例。
func NewService(repo Repository, authRepo auth.Repository) Service {
	return &service{repo: repo, authRepo: authRepo}
}

func (s *service) isAdmin(userID string) bool {
	ok, _ := s.authRepo.IsAdmin(userID)
	return ok
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
	if !s.isAdmin(userID) {
		// 后续可加项目成员校验，目前先放开读权限
	}
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	return t, nil
}

func (s *service) Update(id, userID string, updates map[string]interface{}) (*Task, error) {
	if !s.isAdmin(userID) {
		return nil, ErrNoPermission
	}
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	// 按字段更新
	if v, ok := updates["title"]; ok {
		t.Title = v.(string)
	}
	if v, ok := updates["description"]; ok {
		t.Description = v.(string)
	}
	if v, ok := updates["status"]; ok {
		s := v.(string)
		if !validStatuses[s] {
			return nil, ErrInvalidStatus
		}
		t.Status = s
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
	if _, ok := updates["due_date"]; ok {
		t.DueDate = nil
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
	if !s.isAdmin(userID) {
		return ErrNoPermission
	}
	if _, err := s.repo.FindByID(id); err != nil {
		return ErrTaskNotFound
	}
	return s.repo.Delete(id)
}

func (s *service) List(projectID, userID string, filters ListFilters) ([]Task, int64, error) {
	return s.repo.List(projectID, filters)
}

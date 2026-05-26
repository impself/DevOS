package sprint

import (
	"time"

	"github.com/impself/DevOS/internal/auth"
)

// ProjectMembershipChecker 抽象项目成员查询，避免 sprint 包直接依赖 project 包。
type ProjectMembershipChecker interface {
	IsProjectMember(projectID, userID string) bool
}

// validStatuses 合法的 Sprint 状态值。
var validStatuses = map[string]bool{
	"planning":  true,
	"active":    true,
	"completed": true,
}

// Service Sprint 业务接口。
type Service interface {
	Create(sprint *Sprint, userID string) (*Sprint, error)
	ListByProject(projectID, userID string) ([]Sprint, map[string]int64, error)
	Update(id, userID string, updates map[string]interface{}) (*Sprint, error)
	Delete(id, userID string) error
}

type service struct {
	repo     Repository
	authRepo auth.Repository
	pmCheck  ProjectMembershipChecker
}

// NewService 创建 Sprint Service 实例。
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

func (s *service) Create(sprint *Sprint, userID string) (*Sprint, error) {
	if !s.canManage(sprint.ProjectID, userID) {
		return nil, ErrNoPermission
	}
	if !sprint.EndDate.After(sprint.StartDate) {
		return nil, ErrInvalidDateRange
	}
	if !validStatuses[sprint.Status] {
		sprint.Status = "planning"
	}
	if err := s.repo.Create(sprint); err != nil {
		return nil, err
	}
	return s.repo.FindByID(sprint.ID)
}

// ListByProject 返回项目 Sprint 列表和每个 Sprint 的任务计数。
func (s *service) ListByProject(projectID, userID string) ([]Sprint, map[string]int64, error) {
	sprints, err := s.repo.ListByProject(projectID)
	if err != nil {
		return nil, nil, err
	}
	taskCounts, err := s.repo.CountTasksBySprint(projectID)
	if err != nil {
		taskCounts = make(map[string]int64)
	}
	return sprints, taskCounts, nil
}

func (s *service) Update(id, userID string, updates map[string]interface{}) (*Sprint, error) {
	sprint, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrSprintNotFound
	}
	if !s.canManage(sprint.ProjectID, userID) {
		return nil, ErrNoPermission
	}
	if v, ok := updates["name"]; ok {
		sprint.Name = v.(string)
	}
	if v, ok := updates["goal"]; ok {
		sprint.Goal = v.(string)
	}
	if v, ok := updates["status"]; ok {
		status := v.(string)
		if !validStatuses[status] {
			return nil, ErrInvalidStatus
		}
		// 激活时检查是否已有 active sprint
		if status == "active" && sprint.Status != "active" {
			hasActive, err := s.repo.HasActiveSprint(sprint.ProjectID)
			if err != nil {
				return nil, err
			}
			if hasActive {
				return nil, ErrActiveSprintExists
			}
		}
		sprint.Status = status
	}
	if v, ok := updates["start_date"]; ok {
		if parsed, e := parseDateStr(v.(string)); e == nil {
			sprint.StartDate = parsed
		}
	}
	if v, ok := updates["end_date"]; ok {
		if parsed, e := parseDateStr(v.(string)); e == nil {
			sprint.EndDate = parsed
		}
	}
	if !sprint.EndDate.After(sprint.StartDate) && !sprint.EndDate.Equal(sprint.StartDate) {
		return nil, ErrInvalidDateRange
	}
	if err := s.repo.Update(sprint); err != nil {
		return nil, err
	}
	return s.repo.FindByID(id)
}

func (s *service) Delete(id, userID string) error {
	sprint, err := s.repo.FindByID(id)
	if err != nil {
		return ErrSprintNotFound
	}
	if !s.canManage(sprint.ProjectID, userID) {
		return ErrNoPermission
	}
	return s.repo.Delete(id)
}

// parseDateStr 解析日期字符串，支持 RFC3339 和 YYYY-MM-DD。
func parseDateStr(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}

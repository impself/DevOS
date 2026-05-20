package comment

import "github.com/impself/DevOS/internal/auth"

// Service 评论业务接口。
type Service interface {
	Create(taskID, userID, content string) (*Comment, error)
	List(taskID string) ([]Comment, error)
	Delete(id, userID string) error
}

type service struct {
	repo     Repository
	authRepo auth.Repository
}

// NewService 创建评论 Service 实例。
func NewService(repo Repository, authRepo auth.Repository) Service {
	return &service{repo: repo, authRepo: authRepo}
}

func (s *service) Create(taskID, userID, content string) (*Comment, error) {
	c := &Comment{
		TaskID:  taskID,
		UserID:  userID,
		Content: content,
	}
	if err := s.repo.Create(c); err != nil {
		return nil, err
	}
	// 重新查询以获取 JOIN 字段
	result, err := s.repo.List(taskID)
	if err != nil {
		return nil, err
	}
	for _, r := range result {
		if r.ID == c.ID {
			return &r, nil
		}
	}
	return c, nil
}

func (s *service) List(taskID string) ([]Comment, error) {
	return s.repo.List(taskID)
}

func (s *service) Delete(id, userID string) error {
	isAdmin, _ := s.authRepo.IsAdmin(userID)
	if !isAdmin {
		// 只有管理员可删除评论，后续可扩展为评论作者也可删除
		return ErrNoPermission
	}
	return s.repo.Delete(id)
}

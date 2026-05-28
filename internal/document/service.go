package document

import (
	"github.com/impself/DevOS/internal/auth"
)

// ProjectMembershipChecker 抽象项目成员查询，避免 document 包直接依赖 project 包。
type ProjectMembershipChecker interface {
	IsProjectMember(projectID, userID string) bool
}

// Service 文档业务接口。
type Service interface {
	Create(projectID, userID string, title string, content []byte) (*Document, error)
	Get(projectID, docID, userID string) (*Document, error)
	List(projectID, userID string, search string, page, pageSize int) ([]Document, int64, error)
	Update(projectID, docID, userID string, title string, content []byte) (*Document, error)
	Delete(projectID, docID, userID string) error
}

type service struct {
	repo     Repository
	authRepo auth.Repository
	pmCheck  ProjectMembershipChecker
}

// NewService 创建文档 Service 实例。
func NewService(repo Repository, authRepo auth.Repository, pmCheck ProjectMembershipChecker) Service {
	return &service{repo: repo, authRepo: authRepo, pmCheck: pmCheck}
}

func (s *service) isAdmin(userID string) bool {
	ok, _ := s.authRepo.IsAdmin(userID)
	return ok
}

func (s *service) canAccess(projectID, userID string) bool {
	if s.isAdmin(userID) {
		return true
	}
	if s.pmCheck != nil && s.pmCheck.IsProjectMember(projectID, userID) {
		return true
	}
	return false
}

func (s *service) Create(projectID, userID string, title string, content []byte) (*Document, error) {
	if !s.canAccess(projectID, userID) {
		return nil, ErrNoPermission
	}
	doc := &Document{
		ProjectID: projectID,
		Title:     title,
		Content:   content,
		CreatedBy: userID,
	}
	if err := s.repo.Create(doc); err != nil {
		return nil, err
	}
	return s.repo.FindByID(doc.ID)
}

func (s *service) Get(projectID, docID, userID string) (*Document, error) {
	if !s.canAccess(projectID, userID) {
		return nil, ErrNoPermission
	}
	doc, err := s.repo.FindByID(docID)
	if err != nil {
		return nil, ErrDocumentNotFound
	}
	return doc, nil
}

func (s *service) List(projectID, userID string, search string, page, pageSize int) ([]Document, int64, error) {
	if !s.canAccess(projectID, userID) {
		return nil, 0, ErrNoPermission
	}
	return s.repo.ListByProject(projectID, search, page, pageSize)
}

func (s *service) Update(projectID, docID, userID string, title string, content []byte) (*Document, error) {
	if !s.canAccess(projectID, userID) {
		return nil, ErrNoPermission
	}
	doc, err := s.repo.FindByID(docID)
	if err != nil {
		return nil, ErrDocumentNotFound
	}
	if title != "" {
		doc.Title = title
	}
	if content != nil {
		doc.Content = content
	}
	if err := s.repo.Update(doc); err != nil {
		return nil, err
	}
	return s.repo.FindByID(docID)
}

func (s *service) Delete(projectID, docID, userID string) error {
	if !s.canAccess(projectID, userID) {
		return nil
	}
	_, err := s.repo.FindByID(docID)
	if err != nil {
		return ErrDocumentNotFound
	}
	return s.repo.Delete(docID)
}

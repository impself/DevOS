package main

import (
	"github.com/impself/DevOS/internal/auth"
	"github.com/impself/DevOS/internal/collab"
	"github.com/impself/DevOS/internal/comment"
	"github.com/impself/DevOS/internal/document"
	"github.com/impself/DevOS/internal/project"
	"github.com/impself/DevOS/internal/sprint"
	"github.com/impself/DevOS/internal/tag"
	"github.com/impself/DevOS/internal/task"
	"github.com/impself/DevOS/pkg/config"
	"gorm.io/gorm"
)

// Handlers 持有所有模块的 HTTP handler，供路由注册使用。
type Handlers struct {
	Auth    *auth.Handler
	Project *project.Handler
	Task    *task.Handler
	Tag     *tag.Handler
	Comment *comment.Handler
	Sprint  *sprint.Handler
	Doc     *document.Handler
	Collab  *collab.Handler
}

// Collab 模块依赖注入结果。
type collabDeps struct {
	handler *collab.Handler
	hub     *collab.Hub
}

// setupDI 依赖注入：逐层构建各模块 repo → service → handler。
func setupDI(db *gorm.DB, jwtCfg config.JWTConfig) *Handlers {
	authRepo := auth.NewRepository(db)
	authSvc := auth.NewService(authRepo, jwtCfg)

	projectRepo := project.NewRepository(db)

	tagRepo := tag.NewRepository(db)
	tagSvc := tag.NewService(tagRepo, authRepo, projectRepo)

	taskRepo := task.NewRepository(db)
	taskSvc := task.NewService(taskRepo, authRepo, projectRepo)

	commentRepo := comment.NewRepository(db)
	commentSvc := comment.NewService(commentRepo, authRepo)

	sprintRepo := sprint.NewRepository(db)
	sprintSvc := sprint.NewService(sprintRepo, authRepo, projectRepo)

	docRepo := document.NewRepository(db)
	docSvc := document.NewService(docRepo, authRepo, projectRepo)

	// Collab 模块：Hub + Handler
	cd := setupCollab(docRepo, authRepo, projectRepo, jwtCfg.Secret)

	return &Handlers{
		Auth:    auth.NewHandler(authSvc),
		Project: project.NewHandler(project.NewService(projectRepo, authRepo)),
		Task:    task.NewHandler(taskSvc, tagSvc),
		Tag:     tag.NewHandler(tagSvc),
		Comment: comment.NewHandler(commentSvc),
		Sprint:  sprint.NewHandler(sprintSvc),
		Doc:     document.NewHandler(docSvc),
		Collab:  cd.handler,
	}
}

// setupCollab 构建协同编辑模块，启动 Hub goroutine。
func setupCollab(store collab.StateStore, authRepo auth.Repository, projectRepo project.Repository, jwtSecret string) *collabDeps {
	hub := collab.NewHub()
	go hub.Run()

	access := &accessChecker{authRepo: authRepo, projectRepo: projectRepo}
	handler := collab.NewHandler(hub, store, access, jwtSecret)

	return &collabDeps{handler: handler, hub: hub}
}

// accessChecker 实现 collab.AccessChecker 接口。
type accessChecker struct {
	authRepo    auth.Repository
	projectRepo project.Repository
}

func (a *accessChecker) CanAccessProject(projectID, userID string) bool {
	if ok, _ := a.authRepo.IsAdmin(userID); ok {
		return true
	}
	return a.projectRepo.IsProjectMember(projectID, userID)
}

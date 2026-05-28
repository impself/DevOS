package main

import (
	"github.com/impself/DevOS/internal/auth"
	"github.com/impself/DevOS/internal/comment"
	"github.com/impself/DevOS/internal/document"
	"github.com/impself/DevOS/internal/project"
	"github.com/impself/DevOS/internal/sprint"
	"github.com/impself/DevOS/internal/tag"
	"github.com/impself/DevOS/internal/task"
	"github.com/impself/DevOS/pkg/database"
	"github.com/impself/DevOS/pkg/logger"
)

// autoMigrate 自动迁移数据库表结构，开发阶段使用。
func autoMigrate() {
	if err := database.DB.AutoMigrate(
		&auth.User{},
		&project.Project{}, &project.Member{},
		&task.Task{},
		&comment.Comment{},
		&tag.Tag{}, &tag.TaskTag{},
		&sprint.Sprint{},
		&document.Document{},
	); err != nil {
		logger.L.Fatalf("auto migrate: %v", err)
	}
}

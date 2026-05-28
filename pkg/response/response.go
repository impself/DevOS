// Package response 统一 API 响应格式，提供全局错误码常量和快捷响应函数。
// 所有 handler 通过此包构建 gin.H 响应，确保 code 定义集中管理、一键修改。
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// 全局响应码常量。success 为 int(0)，错误码为 string。
// 前端统一判断 code === 0 为成功。
const (
	CodeSuccess = 0

	// 通用错误码
	CodeValidationError = "VALIDATION_ERROR"
	CodeInternalError   = "INTERNAL_ERROR"
	CodeForbidden       = "FORBIDDEN"
	CodeBadRequest      = "BAD_REQUEST"

	// auth 模块
	CodeUserExists       = "USER_EXISTS"
	CodeUsernameExists   = "USERNAME_EXISTS"
	CodeInvalidCreds     = "INVALID_CREDENTIALS"
	CodeUserNotFound     = "USER_NOT_FOUND"

	// project 模块
	CodeProjectNotFound  = "PROJECT_NOT_FOUND"
	CodeAlreadyMember    = "ALREADY_MEMBER"

	// task 模块
	CodeTaskNotFound     = "TASK_NOT_FOUND"

	// tag 模块
	CodeTagNotFound      = "TAG_NOT_FOUND"

	// sprint 模块
	CodeSprintNotFound   = "SPRINT_NOT_FOUND"

	// document 模块
	CodeDocumentNotFound = "DOCUMENT_NOT_FOUND"
)

// Success 成功响应，HTTP 200，code=0，data 为空时传 nil。
func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"code": CodeSuccess, "message": "success", "data": data})
}

// Created 创建成功响应，HTTP 201，code=0。
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"code": CodeSuccess, "message": "success", "data": data})
}

// OK 无 data 的成功响应，HTTP 200。
func OK(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": CodeSuccess, "message": "success"})
}

// Error 通用错误响应。
// httpStatus: HTTP 状态码，code: 业务错误码（string），message: 人类可读信息。
func Error(c *gin.Context, httpStatus int, code string, message string) {
	c.JSON(httpStatus, gin.H{"code": code, "message": message})
}

// SuccessWithPagination 带分页信息的成功响应，HTTP 200。
func SuccessWithPagination(c *gin.Context, data any, page, pageSize int, total int64) {
	c.JSON(http.StatusOK, gin.H{
		"code":       CodeSuccess,
		"message":    "success",
		"data":       data,
		"pagination": gin.H{"page": page, "page_size": pageSize, "total": total},
	})
}

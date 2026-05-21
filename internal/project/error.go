package project

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrProjectNotFound = errors.New("project not found")
	ErrNoPermission    = errors.New("no permission")
	ErrAlreadyMember   = errors.New("already a member")
	ErrUserNotFound    = errors.New("user not found")
)

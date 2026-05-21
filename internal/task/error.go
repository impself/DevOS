package task

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrTaskNotFound       = errors.New("task not found")
	ErrNoPermission       = errors.New("no permission")
	ErrInvalidStatus      = errors.New("invalid status")
	ErrInvalidPriority    = errors.New("invalid priority")
	ErrInvalidType        = errors.New("invalid type")
	ErrInvalidDueDateFmt  = errors.New("invalid due_date format, use RFC3339 or YYYY-MM-DD")
)

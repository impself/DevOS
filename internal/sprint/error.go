package sprint

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrSprintNotFound    = errors.New("sprint not found")
	ErrNoPermission      = errors.New("no permission")
	ErrInvalidStatus     = errors.New("invalid status, must be planning/active/completed")
	ErrInvalidDateRange  = errors.New("end_date must be after start_date")
	ErrActiveSprintExists = errors.New("project already has an active sprint")
)

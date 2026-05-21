package tag

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrTagNotFound  = errors.New("tag not found")
	ErrNoPermission = errors.New("no permission")
	ErrInvalidColor = errors.New("invalid color, must be hex format like #FF5733")
)

package comment

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrNoPermission = errors.New("no permission")
)

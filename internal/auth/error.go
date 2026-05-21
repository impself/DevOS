package auth

import "errors"

// 业务层哨兵错误，handler 层通过 errors.Is 判断返回对应 HTTP 状态码。
var (
	ErrUserExists     = errors.New("user already exists")
	ErrUsernameExists = errors.New("username already taken")
	ErrInvalidCreds   = errors.New("invalid email or password")
	ErrInvalidToken   = errors.New("invalid token")
)

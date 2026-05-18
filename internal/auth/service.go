package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/impself/DevOS/pkg/config"
	"github.com/impself/DevOS/pkg/middleware"
	"golang.org/x/crypto/bcrypt"
)

// 业务错误定义，handler 层通过 errors.Is 判断返回不同状态码。
var (
	ErrUserExists   = errors.New("user already exists")
	ErrInvalidCreds = errors.New("invalid email or password")
)

// Service 认证业务接口。
type Service interface {
	Register(email, username, password string) (*User, error)
	Login(email, password string) (*LoginResult, error)
	ValidateToken(tokenStr string) (*middleware.Claims, error)
	GetByID(id string) (*User, error)
}

// TokenPair JWT Token 对，包含 access 和 refresh token。
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// LoginUser 登录响应中的用户基本信息。
type LoginUser struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// LoginResult 登录成功后的完整响应，包含 token 对和用户信息。
type LoginResult struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int64     `json:"expires_in"`
	User         LoginUser `json:"user"`
}

type service struct {
	repo   Repository
	jwtCfg config.JWTConfig
}

// NewService 创建认证 Service 实例。
func NewService(repo Repository, jwtCfg config.JWTConfig) Service {
	return &service{repo: repo, jwtCfg: jwtCfg}
}

// Register 注册新用户。检查邮箱唯一性，密码用 bcrypt 加密后存储。
func (s *service) Register(email, username, password string) (*User, error) {
	existing, _ := s.repo.FindByEmail(email)
	if existing != nil {
		return nil, ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		Email:    email,
		Username: username,
		Password: string(hash),
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

// Login 邮箱密码登录，验证通过后返回 token 对和用户信息。
func (s *service) Login(email, password string) (*LoginResult, error) {
	user, err := s.repo.FindByEmail(email)
	if err != nil {
		return nil, ErrInvalidCreds
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}

	tp, err := s.generateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &LoginResult{
		AccessToken:  tp.AccessToken,
		RefreshToken: tp.RefreshToken,
		ExpiresIn:    tp.ExpiresIn,
		User: LoginUser{
			ID:       user.ID,
			Email:    user.Email,
			Username: user.Username,
			Role:     user.Role,
		},
	}, nil
}

// ValidateToken 验证 JWT Token 并返回 Claims。
func (s *service) ValidateToken(tokenStr string) (*middleware.Claims, error) {
	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.jwtCfg.Secret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// GetByID 根据 ID 查询用户。
func (s *service) GetByID(id string) (*User, error) {
	return s.repo.FindByID(id)
}

// generateTokenPair 生成 Access Token + Refresh Token。
func (s *service) generateTokenPair(user *User) (*TokenPair, error) {
	now := time.Now()
	expiresAt := now.Add(time.Duration(s.jwtCfg.AccessExpireMin) * time.Minute)

	claims := &middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return nil, err
	}

	refreshClaims := &middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(s.jwtCfg.RefreshExpireHr) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtCfg.AccessExpireMin * 60),
	}, nil
}

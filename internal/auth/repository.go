package auth

import (
	"fmt"

	"gorm.io/gorm"
)

// Repository 用户数据访问接口。通过接口解耦，方便单元测试 mock。
type Repository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByUsername(username string) (*User, error)
	FindByID(id string) (*User, error)
	// IsAdmin 判断用户是否为系统管理员，用于全局权限检查。
	IsAdmin(userID string) (bool, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建用户 Repository 实例。
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(user *User) error {
	return r.db.Create(user).Error
}

func (r *repository) FindByEmail(email string) (*User, error) {
	var user User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, fmt.Errorf("find by email: %w", err)
	}
	return &user, nil
}

// FindByUsername 根据用户名查询用户，用于注册时查重和项目中按用户名添加成员。
func (r *repository) FindByUsername(username string) (*User, error) {
	var user User
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, fmt.Errorf("find by username: %w", err)
	}
	return &user, nil
}

// IsAdmin 判断用户是否有系统管理员角色。
func (r *repository) IsAdmin(userID string) (bool, error) {
	var user User
	if err := r.db.Where("id = ?", userID).Select("role").First(&user).Error; err != nil {
		return false, fmt.Errorf("is admin: %w", err)
	}
	return user.Role == "admin", nil
}

func (r *repository) FindByID(id string) (*User, error) {
	var user User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, fmt.Errorf("find by id: %w", err)
	}
	return &user, nil
}

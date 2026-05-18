package auth

import (
	"fmt"

	"gorm.io/gorm"
)

// Repository 用户数据访问接口。通过接口解耦，方便单元测试 mock。
type Repository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id string) (*User, error)
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

func (r *repository) FindByID(id string) (*User, error) {
	var user User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, fmt.Errorf("find by id: %w", err)
	}
	return &user, nil
}

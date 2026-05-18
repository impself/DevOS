// Package config 提供统一配置加载能力。
// 从 .env 文件和环境变量读取配置，支持默认值覆盖。
// 不依赖第三方配置库（如 viper），用标准库实现，避免映射问题。
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config 应用全局配置，包含所有子模块配置。
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	OpenAI   OpenAIConfig
}

// ServerConfig HTTP 服务配置。
type ServerConfig struct {
	Port string // 监听端口
	Mode string // 运行模式：debug / release
}

// DatabaseConfig PostgreSQL 连接配置。
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string // 数据库名
	SSLMode  string // disable / require / verify-full
}

// DSN 拼接 PostgreSQL 连接字符串。
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

// RedisConfig Redis 连接配置。
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int // Redis 数据库编号（0-15）
}

// Addr 返回 Redis 地址，格式 host:port。
func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%s", r.Host, r.Port)
}

// JWTConfig JWT 认证配置。
type JWTConfig struct {
	Secret          string // HMAC 签名密钥
	AccessExpireMin int    // Access Token 过期时间（分钟）
	RefreshExpireHr int    // Refresh Token 过期时间（小时）
}

// OpenAIConfig OpenAI API 配置。
type OpenAIConfig struct {
	APIKey string
	Model  string // 模型名称，如 gpt-4o
}

// Load 加载配置。优先级：系统环境变量 > .env 文件 > 默认值。
func Load() (*Config, error) {
	loadDotEnv(".env")

	return &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Mode: getEnv("SERVER_MODE", "debug"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "devos"),
			Password: getEnv("DB_PASSWORD", "devos"),
			DBName:   getEnv("DB_NAME", "devos"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:          getEnv("JWT_SECRET", "change-me"),
			AccessExpireMin: getEnvInt("JWT_ACCESS_EXPIRE_MIN", 30),
			RefreshExpireHr: getEnvInt("JWT_REFRESH_EXPIRE_HR", 168),
		},
		OpenAI: OpenAIConfig{
			APIKey: getEnv("OPENAI_API_KEY", ""),
			Model:  getEnv("OPENAI_MODEL", "gpt-4o"),
		},
	}, nil
}

// loadDotEnv 读取 .env 文件，把 KEY=VALUE 写入环境变量。
// 系统环境变量优先级高于 .env 文件（不会覆盖已有的）。
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range splitLines(string(data)) {
		line = trimSpace(line)
		if line == "" || line[0] == '#' {
			continue
		}
		idx := indexOf(line, '=')
		if idx < 0 {
			continue
		}
		key := trimSpace(line[:idx])
		val := trimSpace(line[idx+1:])
		// 系统环境变量优先
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

// getEnv 读取环境变量，不存在则返回 fallback。
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getEnvInt 读取整型环境变量，不存在或解析失败则返回 fallback。
func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

// --- 以下是不依赖 strings 包的辅助函数 ---

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func indexOf(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

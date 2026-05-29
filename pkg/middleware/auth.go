// Package middleware 提供 Gin HTTP 中间件。
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims JWT Token 中的自定义载荷。
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Auth 返回 JWT 认证中间件。
// 优先从 Authorization: Bearer <token> 头中解析 Token，
// WebSocket 等无法设置 header 的场景回退到 ?token=xxx query param。
// 验证通过后将 userID、email、role 写入 gin.Context。
func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		// 优先从 Authorization header 取 token
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			t := strings.TrimPrefix(authHeader, "Bearer ")
			if t != authHeader {
				tokenStr = t
			}
		}

		// header 没取到，回退到 query param（WebSocket 连接使用）
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "missing authorization header",
			})
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "invalid or expired token",
			})
			return
		}

		// 把用户信息写入 Context，后续 handler 通过 c.GetString("userID") 获取
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}

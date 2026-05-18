package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// visitor 记录单个 IP 的访问计数和最后访问时间。
type visitor struct {
	count    int
	lastSeen time.Time
}

// RateLimit 返回 IP 级固定窗口限流中间件。
// 在 interval 时间窗口内，同一 IP 最多允许 maxRequests 个请求。
// 超出限制返回 429 Too Many Requests。
func RateLimit(maxRequests int, interval time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	// 后台定期清理过期 visitor，防止内存泄漏
	go func() {
		for {
			time.Sleep(interval)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > interval {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		v, exists := visitors[ip]
		if !exists {
			// 首次访问
			visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
			mu.Unlock()
			c.Next()
			return
		}

		// 窗口过期，重置计数
		if time.Since(v.lastSeen) > interval {
			v.count = 1
			v.lastSeen = time.Now()
			mu.Unlock()
			c.Next()
			return
		}

		v.count++
		v.lastSeen = time.Now()
		if v.count > maxRequests {
			mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"code":    "RATE_LIMITED",
				"message": "too many requests",
			})
			return
		}
		mu.Unlock()
		c.Next()
	}
}

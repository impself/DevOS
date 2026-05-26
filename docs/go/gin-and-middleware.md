# Gin Framework & Middleware Patterns

DevOS 使用 Gin 作为 HTTP 框架，配合自定义中间件实现认证、CORS、限流等横切关注点。

---

## 1. Gin 路由组织

### 路由分组

```go
// cmd/server/main.go

r := gin.New()

// 全局中间件
r.Use(gin.Recovery())
r.Use(middleware.CORS())
r.Use(middleware.RateLimit(1000, time.Minute))

// 公开路由 — 无需认证
api := r.Group("/api/v1")
authGroup := api.Group("/auth")
{
    authGroup.POST("/register", authHandler.Register)
    authGroup.POST("/login", authHandler.Login)
}

// 认证路由 — JWT 校验
authed := api.Group("")
authed.Use(middleware.Auth(cfg.JWT.Secret))
{
    // 嵌套路由组：/api/v1/projects/:id/tasks/:taskID/comments
    p := authed.Group("/projects")
    {
        p.POST("/:id/tasks", taskHandler.Create)
        p.POST("/:id/tasks/:taskID/comments", commentHandler.Create)
        // ...
    }
}
```

**RESTful 路由设计：**

| 操作 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建项目 | POST | `/projects` | 无 ID，服务端生成 |
| 列表 | GET | `/projects` | 查询参数过滤 |
| 获取单个 | GET | `/projects/:id` | 路径参数 |
| 更新 | PUT | `/projects/:id` | 全量更新 |
| 删除 | DELETE | `/projects/:id` | 幂等操作 |
| 添加成员 | POST | `/projects/:id/members` | 子资源创建 |
| 更新角色 | PUT | `/projects/:id/members/:memberID/role` | 子资源更新 |

---

## 2. 中间件链

### 执行顺序

```
Request → Recovery → CORS → RateLimit → Auth(可选) → Handler → Response
```

### JWT 认证中间件

```go
// pkg/middleware/auth.go

func Auth(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 提取 Token
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.AbortWithStatusJSON(401, gin.H{"code": "UNAUTHORIZED", "message": "missing authorization header"})
            return
        }

        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenStr == authHeader {
            c.AbortWithStatusJSON(401, gin.H{"code": "UNAUTHORIZED", "message": "invalid format"})
            return
        }

        // 2. 解析验证 Token
        claims := &Claims{}
        token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            c.AbortWithStatusJSON(401, gin.H{"code": "UNAUTHORIZED", "message": "invalid or expired token"})
            return
        }

        // 3. 注入用户信息到 Context
        c.Set("userID", claims.UserID)
        c.Set("email", claims.Email)
        c.Set("role", claims.Role)
        c.Next()
    }
}
```

**关键点：**
- `c.AbortWithStatusJSON()` — 终止后续 handler 执行并返回错误
- `c.Set()` / `c.GetString()` — 在中间件和 handler 之间传递数据
- 返回闭包 `gin.HandlerFunc` — 中间件可以持有配置参数（如 secret）

### CORS 中间件

```go
// pkg/middleware/cors.go
func CORS() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        c.Next()
    }
}
```

### 限流中间件

```go
// pkg/middleware/ratelimit.go
// 基于 Redis 的滑动窗口限流
func RateLimit(maxRequests int, duration time.Duration) gin.HandlerFunc {
    // ...
}
```

---

## 3. Handler 模式

### 统一请求处理流程

```go
func (h *Handler) Create(c *gin.Context) {
    // 1. 提取认证信息
    userID := c.GetString("userID")

    // 2. 解析路径参数
    projectID := c.Param("id")

    // 3. 绑定请求体
    var req CreateReq
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
        return
    }

    // 4. 调用 Service
    result, err := h.svc.Create(projectID, userID, req)
    if err != nil {
        // 5. 错误映射
        switch {
        case errors.Is(err, task.ErrNoPermission):
            response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
        default:
            response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "internal error")
        }
        return
    }

    // 6. 返回成功响应
    response.Created(c, result)
}
```

### 参数获取方式

| 来源 | 方法 | 示例 |
|------|------|------|
| 路径参数 | `c.Param("id")` | `/projects/:id` |
| 查询参数 | `c.Query("page")` | `?page=1` |
| 请求体 | `c.ShouldBindJSON(&req)` | `{"title": "..."}` |
| 认证信息 | `c.GetString("userID")` | JWT 中间件注入 |

---

## 4. 优雅关闭

```go
// cmd/server/main.go

// 在 goroutine 中启动 HTTP 服务
srv := &http.Server{Addr: addr, Handler: r}
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        logger.L.Fatalf("listen: %v", err)
    }
}()

// 主 goroutine 监听关闭信号
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

// 给 5 秒时间处理已有请求
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
srv.Shutdown(ctx)
```

**为什么需要优雅关闭？**
- 直接 `os.Exit` 会中断正在处理的请求，导致客户端收到连接重置
- `Shutdown()` 等待已有请求完成，不再接受新请求
- 5 秒超时防止卡死

---

## 5. 面试常见问题

### Q: Gin 的 `ShouldBindJSON` 和 `BindJSON` 有什么区别？

**A:**
- `ShouldBindJSON` — 解析失败只返回 error，不自动写响应
- `BindJSON` — 解析失败自动写 400 响应并设置 Content-Type
- 项目统一用 `ShouldBindJSON` + 手动响应，控制错误格式

### Q: 中间件中 `c.Next()` 和 `c.Abort()` 的区别？

**A:**
- `c.Next()` — 继续执行链中下一个 handler
- `c.Abort()` — 停止执行后续 handler，但当前函数继续运行
- `c.AbortWithStatusJSON()` — 停止执行 + 写响应，最常用

### Q: 为什么用 `gin.New()` 而不是 `gin.Default()`？

**A:**
- `gin.Default()` 自动附加 Logger 和 Recovery 中间件
- `gin.New()` 不附加任何中间件，完全手动控制
- 项目用 `gin.New()` + `gin.Recovery()` + 自定义日志，不使用 Gin 默认 Logger（用 Zap 代替）

### Q: 如何设计一个接口同时支持 JSON 和表单提交？

**A:**
```go
// ShouldBind 自动根据 Content-Type 选择绑定方式
if err := c.ShouldBind(&req); err != nil { ... }
```

### Q: RESTful API 中 PUT 和 PATCH 的区别？

**A:**
- `PUT` — 全量替换，客户端必须提供完整资源
- `PATCH` — 部分更新，只传需要修改的字段
- 项目使用 `PUT` 但实际是部分更新语义（字段为空则不更新），严格来说应该用 `PATCH`，但业界很多项目都这么做

### Q: 限流中间件的实现方式？

**A:** 项目基于 Redis 的滑动窗口限流：
- 每个客户端 IP 为一个限流维度
- 在 `duration` 时间窗口内最多允许 `maxRequests` 个请求
- 超出限制返回 429 Too Many Requests
- 用 Redis 的 EXPIRE + INCR 实现原子计数

---

## 6. 项目中间件清单

| 中间件 | 文件 | 作用 | 全局/局部 |
|--------|------|------|-----------|
| Recovery | gin 内置 | panic 恢复 | 全局 |
| CORS | middleware/cors.go | 跨域处理 | 全局 |
| RateLimit | middleware/ratelimit.go | 请求限流 | 全局 |
| Auth | middleware/auth.go | JWT 认证 | 局部（authed 路由组） |

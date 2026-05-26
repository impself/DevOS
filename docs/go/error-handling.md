# Go Error Handling Patterns

DevOS 采用 **Sentinel Error + errors.Is()** 模式统一错误处理，配合 `pkg/response` 集中管理 HTTP 响应码。

---

## 1. Sentinel Error 模式

每个模块在 `error.go` 中定义包级错误变量：

```go
// internal/task/error.go
package task

import "errors"

var (
    ErrTaskNotFound    = errors.New("task not found")
    ErrNoPermission    = errors.New("no permission to access this task")
    ErrInvalidStatus   = errors.New("invalid task status")
    ErrInvalidPriority = errors.New("invalid task priority")
    ErrInvalidType     = errors.New("invalid task type")
    ErrInvalidDueDate  = errors.New("invalid due date format, use YYYY-MM-DD")
)
```

**为什么用 `var ErrXxx = errors.New()` 而不是自定义错误类型？**

- 项目错误不需要携带额外信息（如错误码），sentinel error 足够
- `errors.Is()` 做精确匹配，语义清晰
- 自定义错误类型适合需要错误码链或动态信息的场景（如 `os.PathError`）

---

## 2. Service 层：返回 Sentinel Error

Service 是错误的**生产者**：

```go
// internal/task/service.go

func (s *service) Update(projectID, taskID, userID string, req UpdateReq) (*Task, error) {
    // 1. 校验权限 — 可能返回 ErrNoPermission
    isMember, err := s.projectRepo.IsMember(projectID, userID)
    if err != nil {
        return nil, err  // 数据库错误，直接透传
    }
    if !isMember {
        return nil, ErrNoPermission
    }

    // 2. 校验参数 — 可能返回 ErrInvalidXxx
    if req.Status != "" {
        validStatuses := map[string]bool{
            "backlog": true, "todo": true, "in_progress": true,
            "in_review": true, "done": true, "cancelled": true,
        }
        if !validStatuses[req.Status] {
            return nil, ErrInvalidStatus
        }
    }

    // 3. 查找资源 — 可能返回 ErrTaskNotFound
    task, err := s.repo.FindByID(taskID)
    if err != nil {
        return nil, ErrTaskNotFound
    }

    // 4. 执行更新
    return s.repo.Update(taskID, req)
}
```

**原则：Service 只管返回语义化的错误，不关心 HTTP 状态码。**

---

## 3. Handler 层：errors.Is() 匹配 + 响应映射

Handler 是错误的**翻译者**，把 Go error 翻译成 HTTP 响应：

```go
// internal/task/handler.go

func (h *Handler) Update(c *gin.Context) {
    // ... 解析参数 ...

    task, err := h.svc.Update(projectID, taskID, userID, req)
    if err != nil {
        switch {
        case errors.Is(err, task.ErrTaskNotFound):
            response.Error(c, http.StatusNotFound, response.CodeTaskNotFound, err.Error())
        case errors.Is(err, task.ErrNoPermission):
            response.Error(c, http.StatusForbidden, response.CodeForbidden, err.Error())
        case errors.Is(err, task.ErrInvalidStatus),
             errors.Is(err, task.ErrInvalidPriority),
             errors.Is(err, task.ErrInvalidType):
            response.Error(c, http.StatusBadRequest, response.CodeValidationError, err.Error())
        default:
            response.Error(c, http.StatusInternalServerError, response.CodeInternalError, "internal error")
        }
        return
    }

    response.Success(c, task)
}
```

**`errors.Is()` vs `err == ErrXxx`：**

- `errors.Is()` 支持 error chain（如果将来包装了错误，如 `fmt.Errorf("update task: %w", ErrTaskNotFound)`）
- `==` 只匹配同一指针，不支持 chain
- **始终用 `errors.Is()`**，这是 Go 社区最佳实践

---

## 4. 响应码集中管理

`pkg/response/response.go` 统一定义所有业务码：

```go
// pkg/response/response.go

const (
    CodeSuccess         = 0
    CodeValidationError = "VALIDATION_ERROR"
    CodeInternalError   = "INTERNAL_ERROR"
    CodeForbidden       = "FORBIDDEN"
    CodeTaskNotFound    = "TASK_NOT_FOUND"
    CodeTagNotFound     = "TAG_NOT_FOUND"
    CodeSprintNotFound  = "SPRINT_NOT_FOUND"
    // ...
)

// Success 返回成功响应
func Success(c *gin.Context, data interface{}) {
    c.JSON(http.StatusOK, gin.H{
        "code":    CodeSuccess,
        "message": "success",
        "data":    data,
    })
}

// Error 返回错误响应
func Error(c *gin.Context, status int, code, message interface{}) {
    c.JSON(status, gin.H{
        "code":    code,
        "message": message,
    })
}
```

**好处：**
- 修改错误码只需改一处
- 保证前后端错误码一致
- 搜索 `CodeTaskNotFound` 即可找到所有使用点

---

## 5. 错误处理流程图

```
Client Request
    ↓
Handler (解析参数)
    ↓ 参数错误 → response.Error(400)
    ↓
Service (业务逻辑)
    ↓ ErrInvalidXxx → Handler → response.Error(400)
    ↓ ErrNoPermission → Handler → response.Error(403)
    ↓ ErrXxxNotFound → Handler → response.Error(404)
    ↓ 数据库错误 → Handler → response.Error(500)
    ↓
Repository (数据访问)
    ↓ gorm.ErrRecordNotFound → Service → ErrXxxNotFound
    ↓ 连接错误 → Service → 透传到 Handler → 500
```

---

## 6. 面试常见问题

### Q: 为什么不在 Service 层直接返回 HTTP 状态码？

**A:** 关注点分离。Service 是业务逻辑层，不应该知道 HTTP 协议的存在。如果将来加 gRPC 或 CLI 接口，Service 层代码无需改动，只需要写新的 Handler/Adapter。

### Q: `errors.Is()` 和 `errors.As()` 的区别？

**A:**
- `errors.Is(err, target)` — 检查 error chain 中是否有**值相等**的目标错误
- `errors.As(err, target)` — 检查 error chain 中是否有**类型匹配**的错误，并提取到 target 中

```go
// Is — 值匹配
if errors.Is(err, task.ErrTaskNotFound) { ... }

// As — 类型匹配（用于自定义错误类型）
var pathErr *os.PathError
if errors.As(err, &pathErr) {
    fmt.Println(pathErr.Path)  // 可以访问自定义字段
}
```

### Q: 如果错误需要携带上下文信息怎么办？

**A:** 两种方式：

1. `fmt.Errorf("task %s not found in project %s: %w", taskID, projectID, ErrTaskNotFound)` — 用 `%w` 包装，`errors.Is()` 仍然能匹配到 `ErrTaskNotFound`
2. 自定义错误类型 — 当需要结构化信息时：

```go
type TaskError struct {
    TaskID    string
    Operation string
    Err       error
}

func (e *TaskError) Error() string {
    return fmt.Sprintf("%s %s: %v", e.Operation, e.TaskID, e.Err)
}

func (e *TaskError) Unwrap() error { return e.Err }
```

### Q: 为什么用 `switch { case errors.Is(...) }` 而不是 `switch err.Error()`？

**A:**
- `err.Error()` 返回的是字符串，字符串匹配脆弱（改了错误消息就全崩了）
- `errors.Is()` 是类型安全的，编译器帮你检查变量是否存在
- `errors.Is()` 支持 error chain，字符串匹配不支持

---

## 7. 项目中各模块的错误定义

| 模块 | 错误 | 语义 |
|------|------|------|
| auth | `ErrUserExists` | 邮箱已注册 |
| auth | `ErrUsernameExists` | 用户名已占用 |
| auth | `ErrInvalidCreds` | 邮箱或密码错误 |
| auth | `ErrInvalidToken` | Token 无效或过期 |
| project | `ErrProjectNotFound` | 项目不存在 |
| project | `ErrNoPermission` | 无项目访问权限 |
| project | `ErrAlreadyMember` | 用户已是项目成员 |
| task | `ErrTaskNotFound` | 任务不存在 |
| task | `ErrInvalidStatus` | 非法状态值 |
| task | `ErrInvalidPriority` | 非法优先级 |
| task | `ErrInvalidType` | 非法任务类型 |
| tag | `ErrTagNotFound` | 标签不存在 |
| tag | `ErrInvalidColor` | 非法颜色值 |
| sprint | `ErrSprintNotFound` | Sprint 不存在 |
| sprint | `ErrInvalidStatus` | 非法 Sprint 状态 |
| sprint | `ErrInvalidDateRange` | 日期范围无效 |
| sprint | `ErrActiveSprintExists` | 项目已有活跃 Sprint |
| comment | `ErrNoPermission` | 无权限操作评论 |

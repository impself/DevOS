# 模块化单体

## 基础概念

### 是什么

模块化单体（Modular Monolith）是一种架构风格：系统整体部署为一个进程（单体），但内部按照业务领域划分为**高内聚、低耦合**的模块。每个模块有自己独立的数据存储、业务逻辑和 API，模块之间通过明确定义的接口（通常是 Go interface）通信，而不是直接调用彼此的内部代码。

### 为什么选择模块化单体

它是微服务和传统单体之间的**中间地带**：

| 维度 | 传统单体 | 模块化单体 | 微服务 |
|------|---------|-----------|--------|
| 部署 | 1 个进程 | 1 个进程 | N 个进程 |
| 代码组织 | 平铺，模块间随意调用 | 按领域分模块，模块间通过接口 | 独立代码库 |
| 数据库 | 共享数据库，随意 JOIN | 逻辑隔离，模块自有表 | 独立数据库 |
| 拆分成本 | 极高（耦合严重） | 低（接口已隔离） | N/A |
| 运维复杂度 | 低 | 低 | 高（分布式系统） |
| 团队要求 | 低 | 中 | 高 |

### 解决什么问题

- **微服务过早引入的代价**：分布式事务、网络延迟、服务发现、CI/CD 复杂度……在团队小、业务未定型时不值得
- **传统单体腐化**：所有代码互相依赖，改一个功能牵一发动全身，最终变成"大泥球"（Big Ball of Mud）
- **未来拆分的灵活性**：模块化单体因为模块边界清晰，当业务量和团队增长后，可以逐个模块拆成微服务

---

## 核心用法

### Go 项目中的模块化单体结构

```
devos/
├── cmd/
│   └── api/
│       └── main.go              ← 唯一入口，组装所有模块
├── internal/
│   ├── module/
│   │   ├── user/                ← 用户模块
│   │   │   ├── domain.go        ← 领域模型
│   │   │   ├── repository.go    ← 数据访问接口 + 实现
│   │   │   ├── service.go       ← 业务逻辑
│   │   │   ├── handler.go       ← HTTP handler
│   │   │   └── module.go        ← 模块注册入口
│   │   ├── workspace/           ← 工作空间模块
│   │   │   ├── domain.go
│   │   │   ├── repository.go
│   │   │   ├── service.go
│   │   │   ├── handler.go
│   │   │   └── module.go
│   │   └── project/             ← 项目模块
│   │       ├── domain.go
│   │       ├── repository.go
│   │       ├── service.go
│   │       ├── handler.go
│   │       └── module.go
│   └── platform/                ← 平台层（跨模块基础设施）
│       ├── database/
│       ├── middleware/
│       └── eventbus/
├── pkg/
│   └── response/
├── go.mod
└── Makefile
```

### 模块定义：用 interface 定义模块边界

每个模块对外暴露接口，隐藏内部实现：

```go
// internal/module/user/module.go
package user

import (
    "context"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// Module 接口定义了用户模块对外暴露的能力
type Module interface {
    // 对其他模块提供的业务能力
    GetUser(ctx context.Context, id string) (*UserDTO, error)
    GetUserByEmail(ctx context.Context, email string) (*UserDTO, error)

    // 注册 HTTP 路由
    RegisterRoutes(r *gin.RouterGroup)
}

// UserDTO 是跨模块传输的数据结构，不暴露内部 domain
type UserDTO struct {
    ID    string `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
}
```

```go
// internal/module/user/module.go（续）— 实现
type module struct {
    repo    Repository
    service *Service
    handler *Handler
}

func NewModule(db *gorm.DB, eventBus EventBus) Module {
    repo := NewRepository(db)
    svc := NewService(repo, eventBus)
    handler := NewHandler(svc)

    return &module{
        repo:    repo,
        service: svc,
        handler: handler,
    }
}

func (m *module) GetUser(ctx context.Context, id string) (*UserDTO, error) {
    user, err := m.service.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }
    return &UserDTO{
        ID:    user.ID,
        Email: user.Email,
        Name:  user.Name,
    }, nil
}

func (m *module) GetUserByEmail(ctx context.Context, email string) (*UserDTO, error) {
    user, err := m.service.GetByEmail(ctx, email)
    if err != nil {
        return nil, err
    }
    return &UserDTO{
        ID:    user.ID,
        Email: user.Email,
        Name:  user.Name,
    }, nil
}

func (m *module) RegisterRoutes(r *gin.RouterGroup) {
    r.POST("/users", m.handler.Create)
    r.GET("/users/:id", m.handler.GetByID)
    r.PUT("/users/:id", m.handler.Update)
    r.DELETE("/users/:id", m.handler.Delete)
}
```

### 模块间通信：通过接口而非直接依赖

```go
// internal/module/workspace/service.go
package workspace

import (
    "context"
    "fmt"
    user "github.com/yourname/devos/internal/module/user"
)

type Service struct {
    repo     Repository
    userMod  user.Module // ← 依赖接口，不依赖实现
}

func NewService(repo Repository, userMod user.Module) *Service {
    return &Service{
        repo:    repo,
        userMod: userMod,
    }
}

func (s *Service) AddMember(ctx context.Context, workspaceID, userID string) error {
    // 通过接口调用用户模块，而非直接操作用户数据库
    userInfo, err := s.userMod.GetUser(ctx, userID)
    if err != nil {
        return fmt.Errorf("user not found: %w", err)
    }

    ws, err := s.repo.GetByID(ctx, workspaceID)
    if err != nil {
        return fmt.Errorf("workspace not found: %w", err)
    }

    // 业务逻辑：检查是否已加入
    for _, m := range ws.Members {
        if m.UserID == userID {
            return fmt.Errorf("user %s already in workspace", userInfo.Email)
        }
    }

    return s.repo.AddMember(ctx, workspaceID, userID)
}
```

### 组装：main.go 中完成依赖注入

```go
// cmd/api/main.go
package main

import (
    "log"

    "github.com/yourname/devos/internal/module/user"
    "github.com/yourname/devos/internal/module/workspace"
    "github.com/yourname/devos/internal/module/project"
    "github.com/yourname/devos/internal/platform/database"
    "github.com/yourname/devos/internal/platform/middleware"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

func main() {
    // 基础设施初始化
    db := database.MustConnect("configs/dev.yaml")

    // 事件总线（用于模块间异步通信）
    eventBus := NewInMemoryEventBus()

    // 模块初始化（注意顺序：无依赖的先初始化）
    userMod := user.NewModule(db, eventBus)
    workspaceMod := workspace.NewModule(db, eventBus, userMod)
    projectMod := project.NewModule(db, eventBus, workspaceMod, userMod)

    // HTTP 路由注册
    r := gin.Default()
    r.Use(middleware.CORS(), middleware.Logger())

    api := r.Group("/api/v1")
    userMod.RegisterRoutes(api)
    workspaceMod.RegisterRoutes(api)
    projectMod.RegisterRoutes(api)

    log.Fatal(r.Run(":8080"))
}
```

### 事件总线：模块间异步解耦

```go
// internal/platform/eventbus/eventbus.go
package eventbus

import (
    "sync"
)

type Event struct {
    Topic string
    Data  interface{}
}

type Handler func(event Event)

type EventBus interface {
    Publish(event Event)
    Subscribe(topic string, handler Handler)
}

type inMemoryEventBus struct {
    mu       sync.RWMutex
    handlers map[string][]Handler
}

func NewInMemoryEventBus() EventBus {
    return &inMemoryEventBus{
        handlers: make(map[string][]Handler),
    }
}

func (b *inMemoryEventBus) Publish(event Event) {
    b.mu.RLock()
    handlers := b.handlers[event.Topic]
    b.mu.RUnlock()

    for _, h := range handlers {
        go h(event) // 异步执行，不阻塞发布者
    }
}

func (b *inMemoryEventBus) Subscribe(topic string, handler Handler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers[topic] = append(b.handlers[topic], handler)
}
```

```go
// internal/module/workspace/module.go — 订阅用户创建事件
func (m *module) initSubscriptions(bus eventbus.EventBus) {
    bus.Subscribe("user.created", func(e eventbus.Event) {
        // 为新用户创建默认 workspace
        data := e.Data.(UserCreatedData)
        ctx := context.Background()
        m.service.CreateDefaultWorkspace(ctx, data.UserID)
    })
}
```

### 模块的数据隔离

每个模块管理自己的数据库表，不直接查询其他模块的表：

```go
// internal/module/user/repository.go — 用户模块的表
func (r *repository) AutoMigrate(db *gorm.DB) error {
    return db.AutoMigrate(
        &User{},
        &UserProfile{},
        &UserSetting{},
    )
}

// internal/module/workspace/repository.go — 工作空间模块的表
func (r *repository) AutoMigrate(db *gorm.DB) error {
    return db.AutoMigrate(
        &Workspace{},
        &WorkspaceMember{},
        &WorkspaceInvitation{},
    )
}
```

**禁止**在 workspace 模块中写 `SELECT * FROM users WHERE id = ?`，而是通过 `userMod.GetUser()` 调用。

---

## 核心思想 / 设计原理

### 1. 为什么 Go interface 天然适合模块化单体

Go 的接口是**隐式实现**（duck typing）——结构体不需要声明 `implements Interface`，只要方法签名匹配即可。这意味着：

- 模块 A 定义接口，模块 B 提供实现，两者之间**零编译依赖**
- 测试时可以用 mock 实现轻松替换
- 未来拆成微服务时，接口实现从"本地方法调用"换成"HTTP/gRPC 调用"，调用方无需改动

```go
// 今天：本地调用
type localUserModule struct { /* ... */ }
func (m *localUserModule) GetUser(ctx context.Context, id string) (*UserDTO, error) {
    return m.service.GetByID(ctx, id)
}

// 明天：远程调用（拆为微服务后）
type remoteUserModule struct {
    client *http.Client
    baseURL string
}
func (m *remoteUserModule) GetUser(ctx context.Context, id string) (*UserDTO, error) {
    resp, err := m.client.Get(m.baseURL + "/users/" + id)
    // ... 反序列化
}
```

### 2. 模块化单体与 DDD（领域驱动设计）的关系

模块化单体借鉴了 DDD 的核心概念：

| DDD 概念 | 模块化单体中的对应 |
|---------|-----------------|
| 限界上下文（Bounded Context） | 一个 `module/xxx/` 目录 |
| 聚合根（Aggregate Root） | `domain.go` 中的核心实体 |
| 领域事件（Domain Event） | `eventbus` 发布的事件 |
| 上下文映射（Context Map） | 模块间的 interface 定义 |
| 反腐败层（Anti-Corruption Layer） | DTO 转换层 |

但不需要完全照搬 DDD 的所有概念（如 CQRS、Event Sourcing），选择适合团队规模的部分即可。

### 3. 何时从模块化单体拆分为微服务

**信号指标**：

| 信号 | 说明 |
|------|------|
| 单一部署瓶颈 | 某个模块负载远超其他，但必须整体扩容 |
| 团队规模 | 超过 2-pizza team（6-8 人），模块归属不清晰 |
| 独立发布需求 | 某个模块需要一天发布多次，其他模块一周一次 |
| 技术栈差异 | 某个模块需要用不同语言或框架（如 ML 推理用 Python） |
| 故障隔离 | 某个模块容易出问题，影响整个系统 |

**拆分策略**（Strangler Fig Pattern）：

1. 先将目标模块的 interface 实现替换为 HTTP/gRPC 客户端
2. 部署独立的微服务
3. 逐步迁移数据
4. 下线旧模块代码

因为模块化单体的模块边界本身就是 interface，第 1 步的替换成本极低。

### 4. 模块化单体的数据一致性策略

由于共享同一个数据库（但逻辑隔离），模块化单体的数据一致性比微服务简单：

- **同一事务内**：如果两个模块的写操作必须在同一事务，说明模块边界可能划分有误——重新审视限界上下文
- **最终一致性**：通过事件总线实现，这在拆为微服务后仍然适用
- **Saga 模式**：复杂的跨模块事务可以用编排式 Saga

---

## 常见面试题

### Q1: 模块化单体和微服务到底该选哪个？你们团队是怎么决策的？

**参考答案**：

决策的核心是**团队规模**和**业务成熟度**，不是技术时髦度。

选择模块化单体的场景：
- 团队小于 20 人，没有独立的 DevOps/SRE 团队
- 业务领域还在探索中，边界经常变动
- 项目初期 MVP 阶段，需要快速迭代
- 基础设施能力有限（没有 Kubernetes、服务网格等）

选择微服务的场景：
- 团队超过 20 人，需要独立部署
- 不同业务模块的负载差异巨大（如搜索模块需要独立扩容）
- 业务领域已经稳定，边界清晰
- 有成熟的 DevOps 流程和基础设施

**我的实际经验**：在 DevOS 项目中选择了模块化单体，因为初期团队小、业务边界还在探索。用 Go interface 定义模块边界，未来需要时可以逐个模块拆分为微服务，成本很低。

### Q2: 模块化单体中两个模块需要同一个数据库事务怎么办？

**参考答案**：

这是一个关键的设计问题，有三种处理方式：

1. **重新审视模块边界**（首选）：如果两个模块经常需要在同一事务中操作，可能说明它们应该合并为一个模块。模块划分应该与业务边界对齐，而不是技术边界。

2. **引入 Saga 模式**：用编排式 Saga 协调跨模块操作，每个步骤独立事务，失败时执行补偿操作：
   ```go
   // Saga: 创建工作空间 + 添加创建者为管理员
   func (s *Service) CreateWorkspaceSaga(ctx context.Context, req CreateWorkspaceReq) error {
       // Step 1: 创建 workspace（独立事务）
       ws, err := s.repo.Create(ctx, req)
       if err != nil {
           return err
       }

       // Step 2: 添加创建者为管理员（独立事务）
       err = s.repo.AddMember(ctx, ws.ID, req.CreatorID, RoleAdmin)
       if err != nil {
           // Compensating: 删除已创建的 workspace
           s.repo.Delete(ctx, ws.ID)
           return err
       }

       return nil
   }
   ```

3. **接受最终一致性**：通过事件总线异步处理，两个模块各自在自己的事务中操作，通过事件通知对端。

### Q3: 你怎么保证模块之间不会"暗中耦合"？

**参考答案**：

这是模块化单体最大的风险——开发者图方便，直接 import 另一个模块的内部代码。防范措施：

1. **编译器级别的隔离**：把每个模块放在独立的 `internal/` 目录下：
   ```
   internal/module/user/internal/   ← 用户模块私有代码
   internal/module/user/module.go   ← 用户模块公共接口
   ```
   其他模块只能 import `internal/module/user` 包（即接口），不能 import `internal/module/user/internal/`。

2. **代码审查**：PR 中检查是否有跨模块的直接数据库查询或内部结构体引用。

3. **架构测试**：写一个测试用例，用 Go 的 `go/types` 包扫描 import 图，确保没有违规依赖：
   ```go
   // Test: workspace 模块不应该直接 import user 模块的 repository
   func TestModuleDependencies(t *testing.T) {
       // 用 go/packages 加载所有包
       // 检查 workspace 包的 import 列表中
       // 不包含 user/internal/... 的路径
   }
   ```

4. **DTO 隔离**：模块间只传递 DTO（Data Transfer Object），不传递内部 domain 模型。这样即使内部模型重构，也不会影响其他模块。

### Q4: 事件总线的 reliability 怎么保证？如果在内存事件总线中 goroutine panic 了怎么办？

**参考答案**：

内存事件总线的局限在于：进程重启会丢失未处理的事件，goroutine panic 会导致事件丢失。解决方案分阶段升级：

**第一阶段（MVP）**：内存事件总线 + recover + 日志
```go
func (b *inMemoryEventBus) Publish(event Event) {
    b.mu.RLock()
    handlers := b.handlers[event.Topic]
    b.mu.RUnlock()

    for _, h := range handlers {
        go func(handler Handler) {
            defer func() {
                if r := recover(); r != nil {
                    log.Printf("event handler panic: topic=%s, err=%v", event.Topic, r)
                }
            }()
            handler(event)
        }(h)
    }
}
```

**第二阶段（生产级）**：基于 Redis Streams 的持久化事件总线
```go
func (b *redisEventBus) Publish(ctx context.Context, event Event) error {
    data, _ := json.Marshal(event.Data)
    return b.client.XAdd(ctx, &redis.XAddArgs{
        Stream: event.Topic,
        Values: map[string]interface{}{
            "data":    data,
            "traceID": getTraceID(ctx),
        },
    }).Err()
}
```

这样即使进程重启，事件也不会丢失，消费者可以继续消费未处理的消息。

### Q5: 模块化单体如何做测试？单元测试和集成测试的策略是什么？

**参考答案**：

分三层测试策略：

**1. 模块单元测试**（最高覆盖率）：

每个模块的 service 层测试，用 mock 替换依赖的其他模块接口：

```go
func TestWorkspaceService_AddMember(t *testing.T) {
    // Mock 用户模块
    mockUser := &MockUserModule{}
    mockUser.On("GetUser", mock.Anything, "user-1").
        Return(&user.UserDTO{ID: "user-1", Email: "test@example.com"}, nil)

    // Mock repository
    mockRepo := &MockWorkspaceRepo{}
    mockRepo.On("GetByID", mock.Anything, "ws-1").
        Return(&Workspace{ID: "ws-1", Members: []Member{}}, nil)
    mockRepo.On("AddMember", mock.Anything, "ws-1", "user-1").
        Return(nil)

    svc := NewService(mockRepo, mockUser)
    err := svc.AddMember(context.Background(), "ws-1", "user-1")

    assert.NoError(t, err)
    mockUser.AssertExpectations(t)
    mockRepo.AssertExpectations(t)
}
```

**2. 模块集成测试**（用真实数据库）：

启动测试数据库，验证模块间交互：

```go
func TestUserCreatedTriggersDefaultWorkspace(t *testing.T) {
    db := setupTestDB(t)
    bus := eventbus.NewInMemoryEventBus()

    userMod := user.NewModule(db, bus)
    wsMod := workspace.NewModule(db, bus, userMod)

    // 创建用户
    createdUser, err := userMod.Register(ctx, "test@example.com", "Test")
    require.NoError(t, err)

    // 等待事件处理
    time.Sleep(100 * time.Millisecond)

    // 验证默认 workspace 被创建
    ws, err := wsMod.GetByOwner(ctx, createdUser.ID)
    assert.NoError(t, err)
    assert.NotNil(t, ws)
}
```

**3. API 端到端测试**：

启动完整 HTTP 服务，发送真实请求。

模块化单体的测试优势在于：不需要启动多个进程、不需要处理网络问题，集成测试成本远低于微服务。

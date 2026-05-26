# Dependency Injection & Layered Architecture

DevOS 采用 **构造函数注入 + 接口解耦** 实现依赖注入，配合 **Repository → Service → Handler** 三层架构，实现模块间松耦合。

---

## 1. 三层架构概览

```
Handler (HTTP 层)
  ↕ 只依赖 Service 接口
Service (业务逻辑层)
  ↕ 只依赖 Repository 接口 + 其他 Service 接口
Repository (数据访问层)
  ↕ 直接操作 GORM/DB
```

**每层职责：**

| 层 | 职责 | 文件 | 关键类型 |
|---|---|---|---|
| Handler | 参数校验、HTTP 响应、路由 | `handler.go` | `type Handler struct` |
| Service | 业务规则、权限校验、跨模块协调 | `service.go` | `type Service interface` |
| Repository | SQL/GORM 操作、数据持久化 | `repository.go` | `type Repository interface` |

---

## 2. 构造函数注入模式

每个模块遵循统一的注入链：

```go
// cmd/server/main.go — DI 入口

// 步骤 1: Repository 接收 DB 实例
authRepo := auth.NewRepository(database.DB)

// 步骤 2: Service 接收 Repository + 配置
authSvc := auth.NewService(authRepo, cfg.JWT)

// 步骤 3: Handler 接收 Service
authHandler := auth.NewHandler(authSvc)
```

**构造函数签名规范：**

```go
// Repository — 只接收 *gorm.DB
func NewRepository(db *gorm.DB) Repository {
    return &repository{db: db}
}

// Service — 接收需要的 Repo + 外部依赖（接口）
func NewService(repo Repository, jwtCfg config.JWTConfig) Service {
    return &service{repo: repo, jwtCfg: jwtCfg}
}

// Handler — 只接收 Service 接口
func NewHandler(svc Service) *Handler {
    return &Handler{svc: svc}
}
```

**核心原则：构造函数只接收接口，不接收具体实现。**

---

## 3. 接口解耦：跨模块通信

模块之间不直接 import 对方的 struct，而是定义**最小接口**：

```go
// internal/tag/service.go — tag 模块需要校验用户是否为项目成员

// ProjectMembershipChecker 定义 tag 模块所需的最小权限接口
type ProjectMembershipChecker interface {
    IsMember(projectID, userID string) (bool, error)
}

type service struct {
    repo        Repository
    authRepo    UserChecker
    projectRepo ProjectMembershipChecker
}
```

**为什么不用 `project.Service` 接口？**

- `project.Service` 可能包含 20+ 方法，tag 模块只需 `IsMember()` 一个
- 接口应该按**消费者需求**定义，不是按提供者能力定义（ISP 原则）
- 这样 tag 模块可以在测试中 mock 一个只实现 `IsMember()` 的对象

**实际跨模块依赖图：**

```
tag.Service    → authRepo (UserChecker)     → auth.Repository
               → projectRepo (MembershipChecker) → project.Repository

task.Service   → authRepo (UserChecker)
               → projectRepo (MembershipChecker)
               → tagSvc (TagFetcher)        → tag.Service

sprint.Service → authRepo (UserChecker)
               → projectRepo (MembershipChecker)
```

---

## 4. 接口定义位置

接口定义在**消费方**（不是提供方）：

```go
// internal/tag/service.go — tag 模块定义自己需要什么
type UserChecker interface {
    FindByID(id string) (*auth.User, error)
}

// internal/auth/repository.go — auth 模块提供实现
// auth.Repository 接口隐式满足 tag.UserChecker
```

Go 的隐式接口满足（structural typing）让这种模式零成本实现：提供方不需要 `implements` 声明。

---

## 5. main.go 作为 DI 容器

`cmd/server/main.go` 承担了 DI 容器的角色：

```go
// 所有依赖在 main 中一次性组装
// 模块内部互不知道对方的具体实现

projectSvc := project.NewService(projectRepo, authRepo)
tagSvc := tag.NewService(tagRepo, authRepo, projectRepo)
taskSvc := task.NewService(taskRepo, authRepo, projectRepo)

// taskSvc 还需要 tagSvc 来处理标签关联
taskHandler := task.NewHandler(taskSvc, tagSvc)
```

**为什么不用 DI 框架（wire/dig）？**

- 项目规模适中（6 个模块），手动注入可读性更好
- 依赖关系一目了然，不需要学习框架语法
- 编译时就能发现注入错误，而非运行时

---

## 6. 面试常见问题

### Q: 为什么用接口而不用具体类型？

**A:** 三个原因：
1. **解耦** — 修改 auth.Repository 实现不需要改 tag 模块代码
2. **可测试** — mock 一个只实现必要方法的假对象
3. **ISP 原则** — 消费者只看到它需要的方法，不被无关方法污染

### Q: Repository 模式有什么好处？

**A:**
- 数据访问逻辑集中在一处，Service 不写 SQL
- 可以替换底层存储（比如从 PostgreSQL 换成 MongoDB）只需改 Repository 实现
- 方便对 Service 层做单元测试，mock Repository 即可

### Q: 如果模块 A 需要模块 B 的功能，B 也需要 A 的功能，怎么处理循环依赖？

**A:**
1. **提取共享接口到独立包** — 把共同需要的接口定义在 `internal/shared/` 或更上层的 `pkg/`
2. **事件驱动** — A 发事件，B 订阅事件，不直接调用
3. **重新审视设计** — 循环依赖通常暗示职责划分有问题，考虑合并或拆分

### Q: 为什么 Handler 不直接操作数据库？

**A:**
- Handler 只负责 HTTP 协议相关的事（解析请求、构建响应）
- 业务逻辑在 Service 中可被多个 Handler 复用
- 分层让每层职责单一，修改一层不影响其他层（SRP）

---

## 7. 项目中的实际案例

### Tag 模块的完整 DI 链

```go
// main.go
tagRepo := tag.NewRepository(database.DB)          // DB → Repo
tagSvc := tag.NewService(tagRepo, authRepo, projectRepo)  // Repo + 外部接口 → Service
tagHandler := tag.NewHandler(tagSvc)                // Service → Handler
```

### Task 模块依赖两个 Service

```go
// task handler 需要同时操作 task 和 tag
taskSvc := task.NewService(taskRepo, authRepo, projectRepo)
taskHandler := task.NewHandler(taskSvc, tagSvc)  // tagSvc 用于获取任务的标签列表
```

这种设计让 task 模块在处理标签时，不需要知道 tag 模块的内部实现。

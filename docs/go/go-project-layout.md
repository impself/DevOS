# Go 项目结构

## 基础概念

### 是什么

Go 项目布局约定（Project Layout）是 Go 社区沉淀下来的一套目录组织规范。它不是语言强制要求，而是被广泛采纳的最佳实践，最知名的参考是 [golang-standards/project-layout](https://github.com/golang-standards/project-layout)。

### 为什么要统一项目结构

- **团队协作**：新人一眼就能理解代码在哪、职责是什么
- **依赖管控**：`internal` 目录从编译器层面阻止外部导入，保护内部实现
- **可复用性**：`pkg` 目录集中公共库，方便跨项目引用
- **构建产物清晰**：`cmd` 目录下的每个子目录对应一个可编译的二进制文件

### 解决什么问题

解决 Go 项目缺乏框架级目录约束带来的混乱——没有规范的项目容易变成"平铺式"文件堆砌，import 关系失控，内部实现被外部意外依赖后难以重构。

---

## 核心用法

### 标准目录结构总览

```
myproject/
├── cmd/                    # 应用入口
│   ├── api/                # API 服务
│   │   └── main.go
│   ├── worker/             # 后台任务
│   │   └── main.go
│   └── cli/                # CLI 工具
│       └── main.go
├── internal/               # 私有代码（编译器强制）
│   ├── domain/             # 领域模型 / 实体
│   │   ├── user.go
│   │   └── workspace.go
│   ├── service/            # 业务逻辑层
│   │   ├── user_service.go
│   │   └── workspace_service.go
│   ├── repository/         # 数据访问层
│   │   ├── user_repo.go
│   │   └── workspace_repo.go
│   ├── handler/            # HTTP handler / controller
│   │   ├── user_handler.go
│   │   └── middleware.go
│   └── config/             # 配置加载
│       └── config.go
├── pkg/                    # 公共库（可被外部 import）
│   ├── logger/
│   │   └── logger.go
│   └── response/
│       └── response.go
├── api/                    # API 定义（OpenAPI / Proto）
│   └── openapi.yaml
├── configs/                # 配置文件
│   ├── dev.yaml
│   └── prod.yaml
├── scripts/                # 构建/部署脚本
├── test/                   # 集成测试、e2e 测试
├── docs/                   # 项目文档
├── go.mod
├── go.sum
├── Makefile
└── .golangci.yml
```

### cmd 目录：应用入口

每个子目录对应一个 `main` 包，只做"组装"——初始化配置、注入依赖、启动服务。

```go
// cmd/api/main.go
package main

import (
    "log"

    "myproject/internal/config"
    "myproject/internal/handler"
    "myproject/internal/repository"
    "myproject/internal/service"

    "github.com/gin-gonic/gin"
)

func main() {
    // 1. 加载配置
    cfg, err := config.Load("configs/dev.yaml")
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    // 2. 初始化数据层
    userRepo := repository.NewUserRepo(cfg.DB)

    // 3. 注入到业务层
    userSvc := service.NewUserService(userRepo)

    // 4. 注册 HTTP handler
    userHandler := handler.NewUserHandler(userSvc)

    // 5. 启动服务
    r := gin.Default()
    api := r.Group("/api/v1")
    {
        api.POST("/users", userHandler.Create)
        api.GET("/users/:id", userHandler.GetByID)
    }

    log.Fatal(r.Run(":8080"))
}
```

### internal 目录：编译器强制私有

**核心规则**：Go 编译器会阻止 `internal/` 内的包被其父目录树之外的代码 import。

```
github.com/example/myproject/
├── internal/
│   └── service/
│       └── user.go        ← 包名: service
├── cmd/
│   └── api/
│       └── main.go         ✅ 可以 import internal/service
```

```
github.com/otherproject/
└── main.go                  ❌ 不能 import github.com/example/myproject/internal/service
```

`internal` 的可见性边界由**目录树的最近父级**决定：

```
myproject/
├── pkg/
│   └── mylib/
│       └── internal/        ← 只对 pkg/mylib/ 内可见
│           └── secret.go
│       └── public.go        ✅ 可以 import pkg/mylib/internal
├── internal/                ← 对整个 myproject 可见
│   └── domain/
```

### pkg 目录：可复用公共库

`pkg` 没有编译器强制，只是一个**约定**。放这里意味着"这些代码足够通用，外部项目也可以用"。

```go
// pkg/response/response.go
package response

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

type APIResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
    c.JSON(http.StatusOK, APIResponse{
        Code:    0,
        Message: "success",
        Data:    data,
    })
}

func Error(c *gin.Context, httpStatus int, msg string) {
    c.JSON(httpStatus, APIResponse{
        Code:    httpStatus,
        Message: msg,
    })
}
```

### internal 中的分层架构示例

```go
// internal/domain/user.go — 领域模型，纯结构体，不依赖任何框架
package domain

import "time"

type User struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

```go
// internal/repository/user_repo.go — 数据访问层，依赖 domain 模型
package repository

import (
    "context"
    "myproject/internal/domain"
    "gorm.io/gorm"
)

type UserRepository interface {
    Create(ctx context.Context, user *domain.User) error
    GetByID(ctx context.Context, id string) (*domain.User, error)
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
}

type userRepository struct {
    db *gorm.DB
}

func NewUserRepo(db *gorm.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
    return r.db.WithContext(ctx).Create(user).Error
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
    var user domain.User
    if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
    var user domain.User
    if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
        return nil, err
    }
    return &user, nil
}
```

```go
// internal/service/user_service.go — 业务逻辑层，依赖 domain 和 repository 接口
package service

import (
    "context"
    "fmt"
    "myproject/internal/domain"
    "myproject/internal/repository"
)

type UserService struct {
    userRepo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) *UserService {
    return &UserService{userRepo: repo}
}

func (s *UserService) Register(ctx context.Context, email, name string) (*domain.User, error) {
    // 业务规则：检查邮箱是否已注册
    existing, err := s.userRepo.GetByEmail(ctx, email)
    if err == nil && existing != nil {
        return nil, fmt.Errorf("email %s already registered", email)
    }

    user := &domain.User{
        Email: email,
        Name:  name,
    }

    if err := s.userRepo.Create(ctx, user); err != nil {
        return nil, fmt.Errorf("failed to create user: %w", err)
    }

    return user, nil
}
```

### go.mod 中的 module 路径

```go
// go.mod
module github.com/yourname/devos

go 1.23
```

```go
// 任何文件中的 import 路径
import (
    "github.com/yourname/devos/internal/domain"
    "github.com/yourname/devos/pkg/response"
)
```

---

## 核心思想 / 设计原理

### 1. internal 的编译器实现原理

Go 编译器在解析 import 时，会执行 `internal` 包可见性检查（在 `go/build` 包的 `isLocalImport` 和 `Import` 方法中实现）：

- 当遇到一个包含 `internal` 路径段的 import 时，编译器会检查 import 的发起者是否在 `internal` 的**父目录树**内
- 这个检查发生在 `go/build.readGoImports` 和相关的包加载阶段
- 规则来自 Go 1.4 的 [internal packages proposal](https://go.dev/s/go14internal)

关键理解：`internal` 不是文件系统的权限控制，而是**编译器的 import 路径检查**。如果你通过 `replace` 指令把项目拉到同一个 module 下，`internal` 就可以被访问了。

### 2. 为什么 Go 没有像 Java/C# 那样的"框架级"目录规范

Go 的设计哲学是**约定优于配置，简洁优于复杂**：

- 没有 class，没有继承，所以不需要 `models/`、`controllers/`、`views/` 这样的 MVC 强制约束
- 包的可见性只用首字母大小写控制（大写导出，小写私有），而不是 `public`/`private`/`protected`
- `go fmt` 统一了代码风格，社区不再争论花括号放哪

### 3. cmd / internal / pkg 的分层逻辑

```
依赖方向（单向）：

cmd/main.go  →  internal/*  →  domain
                  ↑
              pkg/*（工具库，被 internal 调用）

绝不允许：domain 依赖 service 或 repository
绝不允许：internal 依赖 cmd
```

这是**依赖倒置原则（DIP）** 的体现：`domain` 层是核心，它不依赖任何外部层；`service` 和 `repository` 依赖 `domain`，而不是反过来。

### 4. 什么时候该用 pkg，什么时候不用

社区有两种观点：

| 观点 | 说明 |
|------|------|
| 用 `pkg` | 明确区分"公共 API"和"内部实现"，方便开源项目控制 API 表面积 |
| 不用 `pkg` | Google 内部项目不用 `pkg`，直接放顶层。如果整个项目不对外开源，`pkg` 没有意义 |

**实际建议**：如果你的项目是**库（library）**或**开源项目**，用 `pkg` 区分；如果是**应用（application）**，可以简化为 `internal/` + `cmd/` 即可。

---

## 常见面试题

### Q1: Go 的 internal 目录是怎么实现"私有化"的？如果我硬要用 go get 拉取一个 internal 包会怎样？

**参考答案**：

`internal` 的私有化是 Go **编译器级别**的约束，不是文件系统权限。具体机制：

1. 当 Go 编译器解析 `import "github.com/x/project/internal/foo"` 时，会检查 import 发起者所在包的路径是否是 `internal` 目录的**父目录或父目录的子目录**
2. 如果不是，编译报错：`use of internal package ... not allowed`
3. `go get` 可以下载代码，但任何尝试 import 该 `internal` 包的代码都会编译失败

这个规则在 Go 1.4 引入，是 Go 团队在语言工具链层面实现的，不依赖任何第三方工具。

### Q2: 一个 Go 项目中 cmd 目录下有多个 main 包，它们之间可以共享代码吗？怎么共享？

**参考答案**：

可以共享。方式有两种：

1. **通过 `internal/` 共享**（推荐）：多个 `cmd/` 子目录都可以 import 同一个 `internal/` 包里的代码
2. **通过 `pkg/` 共享**：如果共享代码足够通用

```
cmd/
├── api/main.go      → import internal/service
├── worker/main.go   → import internal/service
└── cli/main.go      → import internal/service
```

每个 `cmd/` 子目录是独立的 `main` 包，编译时生成独立的二进制文件。它们通过 import 共享的 `internal/` 或 `pkg/` 包来复用业务逻辑。这比把所有功能塞进一个巨大的 main.go 要清晰得多。

### Q3: 如果你的项目既是一个应用又提供 SDK 给外部调用，目录该怎么设计？

**参考答案**：

推荐使用 Go workspace（`go.work`）或多模块设计：

```
devos/
├── go.work
├── app/                    # 应用模块
│   ├── go.mod              # module github.com/devos/app
│   ├── cmd/
│   │   └── api/main.go
│   └── internal/           # 应用私有代码
│       └── service/
└── sdk/                    # SDK 模块（独立 go.mod）
    ├── go.mod              # module github.com/devos/sdk
    ├── client.go           # 对外暴露的客户端
    └── types.go            # 对外暴露的类型
```

`go.work` 文件：

```
go 1.23

use (
    ./app
    ./sdk
)
```

好处：
- `sdk/` 没有 `internal/` 的限制，外部可以自由 import
- `app/` 的 `internal/` 仍然受保护
- 两个模块独立版本管理，SDK 可以单独发布

### Q4: Go 项目中应该把数据库 model 和 HTTP request/response struct 放在一起吗？为什么？

**参考答案**：

**不应该放在一起**。这是 Go 项目结构中非常重要的一个设计决策。

原因：
1. **关注点分离**：数据库模型关注持久化（表名、列名、GORM tag），HTTP 结构体关注传输层（JSON tag、验证 tag）
2. **安全**：如果把数据库模型直接用于 API 响应，可能意外泄露敏感字段（如密码 hash、内部 ID）
3. **独立演化**：数据库 schema 和 API 契约的变化频率不同

推荐的分层：

```go
// internal/domain/user.go — 纯领域模型
type User struct {
    ID       string
    Email    string
    Password string  // 不应该出现在 HTTP 响应中
    Name     string
}

// internal/handler/dto/user_dto.go — 传输层对象
type CreateUserRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
    Name     string `json:"name" binding:"required"`
}

type UserResponse struct {
    ID    string `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
}
```

在 handler 层做 domain → DTO 的转换：

```go
func toUserResponse(u *domain.User) UserResponse {
    return UserResponse{
        ID:    u.ID,
        Email: u.Email,
        Name:  u.Name,
    }
}
```

### Q5: 你觉得 `pkg` 目录在现代 Go 项目中还有必要吗？说说你的看法。

**参考答案**：

这是一个有争议的话题，面试时可以展示你理解正反两面：

**支持保留 `pkg` 的理由**：
- 明确标记哪些包是"稳定的公共 API"，哪些是随时可以改的内部实现
- 开源项目中帮助贡献者理解哪些包修改需要考虑向后兼容
- 很多知名项目（Kubernetes、Helm、Prometheus）仍在使用

**支持去掉 `pkg` 的理由**：
- Go 1.4+ 的 `internal` 已经从编译器层面解决了可见性问题
- Google 内部项目不用 `pkg` 目录
- 如果项目只是应用而非库，`pkg` 增加了一层无意义的嵌套
- 有些项目直接在根目录组织包（如 `github.com/gin-gonic/gin`）

**实用建议**：
- 开源库/框架项目：保留 `pkg`，有助于管理公共 API 表面积
- 企业内部应用：只用 `cmd/` + `internal/` 即可
- 如果未来可能开源：提前用 `pkg` 分好，避免开源时大范围移动文件

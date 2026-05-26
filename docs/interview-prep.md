# DevOS Interview Prep Guide

基于 DevOS 项目的面试知识总结，覆盖后端、前端、架构、数据库四大领域。

---

## Project Overview (项目介绍模板)

> DevOS 是一个类 Jira/Trello 的项目管理平台，支持 Sprint 管理、看板拖拽、任务 CRUD、标签系统、团队协作等功能。
>
> **技术栈：** Go (Gin + GORM) + React 19 (TypeScript + Vite + TailwindCSS v4) + PostgreSQL + Redis
>
> **架构：** Modular Monolith（模块化单体），internal 下按业务拆分为 6 个模块（auth/project/task/tag/comment/sprint），每个模块遵循 Repository → Service → Handler 三层架构。
>
> **我的职责：** 负责完整功能开发，包括需求分析、数据库设计、API 设计、前后端实现。

---

## 1. Go Backend

### 1.1 项目结构

```
DevOS/
├── cmd/server/main.go      # 入口：配置、DI、路由、优雅关闭
├── internal/                # 私有包，不可被外部 import
│   ├── auth/               # 认证模块（注册/登录/JWT）
│   ├── project/            # 项目管理模块
│   ├── task/               # 任务模块
│   ├── tag/                # 标签模块（多对多）
│   ├── comment/            # 评论模块
│   └── sprint/             # Sprint 管理模块
├── pkg/                     # 可复用公共包
│   ├── config/             # 配置加载
│   ├── database/           # DB 连接
│   ├── middleware/         # Gin 中间件
│   ├── response/           # 统一响应
│   └── logger/             # 日志
└── frontend/               # React 前端
```

### 1.2 核心知识点清单

| 知识点 | 详情文档 | 面试高频度 |
|--------|----------|-----------|
| DI + 三层架构 | [go/di-and-layered.md](go/di-and-layered.md) | ★★★★★ |
| 错误处理 | [go/error-handling.md](go/error-handling.md) | ★★★★★ |
| Gin 路由与中间件 | [go/gin-and-middleware.md](go/gin-and-middleware.md) | ★★★★ |
| GORM ORM | [go/gorm-patterns.md](go/gorm-patterns.md) | ★★★★ |
| JWT 认证 | [architecture/jwt.md](architecture/jwt.md) | ★★★★★ |
| 项目布局 | [go/go-project-layout.md](go/go-project-layout.md) | ★★★ |

### 1.3 必背面试题

**Q: Go 项目的 internal 和 pkg 目录有什么区别？**
- `internal` — Go 编译器强制限制，只能被同一模块内的代码 import
- `pkg` — 约定俗成的公共包，可以被外部 import（但 Go 编译器不强制）
- 项目中 `internal/auth` 等是业务模块，`pkg/response` 等是通用工具

**Q: 依赖注入为什么要用接口而不是具体类型？**
- 解耦 — 修改实现不需要改调用方
- 可测试 — mock 接口比 mock struct 简单
- ISP — 消费方定义最小接口，只看需要的方法

**Q: Sentinel Error 是什么？和自定义错误类型有什么区别？**
- Sentinel = 预定义的 `var Err = errors.New("xxx")`，用于固定错误消息
- 自定义类型 = `type MyErr struct { Code int }`，用于携带动态信息
- 项目用 Sentinel 因为错误不需要额外上下文

**Q: errors.Is 和 == 的区别？**
- `errors.Is()` 支持 error chain（`%w` 包装的链路）
- `==` 只匹配指针地址
- 始终用 `errors.Is()`

---

## 2. Frontend (React)

### 2.1 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| React | UI 框架 | 19 |
| TypeScript | 类型安全 | 5.x |
| Vite | 构建工具 | 6.x |
| TailwindCSS | CSS 框架 | v4 |
| shadcn/ui | 组件库 | latest |
| @dnd-kit | 拖拽库 | 6.x |
| axios | HTTP 客户端 | 1.x |
| react-router-dom | 路由 | 7.x |

### 2.2 核心知识点清单

| 知识点 | 详情文档 | 面试高频度 |
|--------|----------|-----------|
| React 模式（懒加载/Context/路由守卫） | [frontend/react-patterns.md](frontend/react-patterns.md) | ★★★★★ |
| @dnd-kit 看板拖拽 | [frontend/dnd-kanban.md](frontend/dnd-kanban.md) | ★★★★ |
| React Context 认证 | [frontend/react-context-auth.md](frontend/react-context-auth.md) | ★★★★ |
| shadcn + TailwindCSS | [frontend/shadcn-tailwind.md](frontend/shadcn-tailwind.md) | ★★★ |

### 2.3 必背面试题

**Q: React.lazy 和 Suspense 的原理？**
- `lazy` 接受一个 `() => import()` 函数，返回 Lazy 组件
- 首次渲染时触发 import，打包工具（Vite）将模块拆分为独立 chunk
- Suspense 在 chunk 加载期间显示 fallback

**Q: Context 和 Redux 怎么选？**
- Context — 低频全局状态（user/theme/toast），简单直接
- Redux — 复杂状态机、高频更新、需要中间件/回溯
- DevOS 只用 Context 因为全局状态只有 user 和 toasts

**Q: useCallback 和 useMemo 的区别？**
- `useCallback(fn, deps)` — 缓存函数引用
- `useMemo(() => val, deps)` — 缓存计算结果
- 项目中 `fetchTasks` 用 `useCallback` 因为它是 `useEffect` 的依赖

---

## 3. Architecture (系统设计)

### 3.1 核心知识点清单

| 知识点 | 详情文档 | 面试高频度 |
|--------|----------|-----------|
| Modular Monolith | [architecture/modular-monolith.md](architecture/modular-monolith.md) | ★★★★★ |
| JWT 认证流程 | [architecture/jwt.md](architecture/jwt.md) | ★★★★★ |
| RBAC 权限设计 | [architecture/rbac.md](architecture/rbac.md) | ★★★★ |

### 3.2 必背面试题

**Q: 为什么选 Modular Monolith 而不是微服务？**
- 团队规模小，微服务运维成本高
- 模块化单体用接口隔离模块，保持代码边界
- 未来需要时可以按模块拆分为微服务

**Q: JWT 的优缺点？**
- 优点：无状态、跨服务、移动端友好
- 缺点：无法主动撤销（需要黑名单）、Token 体积比 Session ID 大、payload 可被解码

**Q: RBAC 和 ABAC 的区别？**
- RBAC — 基于角色（admin/developer/viewer），适合固定权限体系
- ABAC — 基于属性（用户部门 + 资源类型 + 操作时间），适合动态权限
- 项目用 RBAC 因为权限体系简单固定

---

## 4. Database

### 4.1 核心知识点清单

| 知识点 | 详情文档 | 面试高频度 |
|--------|----------|-----------|
| PostgreSQL | [database/postgresql.md](database/postgresql.md) | ★★★★ |
| 多对多关系 | [database/many-to-many.md](database/many-to-many.md) | ★★★★ |

### 4.2 必背面试题

**Q: UUID vs 自增 ID？**
- UUID — 分布式安全、不可猜测、前端可预生成
- 自增 — 有序插入快、占用空间小
- 项目用 UUID 因为需要分布式安全和不可猜测性

**Q: 如何解决 N+1 查询问题？**
- Preload 预加载
- JOIN 一次查询
- 批量查询 + 手动组装（项目中 Tags 的做法：先查所有 taskID 的 tags，再按 taskID 分组）

**Q: 数据库索引有哪些类型？什么时候用？**
- B-tree — 等值查询和范围查询（最常用）
- 部分索引 — 只索引满足条件的行（如 WHERE deleted_at IS NULL）
- 覆盖索引 — 索引包含查询所需的所有列，不需要回表
- GIN — 全文搜索、数组/JSONB 查询

---

## 5. 跨领域综合题

**Q: 从零设计一个看板系统，你会怎么做？**

回答框架：
1. **数据模型** — Task（id, title, status, project_id, sort_order），状态列是 Task 的 status 字段
2. **API 设计** — RESTful，`PUT /tasks/:id` 更新 status，`GET /tasks?status=todo` 过滤
3. **拖拽实现** — @dnd-kit，DndContext + SortableContext + useDroppable
4. **排序** — sort_order 字段记录同列内的顺序
5. **并发** — 乐观锁或 sort_order 原子更新

**Q: 前后端如何保证类型一致？**

回答框架：
1. TypeScript interface 定义 API 请求/响应类型
2. 后端 Go struct 的 JSON tag 与前端 interface 字段名对应
3. 统一响应格式 `{code, message, data, pagination}`
4. 可以用 OpenAPI/Swagger 自动生成类型（项目目前手动维护）

**Q: 如何做前端认证？**

回答框架：
1. 登录后 `localStorage.setItem("token", accessToken)`
2. Axios 拦截器自动在请求头附加 `Authorization: Bearer <token>`
3. 401 响应自动清除 token 并跳转登录页
4. React Context 管理全局 user 状态
5. 路由守卫（ProtectedRoute）保护需要认证的页面

**Q: 如果让你优化这个项目，你会做什么？**

回答框架：
1. **前端** — React Query 管理 server state（已引入但未全面使用）、虚拟列表优化大量任务
2. **后端** — Redis 缓存热点数据、连接池优化、批量操作接口
3. **架构** — 事件总线解耦模块（已有 pkg/event 但未使用）、WebSocket 实时通知
4. **DevOps** — Docker 化部署、CI/CD pipeline、数据库版本化迁移

---

## 6. 知识点速查表

### Go 关键字/概念速查

| 概念 | 项目中的使用 | 一句话解释 |
|------|-------------|-----------|
| interface | Service/Repository 接口 | 定义行为契约，实现多态和解耦 |
| struct embedding | Claims 嵌入 RegisteredClaims | 组合复用，类似继承但更灵活 |
| goroutine | `go srv.ListenAndServe()` | 轻量级并发，非阻塞启动服务 |
| channel | `quit := make(chan os.Signal, 1)` | goroutine 间通信 |
| context.Context | `srv.Shutdown(ctx)` | 传播取消信号和超时 |
| defer | `defer logger.L.Sync()` | 函数返回前执行（类似 finally） |
| pointer | `*string`, `*time.Time` | 可空字段用指针，区分零值和 nil |
| error wrapping | `fmt.Errorf("xxx: %w", err)` | 包装错误保留链路，errors.Is 可追溯 |

### React 关键概念速查

| 概念 | 项目中的使用 | 一句话解释 |
|------|-------------|-----------|
| useState | 每个组件的状态 | 组件内可变状态 |
| useEffect | 数据获取副作用 | 组件挂载/依赖变化时执行 |
| useCallback | fetchTasks 缓存 | 缓存函数引用，避免无限 useEffect |
| Context | AuthContext, ToastContext | 跨组件共享状态 |
| lazy + Suspense | 路由懒加载 | 按需加载代码块 |
| useRef | DOM 引用 | 不触发 re-render 的可变引用 |

### HTTP 状态码速查

| 状态码 | 含义 | 项目使用场景 |
|--------|------|-------------|
| 200 | OK | GET 成功、PUT 成功 |
| 201 | Created | POST 创建成功 |
| 400 | Bad Request | 参数校验失败 |
| 401 | Unauthorized | Token 无效/缺失 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 触发限流 |
| 500 | Internal Error | 服务端异常 |

---

## 7. 模拟面试流程

### 自我介绍（1分钟）

> 你好，我是 XXX。我最近在做 DevOS 项目，这是一个项目管理平台，类似于轻量版的 Jira。
> 后端用 Go，基于 Gin 框架和 GORM，数据库是 PostgreSQL。
> 前端用 React 19 + TypeScript，UI 用 shadcn 和 TailwindCSS，看板拖拽用 @dnd-kit。
> 架构上采用了模块化单体设计，按业务拆分了 6 个模块，每个模块遵循三层架构。
> 我负责了从数据库设计到前后端开发的完整流程。

### 项目深挖（3-5分钟）

面试官可能追问的方向：
1. **架构选择** — 为什么用 Modular Monolith？怎么拆模块？
2. **数据库设计** — Task 表怎么设计的？多对多怎么处理？
3. **性能优化** — N+1 怎么解决？大量数据怎么分页？
4. **认证安全** — JWT 怎么实现？Token 失效怎么处理？
5. **前端复杂交互** — 看板拖拽怎么实现？遇到什么问题？
6. **错误处理** — Go 的错误处理是怎么设计的？

### 回答模板（STAR 法则）

- **S (Situation)** — 项目需要一个 XX 功能
- **T (Task)** — 我负责设计和实现这个功能
- **A (Action)** — 我采用了 XX 方案，因为 YY
- **R (Result)** — 最终实现了 ZZ，性能/体验提升了 WW

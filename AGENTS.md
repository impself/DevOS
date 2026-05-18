# AGENT.md — DevOS 项目上下文

> 本文件供 AI Agent（Claude）在每次会话开始时读取，确保理解项目全貌。

## 项目基本信息

- **项目名称：** DevOS（Development Operating System）
- **定位：** AI Native 研发协作平台
- **核心理念：** Everything is Context — 所有研发行为都成为 AI 的上下文
- **团队规模：** 3-5 人小团队
- **项目性质：** 学习/探索，非商业产品

## 架构决策记录

### ADR-001: Modular Monolith（非微服务）

- **决定：** 采用模块化单体架构，单 Go 应用内部按业务域划分模块
- **原因：** 3-5 人团队，学习项目，微服务运维成本远大于收益
- **未来：** 模块间通过 Go interface 通信，需要拆分时 interface 后面换 gRPC client

### ADR-002: Go 全栈（非 Go + Python）

- **决定：** AI 模块也用 Go 写，不单独起 Python 服务
- **原因：** 统一技术栈，降低运维复杂度
- **库：** go-openai（LLM 调用）、pgvector（向量检索）、原生实现 Agent 编排

### ADR-003: Redis Streams（非 Kafka）

- **决定：** 模块间异步通信用 Redis Streams
- **原因：** 轻量、已有 Redis 依赖、Kafka 太重

### ADR-004: GORM（ORM）

- **决定：** 使用 GORM
- **注意：** 注意规避零值判断、自动迁移等坑，复杂查询用原生 SQL

### ADR-005: Gitea API 集成（非二次开发）

- **决定：** 通过 Gitea REST API + Webhook 集成，不 fork 不改源码
- **原因：** 避免 merge 上游更新的噩梦

### ADR-006: Audit Log（非 Event Sourcing）

- **决定：** 项目管理模块用审计日志记录操作
- **原因：** Event Sourcing 复杂度极高，Audit Log 够用

### ADR-007: 自研 RBAC（非 Casbin）

- **决定：** 自研轻量 RBAC，权限模型简单：Workspace → Project → Role
- **角色：** Owner / Admin / Developer / Viewer

### ADR-008: 原生 Agent（非 LangChain）

- **决定：** AI Agent 用 Go 原生实现：Prompt + Tool Calling + Memory + Loop
- **原因：** LangChain 过度抽象，调试难，原生实现更可控

## 技术栈速查

| 层 | 技术 |
|------|------|
| 后端 | Go 1.25+, Gin, GORM, pgx, go-redis, Zap, golang-migrate |
| AI | go-openai, pgvector, 原生 Agent |
| 前端 | React 19, TypeScript, Vite, TailwindCSS v4, shadcn/ui, React Router, Axios |
| 数据 | PostgreSQL 16+ pgvector, Redis |
| 监控 | Prometheus, Grafana, Loki, Jaeger |

## 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| auth | internal/auth/ | 用户管理、JWT 认证、RBAC 权限 |
| project | internal/project/ | 项目、Task、Issue、Timeline 管理 |
| document | internal/document/ | 文档 CRUD、版本管理、权限控制 |
| collab | internal/collab/ | WebSocket、Yjs 实时协同编辑 |
| agent | internal/agent/ | AI Agent、RAG 检索、Tool Calling |
| git | internal/git/ | Gitea API + Webhook 集成 |
| audit | internal/audit/ | 审计日志、操作追踪 |
| notification | internal/notification/ | 站内通知、邮件通知 |

## 代码分层规范

每个业务模块遵循三层架构：

```text
handler.go    → HTTP 处理，参数校验，调用 service
service.go    → 业务逻辑，调用 repository 和其他 service
repository.go → 数据库操作，纯数据访问
model.go      → 数据模型定义（struct + GORM tag）
```

**模块间调用：** 通过 Go interface，不直接 import 另一个模块的 service。

## API 规范

- 前缀：`/api/v1/`
- 响应：`{"code": 0, "message": "success", "data": {}}`
- 错误：`{"code": "ERROR_CODE", "message": "描述", "details": [...]}`
- OpenAPI 契约：`api/openapi.yaml`

## 数据库规范

- UUID 主键（`gen_random_uuid()`）
- 统一字段：`id`, `created_at`, `updated_at`, `deleted_at`
- 软删除（`deleted_at`）
- 迁移工具：golang-migrate
- 迁移文件：`migrations/NNN_xxx.up.sql` / `migrations/NNN_xxx.down.sql`

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 骨架 + 用户系统 + 权限 + 前端联调 | 进行中 |
| 2 | 项目管理 + 文档编辑器 + 审计 | 待开始 |
| 3 | AI Agent + RAG + Gitea 集成 | 待开始 |
| 后续 | 实时协同、自动周报、Code Review | 待开始 |

## docs 知识库说明

`docs/` 目录下的知识文件用于记录开发过程中涉及的技术知识点，包括基础概念、用法和核心思想，供面试准备使用。

每次完成一个功能模块的开发，需要在 `docs/` 下创建对应的知识文件。

## 用户偏好

- 代码注释语言：中文
- 输出风格：老韩暴躁技术流（但 caveman mode 也开着，不冲突）
- 不要主动 git commit / push，除非用户明确要求
- 危险操作必须确认

## 前端架构

### 目录结构

```text
frontend/src/
├── api/              # Axios API 层（client.ts + 业务模块）
├── components/
│   ├── ui/           # shadcn/ui 组件（button/input/checkbox/label + 业务组件）
│   └── ProtectedRoute.tsx  # 路由守卫
├── context/          # React Context（AuthContext）
├── layouts/          # 布局组件（DashboardLayout = sidebar + outlet）
├── lib/              # 工具函数（cn, utils）
└── pages/            # 页面组件（DashboardPage, ProjectDetailPage）
```

### 前端分层规范

```text
api/client.ts       → Axios 实例，JWT 注入，401 自动跳转
api/auth.ts         → 认证 API（login/register/getMe）
api/project.ts      → 项目 API（CRUD + 成员管理）
context/AuthContext  → 全局认证状态（user/token/isAuthenticated）
layouts/            → 共享布局（侧边栏 + top bar）
pages/              → 页面级组件，组合 api + context + ui
components/ui/      → 纯 UI 组件，不包含业务逻辑
```

### 路由设计

- `/login` — 公开，动画登录页
- `/register` — 公开，动画注册页（角色解锁 + 密码强度）
- `/dashboard` — 受保护，项目列表 + 创建
- `/projects/:id` — 受保护，项目详情 + 编辑 + 成员管理
- 未认证用户自动重定向到 `/login`

- 代码注释语言：中文
- 输出风格：老韩暴躁技术流（但 caveman mode 也开着，不冲突）
- 不要主动 git commit / push，除非用户明确要求
- 危险操作必须确认

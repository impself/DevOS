# DevOS — AI Native 研发协作平台

## 项目概述

DevOS（Development Operating System）是一个面向研发团队的 AI 原生项目协作平台，统一整合项目管理、协同文档、代码托管、AI Agent、知识库与审计追踪，实现"文档—代码—任务—人员—AI"全链路关联。

### 核心竞争力

不是文档，不是 Git，不是项目管理——是 **AI 与研发上下文的深度融合**。

核心理念：**Everything is Context** — 所有研发行为都成为 AI 的上下文。

---

## 项目背景

| 问题 | 描述 |
|------|------|
| 工具割裂 | 文档、代码、项目管理分离 |
| 信息孤岛 | AI 无法理解项目上下文 |
| 协作效率低 | 文件频繁传输 |
| 缺少智能分析 | 无法自动分析项目风险 |
| 缺少追踪能力 | 难以定位问题责任链 |
| 缺少统一知识库 | 项目知识无法沉淀 |

---

## 系统架构

### 架构模式：Modular Monolith + 事件驱动

采用模块化单体架构，内部按业务域划分为独立模块。模块间通过 Go interface 和 Redis Streams 通信，未来需要时可平滑拆分为微服务。

```text
┌──────────────────────────────────┐
│         React Frontend           │
│  Vite · TypeScript · shadcn/ui   │
└──────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│        Go HTTP Server (Gin)      │
│     统一入口 · 鉴权 · 路由        │
└──────────────────────────────────┘
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼

 ┌─────┐  ┌─────┐  ┌─────┐
 │auth │  │proj │  │ doc │
 └─────┘  └─────┘  └─────┘
 ┌─────┐  ┌─────┐  ┌─────┐
 │collab│ │agent│  │ git │
 └─────┘  └─────┘  └─────┘
 ┌─────┐  ┌─────┐
 │audit│  │notif│
 └─────┘  └─────┘

         │ Go Interface │
         ▼               ▼
┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │   Redis     │
│ + pgvector  │  │ Cache/Streams│
└─────────────┘  └─────────────┘
```

### 模块划分

| 模块 | 职责 |
|------|------|
| auth | 用户管理、JWT 认证、RBAC 权限 |
| project | 项目、Task、Issue、Timeline 管理 |
| document | 文档 CRUD、版本管理、权限控制 |
| collab | WebSocket、Yjs 实时协同编辑 |
| agent | AI Agent、RAG 检索、Tool Calling |
| git | Gitea API + Webhook 集成 |
| audit | 审计日志、操作追踪 |
| notification | 站内通知、邮件通知 |

---

## 技术选型

### 后端技术栈

| 技术 | 用途 |
|------|------|
| Go | 后端主语言（全栈，含 AI 模块） |
| Gin | HTTP 框架 |
| GORM | ORM |
| pgx | PostgreSQL 驱动 |
| go-redis | Redis 客户端 |
| Zap | 结构化日志 |
| golang-migrate | 数据库迁移 |
| go-openai | OpenAI API 调用 |
| langchaingo | LLM 编排（可选） |

### AI 技术栈

| 技术 | 用途 |
|------|------|
| Go 原生 | Agent 编排（Prompt + Tool Calling + Memory + Loop） |
| go-openai | LLM API 调用 |
| pgvector | 向量检索（RAG） |
| OpenAI API | 云端模型 |
| Ollama | 本地模型（可选） |

### 前端技术栈

| 技术 | 用途 |
|------|------|
| React | 前端框架 |
| TypeScript | 类型系统 |
| Vite | 构建工具 |
| Zustand | 状态管理 |
| React Query | 服务端状态 |
| TailwindCSS | UI 样式 |
| shadcn/ui | UI 组件 |
| TipTap | 富文本编辑器 |
| Yjs | CRDT 协同编辑 |

### 数据层

| 技术 | 用途 |
|------|------|
| PostgreSQL | 主数据库 |
| pgvector | 向量存储与检索 |
| Redis | 缓存、Session、Streams 消息、分布式锁 |

### 可观测性

| 技术 | 用途 |
|------|------|
| Prometheus | 指标监控 |
| Grafana | 可视化 |
| Loki | 日志聚合 |
| Jaeger | 分布式追踪 |

---

## 核心模块设计

### 协同文档模块

**功能：** 多人实时协同编辑、文档版本管理、文档权限控制、AI 文档问答、Markdown/PDF 导出。

**技术链路：** TipTap → Yjs → WebSocket → collab 模块

| 特性 | 说明 |
|------|------|
| CRDT | 无冲突协同 |
| 实时同步 | 毫秒级同步 |
| 离线编辑 | 支持断线恢复 |
| 操作回放 | 支持历史恢复 |

**数据模型：** workspace → project → document → document_version → document_permission

### 代码托管模块

**方案：** 通过 Gitea API + Webhook 集成，不修改 Gitea 源码。

**功能：** 仓库管理、PR 管理、Commit 追踪、WebHook、CI 集成、权限同步。

**AI 增强能力：** AI Code Review、漏洞检测、自动生成测试、Commit 总结、风险分析。

### 项目管理模块

**功能：** 项目管理、Sprint 管理、Issue 管理、人员分工、项目时间线、审计追踪。

**数据模型：** project → task → issue → timeline → member → role → audit_log

**事件机制：** 采用 Audit Log 记录关键操作（谁、何时、做了什么、变更前/后），用于 AI 分析、历史追踪、项目回放。

### AI Agent 模块

**核心定位：** 不是聊天机器人，而是项目上下文智能体。

**Agent 架构：**

```text
User Query
    ↓
Agent Gateway (鉴权 + 路由)
    ↓
Planner (意图理解 + 任务分解)
    ↓
Tool Calling (检索/操作)
    ↓
Memory (上下文管理)
    ↓
RAG (向量检索)
    ↓
LLM (生成回答)
```

**AI 能力分阶段实现：**

- 第一阶段：项目问答、文档问答、代码问答、Issue 分析
- 第二阶段：自动周报、自动生成文档
**RAG 知识源：** 文档、代码、Issue、PR、评论、日志

**Agent 安全：** Prompt 注入检测、敏感信息过滤、Tool 调用白名单、Agent 权限隔离

---

## 权限系统设计

### 权限模型：RBAC + Workspace（自研轻量实现）

```text
Workspace
   └── Project
         └── Role
```

| 角色 | 权限 |
|------|------|
| Owner | 全部权限 |
| Admin | 管理权限 |
| Developer | 开发权限 |
| Viewer | 只读权限 |

---

## 实时通信设计

WebSocket 集成在 Go Server 内，支持：

- 文档同步（Yjs）
- AI 流式输出
- 在线状态
- 实时通知

---

## 数据库设计

### PostgreSQL 设计原则

所有表包含统一字段：

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ  -- 软删除
```

**核心原则：** UUID 主键、软删除、规范索引、审计字段。

### Redis 用途

- Session 存储
- WebSocket 连接状态
- API 限流
- 数据缓存
- 分布式锁
- Streams 消息总线

---

## API 规范

### 统一前缀

```text
/api/v1/
```

### 响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 错误响应

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "Project with ID xxx not found",
  "details": [{"field": "project_id", "issue": "not found"}]
}
```

---

## 日志规范

统一携带字段：`trace_id`、`request_id`、`user_id`、`project_id`。

---

## 安全设计

- JWT 认证（Access Token + Refresh Token）
- RBAC 权限控制
- HTTPS 传输加密
- 审计日志
- 防 SQL 注入、XSS、CSRF
- Prompt 注入检测
- Agent 权限隔离
- Tool 调用白名单

---

## 开发规范

### Git 规范

分支：`main`、`develop`、`feature/*`、`fix/*`

Commit：`feat:` `fix:` `docs:` `refactor:` `test:`

### 代码规范

Go：golangci-lint、单元测试、接口分层。

前端：ESLint、Prettier、TypeScript strict。

---

## 开发阶段规划

### Phase 1：骨架 + 用户系统（2-3 周）

- Go 项目骨架搭建（Modular Monolith）
- PostgreSQL + Redis 连接
- 数据库迁移工具集成
- 用户注册/登录（JWT + Refresh Token）
- RBAC 权限（Workspace → Project → Role）
- Gin 路由分组 + 中间件（鉴权、限流、CORS）
- 前端项目搭建（Vite + React + shadcn/ui）
- 登录/注册页面

**交付：** 能注册、登录、建项目、管理成员。

### Phase 2：核心业务（4-6 周）

- 项目管理（Task、Issue、Timeline、Sprint）
- 文档编辑器（TipTap）
- 文档版本管理
- 审计日志
- 通知系统
- 前端：项目看板、文档编辑页面

**交付：** 能用项目管理 + 写文档。

### Phase 3：AI 能力（4-6 周）

- AI Agent 基础架构（Prompt + Tool Calling + Memory）
- pgvector 向量检索（RAG）
- 项目问答（基于项目上下文）
- 文档问答
- AI 流式输出（WebSocket）
- Gitea 集成（API + Webhook）
- 代码问答

**交付：** AI 能理解项目上下文并回答问题。

### 后续迭代

- Yjs 实时协同编辑
- 自动周报
- 风险分析
- AI Code Review
- 自动生成测试
- 威胁建模
- 代码编辑器（后期集成）
- 性能优化
- Kubernetes 部署

---

## 项目目录结构

```text
DevOS/
├── README.md
├── go.mod
├── go.sum
├── Makefile
├── docker-compose.yml
├── .env.example
│
├── cmd/
│   └── server/
│       └── main.go
│
├── internal/
│   ├── auth/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── model.go
│   ├── project/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── model.go
│   ├── document/
│   ├── collab/
│   ├── agent/
│   │   ├── handler.go
│   │   ├── agent.go
│   │   ├── tools.go
│   │   ├── memory.go
│   │   └── rag.go
│   ├── git/
│   ├── audit/
│   └── notification/
│
├── pkg/
│   ├── database/
│   │   ├── postgres.go
│   │   └── redis.go
│   ├── middleware/
│   │   ├── auth.go
│   │   ├── cors.go
│   │   └── ratelimit.go
│   ├── event/
│   │   └── bus.go
│   ├── config/
│   │   └── config.go
│   └── logger/
│       └── zap.go
│
├── migrations/
│   ├── 001_create_users.up.sql
│   └── 001_create_users.down.sql
│
├── api/
│   └── openapi.yaml
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── services/
│       └── types/
│
└── deploy/
    ├── Dockerfile
    └── docker-compose.yml
```

---

## 部署方案

### 开发环境

Docker Compose 一键启动：Go Server + PostgreSQL + Redis + Gitea。

### 生产环境（后续）

Kubernetes + Helm。

---

## 项目未来扩展方向

- 自动测试平台
- AI 代码生成
- 自动架构分析
- DevSecOps
- 威胁建模 + 攻击链分析
- 多 Agent 协作
- MCP 协议支持
- 插件系统

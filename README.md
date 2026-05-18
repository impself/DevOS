<div align="center">

# DevOS

**AI Native 研发协作平台**

[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?style=flat&logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Everything is Context** — 所有研发行为都成为 AI 的上下文

[English](#) · [中文](#) · [设计文档](docs/about.md) · [API 文档](api/openapi.yaml)

</div>

---

DevOS 是一个面向研发团队的 AI 原生项目协作平台。将项目管理、协同文档、代码托管、AI Agent 统一整合，实现 **文档—代码—任务—人员—AI** 全链路关联。

## 为什么做 DevOS

当前研发工具的痛点：

- **工具割裂** — 文档在 Notion、代码在 GitHub、任务在 Jira，上下文分散
- **AI 无法理解项目** — 现有 AI 工具缺乏项目全局上下文，回答浮于表面
- **知识无法沉淀** — 项目结束后知识散落各处，无法复用

DevOS 的解法：**让 AI 理解你的整个项目上下文**，而不是只看一段代码或一篇文档。

## 特性

- **项目管理** — Sprint、Task、Issue、Timeline、人员分工
- **协同文档** — TipTap 富文本编辑，Yjs 实时协同
- **代码托管** — Gitea API + Webhook 集成
- **AI Agent** — 基于项目上下文的智能问答、RAG 检索、Tool Calling
- **权限控制** — Workspace → Project → Role 三级 RBAC
- **审计追踪** — 全操作审计日志，支持历史回溯

## 架构

```text
  React Frontend (Vite + TypeScript + shadcn/ui)
                    │
                    ▼
        Go HTTP Server (Gin + Modules)
                    │
    ┌───────┬───────┼───────┬───────┐
    ▼       ▼       ▼       ▼       ▼
  auth   project  document  agent  ...
  (JWT)  (Task)   (TipTap)  (RAG)
    │       │       │       │
    ▼───────┴───────┴───────▼
     PostgreSQL + pgvector   Redis (Cache/Streams)
```

**架构模式：** Modular Monolith — 模块化单体，Go interface 通信，未来可平滑拆分为微服务。

> 详细的架构设计、技术选型、模块说明见 [docs/about.md](docs/about.md)

## 技术栈

| 层 | 技术 |
|------|------|
| **后端** | Go, Gin, GORM, pgx, go-redis, Zap |
| **AI** | Go 原生 Agent, go-openai, pgvector, RAG |
| **前端** | React, TypeScript, Vite, Zustand, shadcn/ui, TipTap, Yjs |
| **数据** | PostgreSQL + pgvector, Redis |
| **监控** | Prometheus, Grafana, Loki, Jaeger |

## 快速开始

### 前置条件

- Go 1.23+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+（或用 Docker）

### 启动

```bash
# 克隆项目
git clone https://github.com/your-org/devos.git
cd devos

# 启动依赖服务（PostgreSQL + Redis）
docker compose up -d

# 启动后端
cp .env.example .env
make run

# 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 环境变量

```bash
# .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=devos
DB_PASSWORD=devos
DB_NAME=devos

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-xxx
```

## 项目结构

```text
DevOS/
├── cmd/server/           # 入口
├── internal/             # 业务模块
│   ├── auth/             # 用户 + 权限
│   ├── project/          # 项目 + Task + Issue
│   ├── document/         # 文档管理
│   ├── collab/           # 实时协同
│   ├── agent/            # AI Agent + RAG
│   ├── git/              # Gitea 集成
│   ├── audit/            # 审计日志
│   └── notification/     # 通知
├── pkg/                  # 公共库
│   ├── database/         # DB 连接
│   ├── middleware/       # 中间件
│   ├── event/            # 事件总线
│   ├── config/           # 配置
│   └── logger/           # 日志
├── migrations/           # SQL 迁移
├── api/                  # OpenAPI 契约
├── frontend/             # React 前端
├── docs/                 # 文档 + 知识库
└── deploy/               # 部署配置
```

## 开发路线

- [x] **Phase 1** — 骨架 + 用户系统
- [ ] **Phase 2** — 核心业务（项目管理 + 文档）
- [ ] **Phase 3** — AI 能力（Agent + RAG）
- [ ] **后续** — 实时协同、自动周报、AI Code Review

> 详细的阶段规划见 [docs/about.md#开发阶段规划](docs/about.md)

## 文档

| 文档 | 说明 |
|------|------|
| [设计文档](docs/about.md) | 完整的架构设计、技术选型、模块设计 |
| [API 契约](api/openapi.yaml) | OpenAPI 3.1 接口定义 |
| [知识库](docs/) | 技术知识点，面试准备用 |

## 开发规范

**Git 分支：** `main` → `develop` → `feature/*` / `fix/*`

**Commit：** `feat:` `fix:` `docs:` `refactor:` `test:`

**Go：** golangci-lint、单元测试、接口分层（handler → service → repository）

**前端：** ESLint、Prettier、TypeScript strict

## License

[MIT](LICENSE)

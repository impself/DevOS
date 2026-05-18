# DevOS 知识库索引

> 开发过程中积累的技术知识点，包括基础概念、用法、核心思想。供面试准备使用。

## Go 后端

| 文件 | 知识点 |
|------|--------|
| [go-gin.md](go/go-gin.md) | Gin 框架：路由、中间件、参数绑定、错误处理 |
| [go-gorm.md](go/go-gorm.md) | GORM：模型定义、CRUD、关联、迁移、Hook |
| [go-project-layout.md](go/go-project-layout.md) | Go 项目结构：cmd/internal/pkg 规范 |
| [go-concurrency.md](go/go-concurrency.md) | Go 并发：goroutine、channel、context、sync |
| [go-error-handling.md](go/go-error-handling.md) | Go 错误处理：error 接口、wrap、panic/recover |
| [go-testing.md](go/go-testing.md) | Go 测试：单元测试、表驱动、mock、benchmark |
| [go-interfaces.md](go/go-interfaces.md) | Go 接口：定义、组合、空接口、类型断言 |

## 数据库

| 文件 | 知识点 |
|------|--------|
| [postgresql.md](database/postgresql.md) | PostgreSQL：特性、索引、JSON、全文搜索、UPSERT |
| [redis.md](database/redis.md) | Redis：数据结构、Streams、分布式锁、缓存策略 |
| [database-design.md](database/database-design.md) | 数据库设计：范式、反范式、索引策略、命名规范 |
| [pgvector.md](database/pgvector.md) | pgvector：向量检索、RAG、embedding 存储 |

## 架构设计

| 文件 | 知识点 |
|------|--------|
| [modular-monolith.md](architecture/modular-monolith.md) | 模块化单体：与微服务对比、拆分策略、Go interface |
| [rbac.md](architecture/rbac.md) | RBAC 权限模型：设计、实现、Workspace 多租户 |
| [jwt.md](architecture/jwt.md) | JWT 认证：Access/Refresh Token、安全、存储 |
| [event-driven.md](architecture/event-driven.md) | 事件驱动：Redis Streams、事件总线、解耦 |
| [api-design.md](architecture/api-design.md) | RESTful API 设计：命名、状态码、版本管理、OpenAPI |
| [audit-log.md](architecture/audit-log.md) | 审计日志：设计、存储、查询、合规 |

## AI / Agent

| 文件 | 知识点 |
|------|--------|
| [llm-basics.md](ai/llm-basics.md) | LLM 基础：Token、Prompt Engineering、Temperature |
| [rag.md](ai/rag.md) | RAG：分块、嵌入、检索、重排序、生成 |
| [agent-architecture.md](ai/agent-architecture.md) | Agent 架构：ReAct、Tool Calling、Memory、Loop |
| [prompt-injection.md](ai/prompt-injection.md) | Prompt 注入：攻击手法、防御策略、检测 |
| [vector-embedding.md](ai/vector-embedding.md) | 向量嵌入：Embedding 模型、相似度计算、pgvector |

## 前端

| 文件 | 知识点 |
|------|--------|
| [react-patterns.md](frontend/react-patterns.md) | React 模式：Hooks、Context、性能优化、状态管理 |
| [websocket.md](frontend/websocket.md) | WebSocket：协议、Go 实现、连接管理、心跳 |
| [tiptap-yjs.md](frontend/tiptap-yjs.md) | TipTap + Yjs：CRDT、协同编辑、冲突解决 |

## DevOps

| 文件 | 知识点 |
|------|--------|
| [docker.md](devops/docker.md) | Docker：Dockerfile、多阶段构建、Compose |
| [migrate.md](devops/migrate.md) | 数据库迁移：golang-migrate、版本管理、回滚 |

---

## 贡献规范

每完成一个功能模块的开发，在对应分类下创建知识文件，格式：

```markdown
# 知识点名称

## 基础概念
（是什么、为什么、解决什么问题）

## 核心用法
（代码示例、配置示例）

## 核心思想 / 设计原理
（底层原理、面试高频问题）

## 常见面试题
（3-5 个常见问题及参考答案）
```

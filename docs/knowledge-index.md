# DevOS 知识库索引

> 开发过程中积累的技术知识点，包括基础概念、用法、核心思想。供面试准备使用。

## 面试指南

| 文件 | 内容 |
|------|------|
| [interview-prep.md](interview-prep.md) | **面试总纲：** 项目介绍模板、必背题、STAR 法则、知识点速查表 |

## Go 后端

| 文件 | 知识点 | 状态 |
|------|--------|------|
| [go/di-and-layered.md](go/di-and-layered.md) | **DI + 三层架构：** 构造函数注入、接口解耦、ISP 原则、main.go 作为 DI 容器 | ✅ 已完成 |
| [go/error-handling.md](go/error-handling.md) | **错误处理：** Sentinel Error、errors.Is()、Handler 错误映射、响应码集中管理 | ✅ 已完成 |
| [go/gin-and-middleware.md](go/gin-and-middleware.md) | **Gin + 中间件：** 路由分组、JWT 认证、CORS、限流、优雅关闭 | ✅ 已完成 |
| [go/gorm-patterns.md](go/gorm-patterns.md) | **GORM 模式：** 模型定义、虚拟字段、条件查询、JOIN、事务、多对多、Raw SQL | ✅ 已完成 |
| [go/go-project-layout.md](go/go-project-layout.md) | Go 项目结构：cmd/internal/pkg 规范 | 计划中 |
| [go/go-concurrency.md](go/go-concurrency.md) | Go 并发：goroutine、channel、context、sync | 计划中 |
| [go/go-testing.md](go/go-testing.md) | Go 测试：单元测试、表驱动、mock、benchmark | 计划中 |

## 数据库

| 文件 | 知识点 | 状态 |
|------|--------|------|
| [database/postgresql.md](database/postgresql.md) | PostgreSQL：UUID vs 自增、软删除、索引策略、MVCC | ✅ 已完成 |
| [database/many-to-many.md](database/many-to-many.md) | 多对多关系：关联表设计、复合主键、批量查询、GORM 陷阱 | ✅ 已完成 |

## 架构设计

| 文件 | 知识点 | 状态 |
|------|--------|------|
| [architecture/modular-monolith.md](architecture/modular-monolith.md) | 模块化单体：与微服务对比、拆分策略、Go interface | ✅ 已完成 |
| [architecture/rbac.md](architecture/rbac.md) | RBAC 权限模型：设计、实现、Workspace 多租户 | ✅ 已完成 |
| [architecture/jwt.md](architecture/jwt.md) | JWT 认证：Access/Refresh Token、安全、存储 | ✅ 已完成 |

## 前端

| 文件 | 知识点 | 状态 |
|------|--------|------|
| [frontend/react-patterns.md](frontend/react-patterns.md) | **React 模式：** 懒加载、Context、路由守卫、API 层、useCallback | ✅ 已完成 |
| [frontend/dnd-kanban.md](frontend/dnd-kanban.md) | **@dnd-kit 看板拖拽：** DndContext、useSortable、空列修复、DragOverlay | ✅ 已完成 |
| [frontend/react-context-auth.md](frontend/react-context-auth.md) | React Context：认证状态管理、路由守卫、useAuth Hook | ✅ 已完成 |
| [frontend/shadcn-tailwind.md](frontend/shadcn-tailwind.md) | shadcn/ui + TailwindCSS v4：cn()、cva 变体、CSS 变量主题 | ✅ 已完成 |

## 计划中

以下知识点尚未创建文档，按需补充：

| 文件 | 知识点 |
|------|--------|
| go/go-concurrency.md | Go 并发：goroutine、channel、context、sync |
| go/go-testing.md | Go 测试：单元测试、表驱动、mock |
| architecture/event-driven.md | 事件驱动：Redis Streams、事件总线 |
| architecture/api-design.md | RESTful API 设计：命名、状态码、版本管理 |
| database/redis.md | Redis：数据结构、缓存策略 |
| devops/docker.md | Docker：Dockerfile、多阶段构建 |
| devops/migrate.md | 数据库迁移：golang-migrate |

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

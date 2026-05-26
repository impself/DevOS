# GORM ORM Patterns

DevOS 使用 GORM 作为 ORM 框架，配合 PostgreSQL。本文档记录项目中使用的 GORM 模式和踩过的坑。

---

## 1. 模型定义

### 基础模型

```go
// internal/task/model.go

type Task struct {
    ID          string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    ProjectID   string     `gorm:"type:uuid;not null;index"`
    Title       string     `gorm:"not null;size:200"`
    Description string     `gorm:"type:text"`
    Status      string     `gorm:"size:20;not null;default:'backlog'"`
    Priority    string     `gorm:"size:20;not null;default:'medium'"`
    Type        string     `gorm:"size:20;not null;default:'task'"`
    AssigneeID  *string    `gorm:"type:uuid"`              // 可空外键用指针
    SprintID    *string    `gorm:"type:uuid"`
    SortOrder   int        `gorm:"default:0"`
    DueDate     *time.Time `gorm:"type:date"`              // 可空日期用指针
    CreatedBy   string     `gorm:"type:uuid;not null"`
    CreatedAt   time.Time
    UpdatedAt   time.Time

    // 虚拟字段 — 不映射数据库列
    Tags               []tag.Tag `gorm:"-" json:"tags,omitempty"`
    AssigneeName       string    `gorm:"-" json:"assignee_name,omitempty"`
    AssigneeNickname   string    `gorm:"-" json:"assignee_nickname,omitempty"`
}
```

**关键字段标签：**

| 标签 | 含义 | 使用场景 |
|------|------|----------|
| `gorm:"-"` | 完全忽略该字段 | 虚拟字段、聚合数据 |
| `gorm:"->"` | 只读（允许 SELECT 但不参与 DDL） | 数据库计算列 |
| `gorm:"type:uuid"` | 指定列类型 | UUID 主键/外键 |
| `gorm:"not null"` | NOT NULL 约束 | 必填字段 |
| `gorm:"index"` | 创建索引 | 高频查询字段 |
| `gorm:"default:'x'"` | 默认值 | 状态字段 |

---

## 2. 可空字段处理

**规则：可空字段用指针类型。**

```go
// ✅ 正确 — 数据库 NULL → Go nil
AssigneeID *string    `gorm:"type:uuid"`
DueDate    *time.Time `gorm:"type:date"`

// ❌ 错误 — 数据库 NULL → Go 零值（空字符串 / 0001-01-01），无法区分"没有值"和"零值"
AssigneeID string    `gorm:"type:uuid"`
DueDate    time.Time `gorm:"type:date"`
```

---

## 3. 虚拟字段的坑：`gorm:"-"` vs `gorm:"->"`

### 问题描述

Task 模型有 `Tags []tag.Tag` 字段，用于 JSON 响应但不映射数据库。

```go
// ❌ 这会导致 AutoMigrate 崩溃
Tags []tag.Tag `gorm:"->" json:"tags,omitempty"`
```

**原因：** GORM 在 AutoMigrate 时，即使标记 `gorm:"->"`（只读），也会解析结构体切片字段。它把 `[]tag.Tag` 当作关联关系处理，尝试创建连接表，但因为跨包类型解析失败而崩溃。

```go
// ✅ 正确 — 用 gorm:"-" 完全跳过该字段
Tags []tag.Tag `gorm:"-" json:"tags,omitempty"`
```

**教训：** `gorm:"->"` 只跳过 DDL 写入（不建列），但 GORM 仍然**解析**该字段。`gorm:"-"` 才是完全忽略。

---

## 4. AutoMigrate

```go
// cmd/server/main.go
database.DB.AutoMigrate(
    &auth.User{},
    &project.Project{},
    &project.Member{},
    &task.Task{},
    &comment.Comment{},
    &tag.Tag{},
    &tag.TaskTag{},    // 多对多连接表
    &sprint.Sprint{},
)
```

**AutoMigrate 的行为：**
- 表不存在 → 创建表
- 表存在但缺少列 → 添加列
- 表存在且列存在 → **不做任何修改**（不会删列、改类型）
- 只适合开发环境，生产环境应使用版本化迁移工具（如 golang-migrate）

---

## 5. 查询模式

### 条件查询 + 分页

```go
// internal/task/repository.go

func (r *repository) List(projectID string, filters task.TaskFilters) ([]task.Task, int64, error) {
    var tasks []task.Task
    var total int64

    q := r.db.Where("project_id = ?", projectID)

    // 动态条件拼接
    if filters.Status != "" {
        q = q.Where("status = ?", filters.Status)
    }
    if filters.Priority != "" {
        q = q.Where("priority = ?", filters.Priority)
    }
    if filters.Assignee != "" {
        q = q.Where("assignee_id = ?", filters.Assignee)
    }
    if filters.SprintID != "" {
        q = q.Where("sprint_id = ?", filters.SprintID)
    }
    if filters.Search != "" {
        q = q.Where("title ILIKE ?", "%"+filters.Search+"%")
    }

    // 先算总数
    q.Model(&task.Task{}).Count(&total)

    // 再分页查询
    offset := (filters.Page - 1) * filters.PageSize
    err := q.Order("sort_order ASC, created_at DESC").
        Offset(offset).
        Limit(filters.PageSize).
        Find(&tasks).Error

    return tasks, total, err
}
```

### 关联查询（JOIN）

```go
// 获取任务时同时查出负责人信息
func (r *repository) FindByID(id string) (*task.Task, error) {
    var t task.Task
    err := r.db.
        Select("tasks.*, "+
            "users.username as assignee_name, "+
            "users.nickname as assignee_nickname, "+
            "u2.username as creator_name, "+
            "u2.nickname as creator_nickname").
        Joins("LEFT JOIN users ON users.id = tasks.assignee_id").
        Joins("LEFT JOIN users u2 ON u2.id = tasks.created_by").
        First(&t, "tasks.id = ?", id).Error
    return &t, err
}
```

**为什么用 JOIN 而不是 GORM Preload？**
- Preload 会发出额外 SQL 查询（N+1 问题）
- JOIN 在一条 SQL 中获取所有数据
- 对于简单关联（只需要几个字段），JOIN 更高效

### 批量统计（Raw SQL）

```go
// internal/sprint/repository.go — 统计每个 sprint 的任务数

func (r *repository) CountTasksBySprint(projectID string) (map[string]int, error) {
    type result struct {
        SprintID string
        Count    int
    }
    var results []result

    err := r.db.Raw(`
        SELECT sprint_id, COUNT(*) as count
        FROM tasks
        WHERE project_id = ? AND sprint_id IS NOT NULL
        GROUP BY sprint_id
    `, projectID).Scan(&results).Error

    counts := make(map[string]int)
    for _, r := range results {
        counts[r.SprintID] = r.Count
    }
    return counts, err
}
```

**为什么用 Raw SQL？**
- GORM 的聚合查询 API 对复杂统计不够直观
- Raw SQL 在 `GROUP BY + COUNT` 场景更清晰
- 扫描到自定义 struct，避免污染模型

---

## 6. 事务

```go
// internal/tag/repository.go — 批量设置任务标签（先删后插）

func (r *repository) SetTaskTags(taskID string, tagIDs []string) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        // 1. 删除旧关联
        if err := tx.Where("task_id = ?", taskID).Delete(&TaskTag{}).Error; err != nil {
            return err  // 返回 error 自动 rollback
        }

        // 2. 批量插入新关联
        if len(tagIDs) > 0 {
            var taskTags []TaskTag
            for _, tagID := range tagIDs {
                taskTags = append(taskTags, TaskTag{TaskID: taskID, TagID: tagID})
            }
            if err := tx.Create(&taskTags).Error; err != nil {
                return err
            }
        }

        return nil  // 返回 nil 自动 commit
    })
}
```

**GORM 事务模式：**
- `db.Transaction(func(tx *gorm.DB) error { ... })` — 自动 commit/rollback
- 返回 `nil` → commit
- 返回 `error` → rollback
- 比手动 `Begin()` / `Commit()` / `Rollback()` 更安全（不会忘 Rollback）

---

## 7. 多对多关系

### 连接表模型

```go
// internal/tag/model.go

type TaskTag struct {
    TaskID string `gorm:"type:uuid;primaryKey"`
    TagID  string `gorm:"type:uuid;primaryKey"`
}
```

### 查询任务的所有标签

```go
func (r *repository) FindTagsByTaskID(taskID string) ([]Tag, error) {
    var tags []Tag
    err := r.db.
        Table("tags").
        Joins("JOIN task_tags ON task_tags.tag_id = tags.id").
        Where("task_tags.task_id = ?", taskID).
        Find(&tags).Error
    return tags, err
}
```

### 批量查询多个任务的标签（避免 N+1）

```go
func (r *repository) FindTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error) {
    type taskTagResult struct {
        TaskID string
        Tag    Tag
    }
    var results []taskTagResult

    err := r.db.
        Table("task_tags").
        Select("task_tags.task_id, tags.*").
        Joins("JOIN tags ON tags.id = task_tags.tag_id").
        Where("task_tags.task_id IN ?", taskIDs).
        Scan(&results).Error

    // 按 taskID 分组
    tagMap := make(map[string][]Tag)
    for _, r := range results {
        tagMap[r.TaskID] = append(tagMap[r.TaskID], r.Tag)
    }
    return tagMap, err
}
```

---

## 8. 面试常见问题

### Q: GORM 的 Preload 和 Joins 有什么区别？

**A:**
- `Preload` — 发出额外 SELECT 查询，适合加载嵌套关联
- `Joins` — 在同一条 SQL 中 JOIN，适合简单关联
- Preload 会产生 1+N 条 SQL（N 是关联数量），Joins 只产生 1 条
- 对于一对一或只需要少量字段，Joins 更高效

### Q: AutoMigrate 有什么限制？

**A:**
- 只增不删 — 不会删除已存在的列
- 只增不改 — 不会修改已有列的类型
- 不支持重命名列
- 不支持数据迁移（如把字符串日期转成 date 类型）
- 生产环境应使用 golang-migrate 等版本化迁移工具

### Q: `gorm:"-"` 和 `json:"-"` 的区别？

**A:**
- `gorm:"-"` — GORM 忽略该字段，不参与数据库操作
- `json:"-"` — JSON 序列化忽略该字段
- 两者独立控制，可以组合：`gorm:"-" json:"tags"` 表示数据库不映射但 JSON 要输出

### Q: 为什么用 UUID 而不是自增 ID？

**A:**
1. **分布式安全** — 多个服务可以独立生成 UUID，不会冲突
2. **不可猜测** — 自增 ID 可以被猜测（`/users/1` → `/users/2`），UUID 不行
3. **前端友好** — 前端可以在不请求后端的情况下生成临时 ID
4. 详见 `docs/database/postgresql.md`

### Q: GORM 的软删除怎么用？

**A:** 在模型中加 `gorm.DeletedAt` 字段：

```go
type User struct {
    ID        string           `gorm:"primaryKey"`
    DeletedAt gorm.DeletedAt   `gorm:"index"`
}
```

- `Delete()` → 设置 `deleted_at` 而不是真删
- `Find()` → 自动过滤 `deleted_at IS NULL`
- `Unscoped().Find()` → 包含已删除记录
- 项目中大部分模块没有用软删除，直接硬删

### Q: 如何避免 GORM 查询的 N+1 问题？

**A:**
1. 使用 `Preload` 预加载关联
2. 使用 `Joins` 在一条 SQL 中关联查询
3. 批量查询 + 手动组装（项目中 Tags 的做法）
4. 使用 `Raw SQL` 做复杂聚合

---

## 9. 项目 GORM 使用统计

| 模式 | 使用位置 | 说明 |
|------|----------|------|
| 条件查询拼接 | task, sprint repository | 动态 WHERE |
| JOIN 关联查询 | task repository | 获取关联用户信息 |
| Raw SQL 聚合 | sprint repository | GROUP BY 统计 |
| 事务 | tag repository | 批量设置标签 |
| 多对多连接表 | tag repository | task_tags |
| 指针可空字段 | task, sprint model | *string, *time.Time |
| 虚拟字段 gorm:"-" | task model | Tags, AssigneeName |
| AutoMigrate | main.go | 所有模型 |

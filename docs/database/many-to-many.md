# 多对多关系 (Many-to-Many)

## 基础概念

多对多关系指两张表的记录之间可以相互关联多次 — A 记录对应多个 B 记录，B 记录也对应多个 A 记录。通过**中间关联表**（join table）实现，核心思想是"拆分关系为独立实体"。

**典型场景：** 任务-标签、用户-角色、商品-分类、文章-话题。

本项目：`tasks <- task_tags -> tags`。

**为什么不用 JSON 数组？** JSON 数组无法建立外键约束、无法高效反向查询（通过标签找任务）、无法利用索引优化 JOIN。

## 核心用法

### 数据模型

```sql
-- 标签表
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280'
);

-- 关联表（复合主键）
CREATE TABLE task_tags (
    task_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    PRIMARY KEY (task_id, tag_id)
);
```

### Go 模型

```go
// 标签实体
type Tag struct {
    ID        string `gorm:"type:uuid;primaryKey" json:"id"`
    ProjectID string `gorm:"type:uuid;not null" json:"project_id"`
    Name      string `gorm:"not null;size:50" json:"name"`
    Color     string `gorm:"size:7;default:'#6B7280'" json:"color"`
}

// 关联表实体
type TaskTag struct {
    TaskID string `gorm:"type:uuid;primaryKey" json:"task_id"`
    TagID  string `gorm:"type:uuid;primaryKey" json:"tag_id"`
}

// Task 中 Tags 不在数据库层面做关联，gorm:"-" 忽略
// 通过 tag.Repository.GetTagsByTaskIDs() 手动 JOIN 填充
```

### 批量查询（避免 N+1）

```go
// 一次 SQL 查所有 task 的标签
func (r *repository) GetTagsByTaskIDs(taskIDs []string) (map[string][]Tag, error) {
    var rows []struct {
        TaskID string
        TagID  string
        Name   string
        Color  string
    }
    err := r.db.Raw(`
        SELECT tt.task_id, t.id AS tag_id, t.name, t.color
        FROM task_tags tt
        JOIN tags t ON t.id = tt.tag_id
        WHERE tt.task_id IN ?
    `, taskIDs).Scan(&rows).Error

    result := make(map[string][]Tag)
    for _, row := range rows {
        result[row.TaskID] = append(result[row.TaskID], Tag{
            ID: row.TagID, Name: row.Name, Color: row.Color,
        })
    }
    return result, err
}
```

### CRUD 操作

```go
// 全量替换标签（先删后增）
func (s *service) SetTaskTags(taskID string, tagIDs []string) error {
    s.repo.RemoveAllTaskTags(taskID) // DELETE FROM task_tags WHERE task_id = ?
    return s.repo.AddTaskTags(taskID, tagIDs) // INSERT INTO task_tags ...
}

// 添加部分标签
func (r *repository) AddTaskTags(taskID string, tagIDs []string) error {
    var records []TaskTag
    for _, tid := range tagIDs {
        records = append(records, TaskTag{TaskID: taskID, TagID: tid})
    }
    return r.db.Create(&records).Error
}

// 删除时级联清理关联
func (r *repository) Delete(tagID string) error {
    r.db.Where("tag_id = ?", tagID).Delete(&TaskTag{})
    return r.db.Where("id = ?", tagID).Delete(&Tag{}).Error
}
```

## 核心思想 / 设计原理

### 复合主键 vs 独立 ID

关联表用 `(task_id, tag_id)` 复合主键而非独立 UUID。好处：
- 数据库层面保证唯一性（同一任务不能重复关联同一标签）
- 避免额外索引 — 复合主键自带索引
- 减小存储开销

### GORM AutoMigrate 陷阱

`Task` 中如果有 `Tags []Tag` 字段，即使加 `gorm:"->"`，AutoMigrate 仍会报错：`invalid field found ... define a valid foreign key`。因为 GORM 将 struct slice 视为 has-many 关系，找不到外键就报错。

**解决方案：** 用 `gorm:"-"` 完全跳过 GORM 管理，标签数据通过 handler 中的 `enrichTasks()` 手动填充。

### 全量替换 vs 增量更新

前端选择"全量替换"策略（PUT 全量传入新 tag_ids，后端先删后插），而非增量 API（每个标签单独 add/remove）。理由：
- 前端始终持有完整选中状态，传全量更简单
- 避免"先删 A 再插 B"变成两次请求的并发问题
- 关联表插入成本低（无大字段），全量替换性能可接受

### 跨包依赖的解耦

`task` 包需要 `tag.Tag` 类型但不直接导入 `tag` 包做数据库操作。通过 `TagFetcher` interface 注入：

```go
// task handler 不直接依赖 tag repository
type TagFetcher interface {
    GetTagsByTaskIDs(taskIDs []string) (map[string][]tag.Tag, error)
}
```

遵循依赖倒置原则：task 定义接口，tag 实现接口。

## 常见面试题

**Q: 多对多关系如何设计数据库？**
A: 通过中间关联表（join table），包含两个外键作为复合主键。如有额外属性（如"关联时间"），加在关联表上。

**Q: 关联表为什么用复合主键？**
A: 保证唯一性、自带索引、减少存储。如关联表有独立业务含义（如"订单"），再考虑独立 ID。

**Q: 如何避免 N+1 查询？**
A: 收集所有 task_id，一条 SQL `WHERE task_id IN (...)` 批量查出，应用层组装成 `map[taskID][]Tag`。

**Q: GORM 为什么拒绝 `[]Tag` 字段？**
A: GORM 视 struct slice 为关系字段，AutoMigrate 尝试建立外键但找不到定义。用 `gorm:"-"` 跳过，手动填充。

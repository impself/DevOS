# PostgreSQL

## 基础概念

### 是什么

PostgreSQL 是一个功能强大的开源关系型数据库管理系统（ORDBMS），以扩展性、标准兼容性和可靠性著称。它不仅是传统的关系型数据库，还支持 JSON/JSONB、全文搜索、地理空间（PostGIS）、向量检索（pgvector）等高级特性。

### 为什么选择 PostgreSQL

| 对比维度 | MySQL | PostgreSQL |
|---------|-------|------------|
| 并发控制 | 表锁为主（InnoDB 行锁） | MVCC，行级多版本 |
| 数据类型 | 基本类型丰富 | 更丰富（数组、JSONB、UUID、hstore、范围类型） |
| 扩展生态 | 中等 | 极强（PostGIS、pgvector、pg_stat_statements） |
| SQL 标准 | 部分兼容 | 高度兼容 |
| 全文搜索 | 基础支持 | 内置 tsvector/tsquery |
| JSON 支持 | JSON 类型 | JSONB（二进制 JSON，索引友好） |
| 向量检索 | 不支持 | pgvector 扩展 |

### 解决什么问题

- 关系数据存储 + JSON 灵活性：不需要为半结构化数据引入额外的 MongoDB
- 向量检索：AI/LLM 场景下不需要单独部署向量数据库
- 高并发读写：MVCC 机制支持高并发读不阻塞写

---

## 核心用法

### 1. UUID 主键 vs 自增 ID

#### 自增 ID（SERIAL / IDENTITY）

```sql
-- PostgreSQL 10+ 推荐 IDENTITY 语法
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

优点：索引效率高（8 字节，有序插入 B-tree 友好），存储小。
缺点：可预测（安全风险），分布式系统需要协调。

#### UUID 主键

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 或 PostgreSQL 13+ 内置 gen_random_uuid()

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

优点：全局唯一（分布式友好），不可预测（安全）。
缺点：16 字节（比 BIGINT 大一倍），随机插入导致 B-tree 索引碎片化。

#### 推荐：UUID v7（时间排序 + 随机）

```sql
-- PostgreSQL 17+ 内置 uuidv7()
-- 低版本可以用扩展或应用层生成

-- Go 应用层生成 UUID v7
-- go get github.com/google/uuid
```

```go
package main

import (
    "fmt"
    "github.com/google/uuid"
)

func main() {
    // UUID v7: 时间戳前缀 + 随机后缀
    // 既全局唯一，又保持时间递增，B-tree 友好
    id := uuid.Must(uuid.NewV7())
    fmt.Println(id.String())
    // 输出示例: 0190a6a8-7b3c-7d2e-8f1a-5b3c2d1e0f0a
}
```

```sql
-- 使用 UUID v7 作为主键
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 应用层传入 uuid.NewV7()
    name VARCHAR(200) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 实际选型建议

| 场景 | 推荐 |
|------|------|
| 单库单体应用 | BIGINT IDENTITY（简单高效） |
| 多服务共享数据 | UUID（全局唯一，不需要中心化 ID 生成器） |
| 高并发写入 | UUID v7（有序 UUID，B-tree 友好） |
| 外部暴露 ID | UUID（不可预测，防止 IDOR 攻击） |

### 2. 软删除（Soft Delete）

软删除不是真的从数据库删除记录，而是标记为"已删除"，查询时过滤掉。

#### 方案一：deleted_at 字段

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ  -- NULL = 未删除，有值 = 已删除
);

-- 部分索引：只索引未删除的记录
CREATE UNIQUE INDEX idx_documents_title_workspace
    ON documents (title, workspace_id)
    WHERE deleted_at IS NULL;

-- 查询时过滤
SELECT * FROM documents WHERE workspace_id = $1 AND deleted_at IS NULL;
```

```go
// GORM 软删除
type Document struct {
    ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    Title       string         `gorm:"size:500;not null" json:"title"`
    Content     string         `gorm:"type:text" json:"content"`
    WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
    CreatedAt   time.Time      `json:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at"`
    DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"` // GORM 自动处理
}

// GORM 的 Delete 操作会自动设置 deleted_at
db.Where("id = ?", id).Delete(&Document{})

// GORM 的查询自动排除已删除记录
db.Where("workspace_id = ?", wsID).Find(&docs)

// 查询包含已删除的记录
db.Unscoped().Where("workspace_id = ?", wsID).Find(&docs)
```

#### 方案二：status 字段

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, archived, deleted
    workspace_id UUID NOT NULL REFERENCES workspaces(id)
);

-- 部分索引
CREATE INDEX idx_projects_active ON projects (workspace_id)
    WHERE status = 'active';
```

#### 软删除的注意事项

```sql
-- 问题 1: 唯一约束需要用部分索引
-- 错误：唯一约束不考虑 deleted_at
-- UNIQUE (email)  -- 删除后无法重新注册同邮箱
-- 正确：
CREATE UNIQUE INDEX idx_users_email_unique ON users (email) WHERE deleted_at IS NULL;

-- 问题 2: 外键关联
-- 如果父记录软删除了，子记录还在，JOIN 查询需要额外处理
-- 解决：查询时始终加上 deleted_at IS NULL 条件

-- 问题 3: 数据膨胀
-- 软删除的数据越来越多，影响查询性能
-- 解决：定期归档到历史表，然后真删除
INSERT INTO documents_archive SELECT * FROM documents WHERE deleted_at < NOW() - INTERVAL '90 days';
DELETE FROM documents WHERE deleted_at < NOW() - INTERVAL '90 days';
```

### 3. 索引策略

#### B-tree 索引（默认）

```sql
-- 等值查询和范围查询
CREATE INDEX idx_users_email ON users (email);

-- 复合索引（最左前缀原则）
CREATE INDEX idx_documents_ws_created ON documents (workspace_id, created_at DESC);
-- 命中：WHERE workspace_id = $1
-- 命中：WHERE workspace_id = $1 ORDER BY created_at DESC
-- 不命中：WHERE created_at > $1（跳过了 workspace_id）
```

#### 部分索引（Partial Index）

```sql
-- 只索引有价值的记录，节省空间、提升性能
CREATE INDEX idx_tasks_pending ON tasks (assignee_id)
    WHERE status = 'pending';

CREATE INDEX idx_users_verified_email ON users (email)
    WHERE email_verified = true AND deleted_at IS NULL;
```

#### 覆盖索引（Covering Index）

```sql
-- PostgreSQL 11+ 支持 INCLUDE
-- 查询只需要索引中的列，不需要回表
CREATE INDEX idx_users_email_covering ON users (email)
    INCLUDE (name, avatar_url);

-- 这个查询可以完全在索引中完成
SELECT name, avatar_url FROM users WHERE email = 'test@example.com';
```

#### GIN 索引（JSONB、数组、全文搜索）

```sql
-- JSONB 查询
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN 索引加速 JSONB 查询
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- 查询示例
SELECT * FROM events
WHERE payload @> '{"type": "user.created"}'::jsonb;

SELECT * FROM events
WHERE payload->>'type' = 'user.created';
```

#### EXPLAIN ANALYZE 验证索引使用

```sql
-- 查看查询计划
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440000'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 关注点：
-- Seq Scan → 全表扫描，需要加索引
-- Index Scan → 使用索引，好的
-- Index Cond → 看看是不是用了预期的索引
-- Buffers: shared hit → 缓存命中情况
```

### 4. pgvector 向量检索

pgvector 是 PostgreSQL 的向量检索扩展，支持存储和检索 embedding 向量，常用于 AI/LLM 场景中的 RAG（检索增强生成）。

#### 安装和启用

```sql
-- 安装扩展（需要 PostgreSQL 11+）
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 基本使用

```sql
-- 创建带向量列的表
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,  -- OpenAI text-embedding-3-small 维度
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```go
// Go 中使用 pgvector
import (
    "fmt"
    "github.com/pgvector/pgvector-go"
    "gorm.io/gorm"
)

type KnowledgeEntry struct {
    ID          uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    WorkspaceID uuid.UUID       `gorm:"type:uuid;not null" json:"workspace_id"`
    Title       string          `gorm:"size:500;not null" json:"title"`
    Content     string          `gorm:"type:text;not null" json:"content"`
    Embedding   pgvector.Vector `gorm:"type:vector(1536)" json:"-"`
    CreatedAt   time.Time       `json:"created_at"`
}

// 插入向量
func (r *KnowledgeRepo) Create(ctx context.Context, entry *KnowledgeEntry) error {
    return r.db.WithContext(ctx).Create(entry).Error
}

// 相似度搜索
func (r *KnowledgeRepo) SearchSimilar(ctx context.Context, workspaceID uuid.UUID, queryVector pgvector.Vector, limit int) ([]KnowledgeEntry, error) {
    var results []KnowledgeEntry
    err := r.db.WithContext(ctx).
        Where("workspace_id = ?", workspaceID).
        Order(fmt.Sprintf("embedding <=> '%s'", queryVector.String())).
        Limit(limit).
        Find(&results).Error
    return results, err
}
```

#### 索引类型

```sql
-- HNSW 索引（推荐，查询速度快）
-- 适合大多数 RAG 场景
CREATE INDEX idx_knowledge_embedding_hnsw
    ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
-- 可选参数：
-- WITH (m = 16, ef_construction = 64)  -- m 越大精度越高但占用越多

-- IVFFlat 索引（需要先有一定数据量）
-- 适合大规模数据集（> 100 万条）
CREATE INDEX idx_knowledge_embedding_ivfflat
    ON knowledge_entries USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);  -- lists 通常设为 rows / 1000
```

#### 距离度量方式

| 操作符 | 度量方式 | 公式 | 适用场景 |
|--------|---------|------|---------|
| `<->` | L2 距离 | 欧几里得距离 | 通用 |
| `<=>` | 余弦距离 | 1 - cos(a,b) | 文本 embedding（推荐） |
| `<#>` | 内积 | -dot(a,b) | 归一化向量 |

```sql
-- 余弦相似度搜索（最常用）
SELECT id, title, content,
       1 - (embedding <=> $1) AS similarity
FROM knowledge_entries
WHERE workspace_id = $2
ORDER BY embedding <=> $1
LIMIT 10;

-- 带阈值过滤
SELECT id, title, content
FROM knowledge_entries
WHERE workspace_id = $1
  AND embedding <=> $2 < 0.3  -- 距离阈值
ORDER BY embedding <=> $2
LIMIT 10;
```

---

## 核心思想 / 设计原理

### 1. PostgreSQL MVCC 机制

MVCC（多版本并发控制）是 PostgreSQL 并发的核心原理：

- 每行数据有 `xmin`（创建事务 ID）和 `xmax`（删除事务 ID）两个隐藏字段
- 读操作不阻塞写操作：每个事务看到的是数据的"快照"（Snapshot）
- UPDATE 实际上是 DELETE + INSERT（旧版本标记为过期，新版本插入）

```
事务 100: INSERT (id=1, name='Alice')  → xmin=100, xmax=0
事务 200: UPDATE (name='Bob') WHERE id=1  →
  旧行: xmin=100, xmax=200  (对事务 >=200 不可见)
  新行: xmin=200, xmax=0    (name='Bob')
```

MVCC 的代价：
- **表膨胀（Bloat）**：频繁 UPDATE 产生大量死元组（dead tuples），需要 VACUUM 清理
- **索引膨胀**：索引也会包含过期版本的指针

```sql
-- 查看表的膨胀情况
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- 手动触发 VACUUM（通常 autovacuum 自动处理）
VACUUM ANALYZE documents;

-- 严重膨胀时用 VACUUM FULL（锁表，重建整个表）
-- 生产环境慎用
VACUUM FULL documents;
```

### 2. WAL（Write-Ahead Logging）

PostgreSQL 的持久性保证基于 WAL 原则：

1. 数据修改前，先将变更写入 WAL 日志（顺序写入，速度快）
2. WAL 写入成功后，再修改内存中的数据页
3. 事务 COMMIT 时，确保 WAL 到到磁盘（`fsync`）
4. 崩溃恢复时，重放 WAL 日志恢复数据

```
写操作流程：
Application → WAL Buffer → WAL File (fsync) → Data Buffer → Data File
             ↑               ↑
             顺序写入         COMMIT 时必须 fsync
```

WAL 相关配置调优：

```sql
-- 查看 WAL 配置
SHOW wal_level;             -- replica（推荐）或 logical（用于 CDC）
SHOW max_wal_size;          -- WAL 最大保留（默认 1GB，大数据量建议调大）
SHOW min_wal_size;          -- WAL 最小保留
SHOW checkpoint_completion_target;  -- 0.9（让 checkpoint 分散写入）
```

### 3. 查询优化器

PostgreSQL 的查询优化器是**基于代价的（Cost-Based Optimizer）**：

- 统计信息收集：`ANALYZE` 命令采样表数据，记录每列的 distinct 值数量、数据分布等
- 代价估算：基于统计信息估算不同执行计划的 I/O 和 CPU 代价
- 选择最优计划：比较所有可能的执行路径，选代价最低的

```sql
-- 手动更新统计信息
ANALYZE documents;

-- 查看表的统计信息
SELECT * FROM pg_stats WHERE tablename = 'documents';

-- 关键字段：
-- null_frac: NULL 比例
-- n_distinct: distinct 值估计
-- most_common_vals: 高频值
-- histogram_bounds: 值分布直方图
```

---

## 常见面试题

### Q1: UUID 主键会导致索引性能下降吗？你怎么解决？

**参考答案**：

会。原因是 UUID v4 是完全随机的，插入时会导致 B-tree 索引大量随机 I/O 和页分裂：

- B-tree 的有序性要求新插入的行在索引中的位置是随机的
- 导致索引页频繁分裂，写入放大
- 缓存命中率低（随机访问模式）

解决方案：

1. **UUID v7**（推荐）：时间戳前缀 + 随机后缀，保持时间递增，B-tree 友好
   ```go
   id := uuid.Must(uuid.NewV7()) // Go 生成
   ```

2. **ULID**：类似 UUID v7，26 字符的 Crockford's Base32 编码
   ```go
   import "github.com/oklog/ulid/v2"
   id := ulid.Make()
   ```

3. **雪花算法（Snowflake）**：如果可以用 BIGINT，Twitter 的 Snowflake ID 有序且高效
   ```go
   import "github.com/bwmarrin/snowflake"
   node, _ := snowflake.NewNode(1)
   id := node.Generate().Int64()
   ```

4. **组合方案**：内部关联用 BIGINT 自增，对外暴露用 UUID（映射表或 UUID 列）

### Q2: PostgreSQL 的 VACUUM 机制是什么？为什么需要它？

**参考答案**：

VACUUM 是 PostgreSQL 的垃圾回收机制，负责清理 MVCC 产生的死元组（dead tuples）：

**为什么需要**：
- PostgreSQL 的 UPDATE 是"标记删除 + 插入新行"，UPDATE 和 DELETE 不会立即回收空间
- 死元组累积会导致表膨胀（bloat），查询需要跳过大量无效行，性能下降
- 索引也会膨胀，包含指向死元组的指针

**VACUUM 的行为**：
- 标记死元组的空间为"可重用"（不归还操作系统，除非行在表末尾）
- 更新统计信息（`VACUUM ANALYZE`）
- 更新 visibility map 和 free space map

**VACUUM FULL**：
- 重建整个表，归还空间给操作系统
- 期间持有排他锁，阻塞所有读写
- 生产环境避免使用，用 `pg_repack` 扩展替代（在线重建）

**autovacuum 调优**：
```sql
-- 触发阈值：当死元组数量超过时自动触发
-- threshold = autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * 行数
ALTER TABLE documents SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- 5% 的行被修改后触发（默认 0.2）
    autovacuum_analyze_scale_factor = 0.02  -- 2% 的行被修改后更新统计信息
);
```

### Q3: 为什么说 pgvector 可以替代专用向量数据库？什么场景下又不行？

**参考答案**：

**pgvector 的优势**：
- 不需要额外的基础设施，和业务数据在同一个数据库
- 可以用 SQL 做"向量检索 + 关系过滤"的联合查询
- 事务一致性：向量插入和业务数据插入在同一个事务中
- 运维成本低，不需要学习新系统

```sql
-- pgvector 的杀手级能力：向量检索 + 关系过滤
SELECT k.title, k.content, 1 - (k.embedding <=> $1) AS score
FROM knowledge_entries k
JOIN projects p ON k.project_id = p.id
JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
WHERE wm.user_id = $2           -- 权限过滤
  AND k.created_at > NOW() - INTERVAL '30 days'  -- 时间过滤
  AND k.embedding <=> $1 < 0.3  -- 相似度过滤
ORDER BY k.embedding <=> $1
LIMIT 10;
```

**pgvector 不够的场景**：
- 数据量超过 10 亿条向量，HNSW 索引内存占用过大
- 需要毫秒级延迟的实时推荐系统（专用向量数据库通常做了更极致的优化）
- 需要分布式向量检索（pgvector 单节点，不支持分片）
- 需要混合检索（BM25 + 向量），如 Elasticsearch 的能力

**实际建议**：
- 日活 < 100 万用户、向量数据 < 1000 万条：pgvector 完全够用
- 需要分布式或极致性能：Milvus、Qdrant、Weaviate

### Q4: 软删除和硬删除怎么选？软删除有哪些坑？

**参考答案**：

**软删除适用场景**：
- 需要数据恢复能力（用户误删）
- 需要"回收站"功能
- 合规要求（数据保留 N 天）
- 需要审计追踪

**硬删除适用场景**：
- GDPR 等隐私法规要求"被遗忘权"
- 数据量极大，软删除导致性能问题
- 存储成本敏感

**软删除的坑**：

1. **唯一约束冲突**：删除后无法重新创建同名记录
   ```sql
   -- 解决：部分索引
   CREATE UNIQUE INDEX idx_ws_name ON workspaces (name, owner_id)
       WHERE deleted_at IS NULL;
   ```

2. **查询性能退化**：每条查询都要加 `WHERE deleted_at IS NULL`
   ```sql
   -- 解决：部分索引 + View
   CREATE VIEW active_documents AS
   SELECT * FROM documents WHERE deleted_at IS NULL;
   ```

3. **JOIN 笨重**：关联查询需要每个表都加过滤条件
   ```go
   // 解决：GORM 的 Session 配置全局 scope
   db.Scopes(SoftDeleteScope).Joins("Workspace").Find(&docs)
   ```

4. **数据膨胀**：大量已删除数据占用空间
   ```sql
   -- 解决：定期归档
   -- 归档 → 真删除
   ```

**我的实际做法**：核心业务表（用户、工作空间）用软删除 + 90 天自动归档；日志型数据（操作记录、事件）直接硬删除 + 保留最近 N 天。

### Q5: PostgreSQL 的 JSONB 和 MongoDB 的文档模型相比，各有什么优劣？

**参考答案**：

| 维度 | PostgreSQL JSONB | MongoDB |
|------|-----------------|---------|
| 事务 | 完整 ACID | 4.0+ 支持多文档事务 |
| 查询 | SQL + JSON 操作符 | MongoDB Query Language |
| 索引 | GIN 索引（可结合 B-tree） | 丰富的索引类型 |
| 关系 | 天然 JOIN | $lookup（弱于 JOIN） |
| 一致性 | 强一致性 | 可调（默认最终一致） |
| Schema | 可约束（CHECK 约束） | Schemaless 或 Validation Rule |
| 生态 | 丰富（触发器、存储过程、扩展） | 文档模型生态 |

**选择建议**：
- 主数据是结构化关系数据 + 少量半结构化字段 → PostgreSQL JSONB
- 数据模型完全是文档型、无固定 schema、嵌套层级深 → MongoDB
- 实际项目中，PostgreSQL JSONB 已经能满足大多数场景，避免引入额外的数据库

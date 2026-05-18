# RBAC 权限模型

## 基础概念

### 是什么

RBAC（Role-Based Access Control，基于角色的访问控制）是一种权限管理模型：**不直接给用户授权限，而是给角色授权限，再将角色分配给用户**。用户通过关联的角色获得权限。

核心三要素：
- **用户（User）**：系统中的操作者
- **角色（Role）**：权限的集合，如 admin、editor、viewer
- **权限（Permission）**：对资源的操作，如 `document:read`、`document:write`

### 为什么要用 RBAC

直接给每个用户配置权限（ACL 模型）在用户量大、权限复杂时无法维护：

```
ACL 模式：用户 → 权限（N:M 关系爆炸）
RBAC 模式：用户 → 角色 → 权限（引入中间层，减少复杂度）
```

RBAC 的好处：
- **简化管理**：新增员工只需分配角色，不需要逐个配权限
- **一致性**：相同角色的用户权限一致，不会遗漏
- **审计友好**：查看角色权限即可了解所有人的权限范围
- **最小权限原则**：通过精细的角色设计控制权限范围

### 解决什么问题

在 DevOS 这样的多租户 SaaS 系统中，需要解决：
- 同一个用户在不同工作空间可能有不同角色（张三在 A 空间是管理员，在 B 空间是普通成员）
- 权限需要分级：工作空间级别、项目级别、文档级别
- 多租户隔离：用户只能访问自己所在工作空间的资源

---

## 核心用法

### 三级权限模型：Workspace → Project → Resource

```
Workspace（工作空间）
├── Role: owner / admin / member / guest
├── Project（项目）
│   ├── Role: admin / editor / viewer
│   └── Resource（文档/知识库）
│       └── Permission: read / write / admin
```

#### 数据库模型设计

```sql
-- 工作空间
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id),
    plan VARCHAR(20) NOT NULL DEFAULT 'free', -- free, pro, enterprise
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 工作空间角色（workspace 级别的角色）
CREATE TABLE workspace_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,       -- owner, admin, member, guest
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL,      -- 权限列表
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 工作空间成员
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES workspace_roles(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- 项目
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 项目成员（可以覆盖 workspace 级别的角色）
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,        -- admin, editor, viewer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
```

### 权限定义

```go
// internal/auth/permissions.go
package auth

// Permission 格式: resource:action
type Permission string

const (
    // 工作空间级别权限
    PermWorkspaceRead       Permission = "workspace:read"
    PermWorkspaceUpdate     Permission = "workspace:update"
    PermWorkspaceDelete     Permission = "workspace:delete"
    PermWorkspaceInvite     Permission = "workspace:invite"
    PermWorkspaceRemoveUser Permission = "workspace:remove_user"
    PermWorkspaceManageRole Permission = "workspace:manage_role"

    // 项目级别权限
    PermProjectCreate       Permission = "project:create"
    PermProjectRead         Permission = "project:read"
    PermProjectUpdate       Permission = "project:update"
    PermProjectDelete       Permission = "project:delete"

    // 文档级别权限
    PermDocumentCreate      Permission = "document:create"
    PermDocumentRead        Permission = "document:read"
    PermDocumentUpdate      Permission = "document:update"
    PermDocumentDelete      Permission = "document:delete"
    PermDocumentShare       Permission = "document:share"
)

// 预定义角色权限映射
var RolePermissions = map[string][]Permission{
    "owner": {
        PermWorkspaceRead, PermWorkspaceUpdate, PermWorkspaceDelete,
        PermWorkspaceInvite, PermWorkspaceRemoveUser, PermWorkspaceManageRole,
        PermProjectCreate, PermProjectRead, PermProjectUpdate, PermProjectDelete,
        PermDocumentCreate, PermDocumentRead, PermDocumentUpdate, PermDocumentDelete, PermDocumentShare,
    },
    "admin": {
        PermWorkspaceRead, PermWorkspaceUpdate,
        PermWorkspaceInvite, PermWorkspaceRemoveUser,
        PermProjectCreate, PermProjectRead, PermProjectUpdate, PermProjectDelete,
        PermDocumentCreate, PermDocumentRead, PermDocumentUpdate, PermDocumentDelete, PermDocumentShare,
    },
    "member": {
        PermWorkspaceRead,
        PermProjectCreate, PermProjectRead, PermProjectUpdate,
        PermDocumentCreate, PermDocumentRead, PermDocumentUpdate, PermDocumentDelete,
    },
    "guest": {
        PermWorkspaceRead,
        PermProjectRead,
        PermDocumentRead,
    },
}
```

### 权限检查中间件

```go
// internal/middleware/rbac.go
package middleware

import (
    "net/http"

    "github.com/yourname/devos/internal/auth"
    "github.com/gin-gonic/gin"
)

// RequirePermission 检查用户是否拥有指定权限
func RequirePermission(rbacService RBACService, perm auth.Permission) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString(ContextKeyUserID)
        if userID == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
            return
        }

        // 从路径参数获取 workspace_id / project_id
        workspaceID := c.Param("workspace_id")
        if workspaceID == "" {
            c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing workspace_id"})
            return
        }

        // 检查权限
        hasPermission, err := rbacService.CheckPermission(c.Request.Context(), userID, workspaceID, perm)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "permission check failed"})
            return
        }

        if !hasPermission {
            c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
                "error":       "insufficient permissions",
                "required":    string(perm),
            })
            return
        }

        c.Next()
    }
}

// RequireAnyPermission 检查用户是否拥有任一指定权限（OR 逻辑）
func RequireAnyPermission(rbacService RBACService, perms ...auth.Permission) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString(ContextKeyUserID)
        workspaceID := c.Param("workspace_id")

        for _, perm := range perms {
            hasPermission, err := rbacService.CheckPermission(c.Request.Context(), userID, workspaceID, perm)
            if err == nil && hasPermission {
                c.Next()
                return
            }
        }

        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
    }
}
```

### RBAC Service 实现

```go
// internal/service/rbac_service.go
package service

import (
    "context"
    "fmt"

    "github.com/yourname/devos/internal/auth"
    "github.com/yourname/devos/internal/repository"
)

type RBACService interface {
    CheckPermission(ctx context.Context, userID, workspaceID string, perm auth.Permission) (bool, error)
    GetUserPermissions(ctx context.Context, userID, workspaceID string) ([]auth.Permission, error)
    AssignRole(ctx context.Context, workspaceID, userID, role string) error
    RevokeRole(ctx context.Context, workspaceID, userID string) error
}

type rbacService struct {
    memberRepo repository.WorkspaceMemberRepository
    roleRepo   repository.RoleRepository
}

func NewRBACService(memberRepo repository.WorkspaceMemberRepository, roleRepo repository.RoleRepository) RBACService {
    return &rbacService{
        memberRepo: memberRepo,
        roleRepo:   roleRepo,
    }
}

func (s *rbacService) CheckPermission(ctx context.Context, userID, workspaceID string, perm auth.Permission) (bool, error) {
    // 1. 获取用户在该 workspace 的角色
    member, err := s.memberRepo.GetByUserAndWorkspace(ctx, userID, workspaceID)
    if err != nil {
        return false, fmt.Errorf("user is not a member of this workspace: %w", err)
    }

    // 2. 获取角色的权限列表
    permissions, exists := auth.RolePermissions[member.Role]
    if !exists {
        return false, nil
    }

    // 3. 检查是否包含目标权限
    for _, p := range permissions {
        if p == perm {
            return true, nil
        }
    }

    return false, nil
}

func (s *rbacService) GetUserPermissions(ctx context.Context, userID, workspaceID string) ([]auth.Permission, error) {
    member, err := s.memberRepo.GetByUserAndWorkspace(ctx, userID, workspaceID)
    if err != nil {
        return nil, err
    }

    permissions, exists := auth.RolePermissions[member.Role]
    if !exists {
        return []auth.Permission{}, nil
    }

    // 返回副本，防止外部修改
    result := make([]auth.Permission, len(permissions))
    copy(result, permissions)
    return result, nil
}

func (s *rbacService) AssignRole(ctx context.Context, workspaceID, userID, role string) error {
    // 验证角色是否合法
    if _, exists := auth.RolePermissions[role]; !exists {
        return fmt.Errorf("invalid role: %s", role)
    }

    return s.memberRepo.Upsert(ctx, workspaceID, userID, role)
}

func (s *rbacService) RevokeRole(ctx context.Context, workspaceID, userID string) error {
    return s.memberRepo.Delete(ctx, workspaceID, userID)
}
```

### 路由注册中使用权限中间件

```go
// cmd/api/main.go（路由注册部分）
func setupRoutes(r *gin.Engine, rbacSvc service.RBACService) {
    api := r.Group("/api/v1")

    // 认证路由（不需要权限检查）
    auth := api.Group("/auth")
    {
        auth.POST("/login", authHandler.Login)
        auth.POST("/refresh", authHandler.Refresh)
        auth.POST("/logout", authHandler.Logout)
    }

    // 需要 JWT 认证的路由
    authenticated := api.Group("")
    authenticated.Use(middleware.AuthMiddleware(jwtManager))
    {
        // 工作空间路由
        workspaces := authenticated.Group("/workspaces/:workspace_id")
        {
            // 所有成员可读
            workspaces.GET("",
                middleware.RequirePermission(rbacSvc, auth.PermWorkspaceRead),
                workspaceHandler.Get,
            )
            // 只有 admin 以上可修改
            workspaces.PUT("",
                middleware.RequirePermission(rbacSvc, auth.PermWorkspaceUpdate),
                workspaceHandler.Update,
            )
            // 只有 owner 可删除
            workspaces.DELETE("",
                middleware.RequirePermission(rbacSvc, auth.PermWorkspaceDelete),
                workspaceHandler.Delete,
            )
            // 邀请成员
            workspaces.POST("/members",
                middleware.RequirePermission(rbacSvc, auth.PermWorkspaceInvite),
                workspaceHandler.InviteMember,
            )
            // 移除成员
            workspaces.DELETE("/members/:user_id",
                middleware.RequirePermission(rbacSvc, auth.PermWorkspaceRemoveUser),
                workspaceHandler.RemoveMember,
            )

            // 项目路由
            projects := workspaces.Group("/projects")
            {
                projects.GET("",
                    middleware.RequirePermission(rbacSvc, auth.PermProjectRead),
                    projectHandler.List,
                )
                projects.POST("",
                    middleware.RequirePermission(rbacSvc, auth.PermProjectCreate),
                    projectHandler.Create,
                )
                projects.PUT("/:project_id",
                    middleware.RequirePermission(rbacSvc, auth.PermProjectUpdate),
                    projectHandler.Update,
                )
                projects.DELETE("/:project_id",
                    middleware.RequirePermission(rbacSvc, auth.PermProjectDelete),
                    projectHandler.Delete,
                )
            }
        }
    }
}
```

---

## 核心思想 / 设计原理

### 1. RBAC 模型的演进

```
RBAC0（基础）：用户 → 角色 → 权限
RBAC1（角色继承）：角色可以继承（admin 继承 member 的所有权限）
RBAC2（约束）：互斥角色、角色数量限制
RBAC3（组合）：RBAC1 + RBAC2
```

在实际项目中，RBAC0 + 简单的继承关系已经足够。不需要过度设计。

### 2. Casbin vs 自研

| 维度 | Casbin | 自研 |
|------|--------|------|
| 功能 | 极丰富（ABAC、ACL、RBAC、多租户） | 只实现需要的 |
| 性能 | 模型加载有开销，策略多时需要适配器 | 直接查数据库 + 缓存，可控 |
| 学习曲线 | 需要学习 PERM 模型语法 | 直观，代码即文档 |
| 灵活性 | 配置文件驱动，动态调整 | 改代码，需要重新部署 |
| 适用场景 | 权限规则复杂且频繁变化 | 权限模型固定，追求简单可控 |

**建议**：大多数 Go Web 项目自研即可。Casbin 适合权限规则非常复杂（如需要 ABAC、策略动态加载）的场景。

```go
// Casbin 示例（如果选择使用）
import "github.com/casbin/casbin/v2"
import "github.com/casbin/gorm-adapter/v3"

// 模型文件 model.conf
// [request_definition]
// r = sub, dom, obj, act
//
// [policy_definition]
// p = sub, dom, obj, act
//
// [role_definition]
// g = _, _
//
// [policy_effect]
// e = some(where (p.eft == allow))
//
// [matchers]
// m = g(r.sub, p.sub, r.dom) && r.dom == p.dom && r.obj == p.obj && r.act == p.act

// 策略示例（数据库存储）
// p, admin, workspace-1, documents, read
// p, admin, workspace-1, documents, write
// p, member, workspace-1, documents, read
// g, user-123, admin, workspace-1

func setupCasbin(db *gorm.DB) (*casbin.Enforcer, error) {
    adapter, err := gormadapter.NewAdapterByDB(db)
    if err != nil {
        return nil, err
    }
    return casbin.NewEnforcer("rbac_model.conf", adapter)
}
```

### 3. 多租户设计中的权限隔离

多租户 SaaS 系统的权限隔离有两个层面：

**数据隔离**（Row-Level Security）：

```sql
-- PostgreSQL RLS（Row-Level Security）
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能看到自己所在 workspace 的文档
CREATE POLICY workspace_isolation ON documents
    USING (
        workspace_id IN (
            SELECT wm.workspace_id
            FROM workspace_members wm
            WHERE wm.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Go 中设置当前用户 ID
func setCurrentUser(db *gorm.DB, userID string) *gorm.DB {
    return db.Exec("SET app.current_user_id = ?", userID)
}
```

**应用层隔离**（更常用、更灵活）：

```go
// 所有查询都带上 workspace_id 条件
func (r *documentRepo) List(ctx context.Context, workspaceID string, opts ListOptions) ([]Document, error) {
    var docs []Document
    query := r.db.WithContext(ctx).
        Where("workspace_id = ? AND deleted_at IS NULL", workspaceID) // 强制隔离

    if opts.ProjectID != "" {
        query = query.Where("project_id = ?", opts.ProjectID)
    }

    err := query.Order("created_at DESC").
        Limit(opts.Limit).
        Offset(opts.Offset).
        Find(&docs).Error
    return docs, err
}
```

### 4. 权限缓存策略

每次请求都查数据库做权限检查太昂贵，需要缓存：

```go
// 使用 Redis 缓存用户权限
type cachedRBACService struct {
    inner  RBACService
    redis  *redis.Client
    ttl    time.Duration
}

func (s *cachedRBACService) CheckPermission(ctx context.Context, userID, workspaceID string, perm auth.Permission) (bool, error) {
    cacheKey := fmt.Sprintf("perm:%s:%s", userID, workspaceID)

    // 先查缓存
    cached, err := s.redis.Get(ctx, cacheKey).Result()
    if err == nil {
        // 缓存命中，检查是否包含目标权限
        var perms []auth.Permission
        json.Unmarshal([]byte(cached), &perms)
        for _, p := range perms {
            if p == perm {
                return true, nil
            }
        }
        return false, nil
    }

    // 缓存未命中，查数据库
    perms, err := s.inner.GetUserPermissions(ctx, userID, workspaceID)
    if err != nil {
        return false, err
    }

    // 写入缓存
    data, _ := json.Marshal(perms)
    s.redis.Set(ctx, cacheKey, data, s.ttl)

    // 检查权限
    for _, p := range perms {
        if p == perm {
            return true, nil
        }
    }
    return false, nil
}

// 角色变更时清除缓存
func (s *cachedRBACService) AssignRole(ctx context.Context, workspaceID, userID, role string) error {
    err := s.inner.AssignRole(ctx, workspaceID, userID, role)
    if err != nil {
        return err
    }
    // 清除权限缓存
    s.redis.Del(ctx, fmt.Sprintf("perm:%s:%s", userID, workspaceID))
    return nil
}
```

---

## 常见面试题

### Q1: RBAC 和 ABAC 有什么区别？什么时候需要 ABAC？

**参考答案**：

| 维度 | RBAC | ABAC |
|------|------|------|
| 决策依据 | 角色（静态） | 属性（动态） |
| 粒度 | 角色级别 | 任意属性组合 |
| 灵活性 | 中等 | 极高 |
| 管理复杂度 | 低 | 高 |

RBAC 的权限决策：`用户是 admin → 可以删除项目`
ABAC 的权限决策：`用户.department == 项目.department && 用户.level >= 5 && 时间在 9:00-18:00`

**需要 ABAC 的场景**：
- 权限依赖上下文（时间、IP、设备、地理位置）
- 数据级别的精细控制（"只能看到自己部门的数据"）
- 动态规则经常变化（不想为每个规则创建角色）

**实际建议**：90% 的项目 RBAC 就够了。如果只是需要"数据级别隔离"（如多租户），RBAC + 行级过滤（RLS）就够了。只有当权限规则本身复杂到需要动态引擎时才引入 ABAC。

### Q2: 多租户系统中，一个用户在不同租户有不同角色，你怎么设计？

**参考答案**：

核心设计原则：**权限判断永远在租户上下文中进行**。

```go
// 用户-租户-角色 关联表
type WorkspaceMember struct {
    UserID      uuid.UUID `gorm:"type:uuid"`
    WorkspaceID uuid.UUID `gorm:"type:uuid"`
    Role        string    // 在这个 workspace 的角色
}

// 张三在 A 空间是 admin，在 B 空间是 member
// 这是两条不同的记录
```

请求处理流程：

1. 用户登录后，JWT 中只存 `user_id`，不存角色
2. 每次 API 请求，URL 路径中包含 `workspace_id`
3. 权限中间件根据 `user_id` + `workspace_id` 查询角色
4. 根据角色判断是否有权限

```go
// 绝对不能这样做（安全漏洞）：
// JWT 中存 { user_id: "123", role: "admin" }
// 因为用户可能是另一个 workspace 的 admin，但不是当前 workspace 的

// 正确做法：
// JWT 中存 { user_id: "123" }
// 权限检查时用 (user_id, workspace_id) 查询角色
```

如果用户需要在不同租户之间切换：
- 前端在切换 workspace 时，重新获取该 workspace 下的权限列表
- 后端每次请求都基于 URL 中的 `workspace_id` 做权限检查

### Q3: 如果需要支持"临时授权"（比如让外部协作者 7 天内可编辑），怎么设计？

**参考答案**：

在成员表中增加时间约束字段：

```sql
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ,         -- NULL = 永久，有值 = 到期时间
    granted_by UUID REFERENCES users(id),  -- 谁授予的
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);
```

```go
// 权限检查时加入过期判断
func (s *rbacService) CheckPermission(ctx context.Context, userID, workspaceID string, perm auth.Permission) (bool, error) {
    member, err := s.memberRepo.GetByUserAndWorkspace(ctx, userID, workspaceID)
    if err != nil {
        return false, err
    }

    // 检查是否过期
    if member.ExpiresAt != nil && member.ExpiresAt.Before(time.Now()) {
        // 过期了，清理角色
        s.memberRepo.Delete(ctx, workspaceID, userID)
        return false, nil
    }

    // 正常的权限检查
    return hasPermission(member.Role, perm), nil
}
```

扩展设计——邀请链接：

```sql
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    token VARCHAR(64) NOT NULL UNIQUE,  -- 邀请 token
    role VARCHAR(30) NOT NULL,          -- 被邀请者的角色
    max_uses INT,                        -- 最大使用次数（NULL = 无限）
    use_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,     -- 链接过期时间
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Q4: RBAC 中的"角色爆炸"问题是什么？怎么解决？

**参考答案**：

角色爆炸（Role Explosion）是指当权限组合太多时，需要创建大量角色：

```
假设一个系统有 10 个功能模块，每个模块有 read/write/admin 三个权限
理论上需要 3^10 = 59049 个角色才能覆盖所有组合
```

解决方案：

1. **权限组（Permission Group）**：将权限按模块分组，用户可以分配多个权限组
   ```go
   // 不是定义 59049 个角色，而是定义 10 个模块权限组
   type PermissionGroup struct {
       Name        string
       Permissions []Permission
   }

   // 用户 = 多个 PermissionGroup 的组合
   user.Groups = []PermissionGroup{DocumentEditor, ProjectViewer}
   ```

2. **混合模型（RBAC + ACL）**：角色控制基础权限，个别用户的特殊权限用 ACL 补充
   ```go
   // 先检查角色权限
   if hasRolePermission(user.Role, perm) {
       return true
   }
   // 再检查用户的特殊权限（ACL）
   if hasUserPermission(user.ID, resource, perm) {
       return true
   }
   return false
   ```

3. **数据驱动角色**：不预定义角色，而是让管理员自由组合权限创建角色
   ```sql
   -- 自定义角色
   INSERT INTO workspace_roles (name, workspace_id, permissions)
   VALUES ('custom-editor', 'ws-1',
       ARRAY['document:read', 'document:write', 'project:read']);
   ```

实际建议：预定义 4-6 个标准角色（owner/admin/member/guest），再支持自定义角色用于特殊场景。

### Q5: 前端怎么做权限控制？只靠后端够吗？

**参考答案**：

不够。前端和后端需要**各做各的权限控制**，但目的不同：

**后端权限（安全边界）**：
- 这是真正的安全防线，所有不合法的请求必须被拒绝
- 通过中间件和 service 层实现
- 前端可以被绕过（直接调 API），所以后端检查不可省略

**前端权限（用户体验）**：
- 目的是隐藏用户无权操作的按钮/菜单，避免"点了之后才告诉没权限"
- 不是安全措施，是 UX 优化

```typescript
// 前端权限控制示例（React）
interface Permission {
  workspace: string;
  permissions: string[];
}

// 用户登录后获取权限列表
const usePermissions = (workspaceId: string) => {
  const { data } = useQuery(['permissions', workspaceId], () =>
    api.get(`/api/v1/workspaces/${workspaceId}/permissions`)
  );
  return data?.permissions ?? [];
};

// 权限组件：根据权限显示/隐藏子元素
const Can: React.FC<{ perm: string; children: React.ReactNode }> = ({ perm, children }) => {
  const permissions = usePermissions(currentWorkspaceId);
  if (!permissions.includes(perm)) return null;
  return <>{children}</>;
};

// 使用
<Can perm="workspace:invite">
  <Button onClick={openInviteDialog}>邀请成员</Button>
</Can>

<Can perm="document:delete">
  <Button danger onClick={deleteDoc}>删除文档</Button>
</Can>
```

```go
// 后端对应的 API：返回当前用户的权限列表
func (h *WorkspaceHandler) GetPermissions(c *gin.Context) {
    userID := c.GetString(ContextKeyUserID)
    workspaceID := c.Param("workspace_id")

    perms, err := h.rbacSvc.GetUserPermissions(c.Request.Context(), userID, workspaceID)
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
        return
    }

    // 转为字符串数组
    permStrs := make([]string, len(perms))
    for i, p := range perms {
        permStrs[i] = string(p)
    }

    c.JSON(http.StatusOK, gin.H{
        "permissions": permStrs,
        "role":        /* 用户角色 */,
    })
}
```

# JWT 认证

## 基础概念

### 是什么

JWT（JSON Web Token，RFC 7519）是一种开放标准，用于在各方之间以 JSON 对象安全地传输信息。JWT 是经过签名的（可验证真实性），信息是 Base64Url 编码的（可被任何人读取），常用于身份认证和信息交换。

JWT 由三部分组成，用 `.` 分隔：

```
Header.Payload.Signature

eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

- **Header**：`{"alg": "HS256", "typ": "JWT"}` —— 签名算法和类型
- **Payload**：`{"sub": "user-123", "email": "test@example.com", "exp": 1700000000}` —— 声明（claims）
- **Signature**：`HMACSHA256(base64(header) + "." + base64(payload), secret)` —— 签名，防止篡改

### 为什么用 JWT

相比传统的 Session + Cookie 方案：

| 维度 | Session + Cookie | JWT |
|------|-----------------|-----|
| 服务器存储 | 需要存储 session（内存/Redis） | 无状态，不需要存储 |
| 水平扩展 | 需要共享 session（粘性会话或集中存储） | 天然支持，任何节点都能验证 |
| 跨域 | Cookie 有 CSRF 风险，CORS 配置复杂 | Token 放 Header，无 CSRF 问题 |
| 多端支持 | Cookie 机制浏览器绑定 | 移动端/桌面端/CLI 都好用 |
| 微服务友好 | 需要统一 session 存储 | 每个服务独立验证签名即可 |

### 解决什么问题

- 无状态认证：服务器不需要记住"谁登录了"，只需要验证 Token 签名和过期时间
- 跨服务身份传递：在微服务/模块化单体中，API 网关验证 Token 后，下游服务可以直接信任用户身份

---

## 核心用法

### Access Token + Refresh Token 双 Token 机制

这是 JWT 认证的工业标准实践：

| Token | 用途 | 有效期 | 存储 |
|-------|------|--------|------|
| Access Token | 访问受保护资源 | 短（15-30 分钟） | 内存（前端 JS 变量） |
| Refresh Token | 刷新 Access Token | 长（7-30 天） | HttpOnly Cookie |

为什么需要双 Token：
- Access Token 短期，即使泄露影响有限
- Refresh Token 长期，但只在刷新时使用，且可以通过服务端吊销

### Go 后端实现

#### 1. Token 生成

```go
// internal/auth/jwt.go
package auth

import (
    "errors"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
)

type TokenType string

const (
    AccessToken  TokenType = "access"
    RefreshToken TokenType = "refresh"
)

type Claims struct {
    jwt.RegisteredClaims
    UserID string    `json:"uid"`
    Email  string    `json:"email"`
    Role   string    `json:"role"`
    Type   TokenType `json:"type"`
}

type JWTManager struct {
    accessSecret  []byte
    refreshSecret []byte
    accessTTL     time.Duration
    refreshTTL    time.Duration
}

func NewJWTManager(accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *JWTManager {
    return &JWTManager{
        accessSecret:  []byte(accessSecret),
        refreshSecret: []byte(refreshSecret),
        accessTTL:     accessTTL,
        refreshTTL:    refreshTTL,
    }
}

type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int64  `json:"expires_in"` // Access Token 过期时间（秒）
}

func (m *JWTManager) GenerateTokenPair(userID, email, role string) (*TokenPair, error) {
    now := time.Now()

    // Access Token
    accessClaims := Claims{
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,
            IssuedAt:  jwt.NewNumericDate(now),
            ExpiresAt: jwt.NewNumericDate(now.Add(m.accessTTL)),
            ID:        uuid.New().String(), // jti，用于 Token 吊销
        },
        UserID: userID,
        Email:  email,
        Role:   role,
        Type:   AccessToken,
    }
    accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
    accessStr, err := accessToken.SignedString(m.accessSecret)
    if err != nil {
        return nil, err
    }

    // Refresh Token
    refreshClaims := Claims{
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,
            IssuedAt:  jwt.NewNumericDate(now),
            ExpiresAt: jwt.NewNumericDate(now.Add(m.refreshTTL)),
            ID:        uuid.New().String(),
        },
        UserID: userID,
        Type:   RefreshToken,
    }
    refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
    refreshStr, err := refreshToken.SignedString(m.refreshSecret)
    if err != nil {
        return nil, err
    }

    return &TokenPair{
        AccessToken:  accessStr,
        RefreshToken: refreshStr,
        ExpiresIn:    int64(m.accessTTL.Seconds()),
    }, nil
}
```

#### 2. Token 验证

```go
func (m *JWTManager) ValidateAccessToken(tokenStr string) (*Claims, error) {
    return m.validateToken(tokenStr, m.accessSecret, AccessToken)
}

func (m *JWTManager) ValidateRefreshToken(tokenStr string) (*Claims, error) {
    return m.validateToken(tokenStr, m.refreshSecret, RefreshToken)
}

func (m *JWTManager) validateToken(tokenStr string, secret []byte, expectedType TokenType) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        // 验证签名算法
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return secret, nil
    })
    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, errors.New("invalid token")
    }

    // 验证 Token 类型
    if claims.Type != expectedType {
        return nil, errors.New("invalid token type")
    }

    return claims, nil
}
```

#### 3. Refresh Token 的吊销机制

```go
// internal/auth/token_store.go
// 使用 Redis 存储 refresh token 的状态，支持吊销

package auth

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type TokenStore struct {
    redis *redis.Client
}

func NewTokenStore(rdb *redis.Client) *TokenStore {
    return &TokenStore{redis: rdb}
}

// StoreRefreshToken 存储 refresh token 的 jti（JWT ID）
func (s *TokenStore) StoreRefreshToken(ctx context.Context, userID, jti string, ttl time.Duration) error {
    key := fmt.Sprintf("refresh_token:%s:%s", userID, jti)
    return s.redis.Set(ctx, key, "valid", ttl).Err()
}

// IsRefreshTokenRevoked 检查 token 是否已被吊销
func (s *TokenStore) IsRefreshTokenRevoked(ctx context.Context, userID, jti string) (bool, error) {
    key := fmt.Sprintf("refresh_token:%s:%s", userID, jti)
    val, err := s.redis.Get(ctx, key).Result()
    if err == redis.Nil {
        return true, nil // key 不存在 = 已过期或被吊销
    }
    if err != nil {
        return false, err
    }
    return val != "valid", nil
}

// RevokeRefreshToken 吊销单个 refresh token
func (s *TokenStore) RevokeRefreshToken(ctx context.Context, userID, jti string) error {
    key := fmt.Sprintf("refresh_token:%s:%s", userID, jti)
    return s.redis.Del(ctx, key).Err()
}

// RevokeAllUserTokens 吊销用户的所有 refresh token（强制全部设备下线）
func (s *TokenStore) RevokeAllUserTokens(ctx context.Context, userID string) error {
    pattern := fmt.Sprintf("refresh_token:%s:*", userID)
    iter := s.redis.Scan(ctx, 0, pattern, 0).Iterator()
    for iter.Next(ctx) {
        if err := s.redis.Del(ctx, iter.Val()).Err(); err != nil {
            return err
        }
    }
    return iter.Err()
}
```

#### 4. HTTP Middleware

```go
// internal/middleware/auth.go
package middleware

import (
    "net/http"
    "strings"

    "github.com/yourname/devos/internal/auth"
    "github.com/gin-gonic/gin"
)

const (
    ContextKeyUserID = "user_id"
    ContextKeyEmail  = "email"
    ContextKeyRole   = "role"
)

func AuthMiddleware(jwtManager *auth.JWTManager) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 从 Authorization header 提取 token
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "error": "missing authorization header",
            })
            return
        }

        // Bearer token 格式
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "error": "invalid authorization format",
            })
            return
        }

        tokenStr := parts[1]

        // 验证 token
        claims, err := jwtManager.ValidateAccessToken(tokenStr)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "error": "invalid or expired token",
            })
            return
        }

        // 将用户信息写入 context
        c.Set(ContextKeyUserID, claims.UserID)
        c.Set(ContextKeyEmail, claims.Email)
        c.Set(ContextKeyRole, claims.Role)

        c.Next()
    }
}
```

#### 5. Login / Refresh API

```go
// internal/handler/auth_handler.go
package handler

import (
    "errors"
    "net/http"
    "time"

    "github.com/yourname/devos/internal/auth"
    "github.com/yourname/devos/internal/middleware"
    "github.com/gin-gonic/gin"
)

type AuthHandler struct {
    jwtManager *auth.JWTManager
    tokenStore *auth.TokenStore
    userSvc    UserService
}

func NewAuthHandler(jwt *auth.JWTManager, store *auth.TokenStore, userSvc UserService) *AuthHandler {
    return &AuthHandler{
        jwtManager: jwt,
        tokenStore: store,
        userSvc:    userSvc,
    }
}

type LoginRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // 验证用户凭证
    user, err := h.userSvc.Authenticate(c.Request.Context(), req.Email, req.Password)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }

    // 生成 Token 对
    pair, err := h.jwtManager.GenerateTokenPair(user.ID, user.Email, user.Role)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
        return
    }

    // 存储 Refresh Token 的 jti
    refreshClaims, _ := h.jwtManager.ValidateRefreshToken(pair.RefreshToken)
    h.tokenStore.StoreRefreshToken(
        c.Request.Context(),
        user.ID,
        refreshClaims.ID,
        30*24*time.Hour, // Refresh Token TTL
    )

    // Access Token 通过 JSON 返回
    // Refresh Token 通过 HttpOnly Cookie 返回
    c.SetCookie(
        "refresh_token",
        pair.RefreshToken,
        30*24*3600,         // maxAge（秒）
        "/",                 // path
        "",                  // domain
        true,                // secure（生产环境必须 true）
        true,                // httpOnly（防 XSS）
    )
    c.SetSameSite(http.SameSiteStrictMode) // 防 CSRF

    c.JSON(http.StatusOK, gin.H{
        "access_token": pair.AccessToken,
        "expires_in":   pair.ExpiresIn,
        "user": gin.H{
            "id":    user.ID,
            "email": user.Email,
            "name":  user.Name,
            "role":  user.Role,
        },
    })
}

func (h *AuthHandler) Refresh(c *gin.Context) {
    // 从 Cookie 获取 Refresh Token
    refreshStr, err := c.Cookie("refresh_token")
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "no refresh token"})
        return
    }

    // 验证 Refresh Token
    claims, err := h.jwtManager.ValidateRefreshToken(refreshStr)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
        return
    }

    // 检查是否被吊销
    revoked, err := h.tokenStore.IsRefreshTokenRevoked(c.Request.Context(), claims.UserID, claims.ID)
    if err != nil || revoked {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "token revoked"})
        return
    }

    // 吊销旧的 Refresh Token（单次使用）
    h.tokenStore.RevokeRefreshToken(c.Request.Context(), claims.UserID, claims.ID)

    // 获取最新用户信息
    user, err := h.userSvc.GetByID(c.Request.Context(), claims.UserID)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
        return
    }

    // 生成新的 Token 对
    pair, err := h.jwtManager.GenerateTokenPair(user.ID, user.Email, user.Role)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
        return
    }

    // 存储新 Refresh Token
    newRefreshClaims, _ := h.jwtManager.ValidateRefreshToken(pair.RefreshToken)
    h.tokenStore.StoreRefreshToken(
        c.Request.Context(),
        user.ID,
        newRefreshClaims.ID,
        30*24*time.Hour,
    )

    c.SetCookie("refresh_token", pair.RefreshToken, 30*24*3600, "/", "", true, true)
    c.SetSameSite(http.SameSiteStrictMode)

    c.JSON(http.StatusOK, gin.H{
        "access_token": pair.AccessToken,
        "expires_in":   pair.ExpiresIn,
    })
}

func (h *AuthHandler) Logout(c *gin.Context) {
    refreshStr, err := c.Cookie("refresh_token")
    if err == nil {
        // 吊销 Refresh Token
        claims, err := h.jwtManager.ValidateRefreshToken(refreshStr)
        if err == nil {
            h.tokenStore.RevokeRefreshToken(c.Request.Context(), claims.UserID, claims.ID)
        }
    }

    // 清除 Cookie
    c.SetCookie("refresh_token", "", -1, "/", "", true, true)
    c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}
```

---

## 核心思想 / 设计原理

### 1. JWT 的签名验证原理

```
签名过程：
Signature = HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    secret
)

验证过程：
1. 按 "." 拆分 Token，得到 header、payload、signature 三部分
2. 用相同的 secret 对 header + payload 重新计算 HMACSHA256
3. 比较计算结果与 Token 中的 signature 是否一致
4. 不一致 → 被篡改，拒绝
```

HS256（对称加密）vs RS256（非对称加密）：

| 算法 | 签名密钥 | 验证密钥 | 适用场景 |
|------|---------|---------|---------|
| HS256 | 同一个 secret | 同一个 secret | 单体/模块化单体，服务端自行签发和验证 |
| RS256 | 私钥 | 公钥 | 微服务，网关用私钥签发，下游服务用公钥验证 |
| ES256 | 私钥 | 公钥 | 同 RS256，但更短更快 |

### 2. 为什么 Access Token 不能放在 Cookie 里

| 存储位置 | XSS 风险 | CSRF 风险 | 适用场景 |
|---------|---------|---------|---------|
| localStorage | 高（JS 可读） | 无 | SPA 前端（配合短过期时间） |
| Cookie（非 HttpOnly） | 高（JS 可读） | 高 | 不推荐 |
| Cookie（HttpOnly） | 低 | 中（需 SameSite） | 适合 Refresh Token |
| JS 内存变量 | 低（页面刷新丢失） | 无 | Access Token 最佳选择 |

Access Token 放内存中的好处：
- XSS 攻击无法读取内存中的变量（除非注入代码在同一个页面上下文）
- 页面刷新时丢失，触发 Refresh 流程，安全性更高
- 不受 CSRF 影响

Refresh Token 放 HttpOnly Cookie 的好处：
- JS 无法读取，XSS 无法窃取
- 配合 SameSite=Strict 防 CSRF
- 只有 `/auth/refresh` 端点会读取这个 Cookie

### 3. Token 吊销的困境与解决方案

JWT 最大的设计矛盾：**无状态 vs 吊销**。JWT 的核心优势是无状态（不需要查数据库），但吊销 Token 必然需要状态存储。

解决方案对比：

| 方案 | 复杂度 | 延迟 | 适用场景 |
|------|--------|------|---------|
| 短过期 + Refresh | 低 | 低 | 大多数场景 |
| Token 黑名单（Redis） | 中 | 低 | 需要即时吊销 |
| Token 版本号（用户维度） | 低 | 低 | 只需要全量吊销 |

Token 版本号方案（简单实用）：

```go
// 在用户表中加一个 token_version 字段
// JWT claims 中带上 version
// 验证时比较 version 是否匹配

type Claims struct {
    // ...
    TokenVersion int `json:"tv"`
}

// 验证时
if claims.TokenVersion != user.TokenVersion {
    return errors.New("token version mismatch")
}

// 需要强制下线时，递增用户的 token_version
// 所有旧 Token 的 version 都不匹配了
```

### 4. JWT vs OAuth 2.0 的关系

很多人混淆这两个概念：

- **JWT** 是一种 Token **格式**（数据结构）
- **OAuth 2.0** 是一种**授权协议**（流程规范）
- OAuth 2.0 可以用 JWT 作为 Token 格式，也可以用不透明 Token（opaque token）
- 自家系统的登录认证用 JWT 就够了；接入第三方登录（Google、GitHub）才需要 OAuth 2.0

---

## 常见面试题

### Q1: JWT 的安全问题有哪些？你怎么防范？

**参考答案**：

主要安全风险和对应防范：

1. **Token 泄露**：Access Token 短过期（15 分钟），Refresh Token 放 HttpOnly + Secure + SameSite Cookie
2. **算法篡改攻击**：将 `alg` 改为 `none` 绕过签名验证。防范：服务端**强制指定**算法，不信任 Token 中的 `alg` 字段
   ```go
   // 正确：指定算法验证
   token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
       if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
           return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
       }
       return secret, nil
   })
   ```
3. **密钥强度不足**：HS256 的 secret 至少 256 位（32 字节），使用 `crypto/rand` 生成
4. **敏感信息泄露**：JWT Payload 是 Base64 编码（不是加密），任何人都能解码。绝不在 Payload 中放密码、手机号等敏感信息
5. **JWK 劫持**：如果使用 RS256 且从远程获取公钥（JWK Set），需要缓存并验证 HTTPS 证书

### Q2: 为什么 Refresh Token 只能使用一次？如果用户在两个设备上登录会怎样？

**参考答案**：

Refresh Token 单次使用（One-Time Use）的原因：
- 如果 Refresh Token 被窃取，攻击者可以用它无限续期。单次使用意味着：合法用户下次 Refresh 时会发现 Token 失效，从而意识到异常

双设备登录的处理策略：
1. **允许多设备**：每次登录生成不同的 Refresh Token（不同的 jti），各自独立存储在 Redis 中
2. **检测 Token 重放攻击**：
   ```go
   // 如果一个已使用的 Refresh Token 被再次使用 → 说明被窃取
   func (h *AuthHandler) Refresh(c *gin.Context) {
       revoked, _ := h.tokenStore.IsRefreshTokenRevoked(ctx, userID, jti)
       if revoked {
           // 这个 Token 之前已经用过一次了！
           // 安全措施：吊销该用户所有 Refresh Token（强制全部设备下线）
           h.tokenStore.RevokeAllUserTokens(ctx, userID)
           // 记录安全日志
           logSecurityEvent("token_reuse_detected", userID)
       }
   }
   ```

3. **设备指纹**：在 Refresh Token 中记录设备信息（User-Agent hash），Refresh 时验证是否匹配

### Q3: 无状态 JWT 和有状态 Session 各有什么优劣？什么时候该选哪个？

**参考答案**：

| 维度 | Session | JWT |
|------|---------|-----|
| 服务器存储 | 有状态（内存/Redis） | 无状态 |
| 水平扩展 | 需要共享存储 | 天然支持 |
| 即时吊销 | 天然支持（删除 session） | 需要额外机制 |
| Token 大小 | Session ID（几十字节） | JWT（几百字节到几 KB） |
| 安全性 | 依赖 Cookie 安全属性 | 依赖签名和存储方式 |
| 适用场景 | 传统 Web 应用、需要即时吊销 | API 服务、移动端、微服务 |

选择建议：
- **BFF（Backend For Frontend）**：Web 应用可以用 Session，因为浏览器天然支持 Cookie
- **纯 API 服务**：JWT 更合适，移动端/CLI/第三方集成友好
- **需要即时吊销**：Session 天然支持，JWT 需要引入黑名单（本质上又变成了有状态）
- **实际项目**：很多团队用混合方案——Access Token 用 JWT 无状态验证，Refresh Token 用有状态存储（Redis），兼顾性能和安全

### Q4: JWT 的 Payload 能加密吗？JWT 和 JWE 是什么关系？

**参考答案**：

默认的 JWT（JWS）只做签名，不做加密。Payload 是 Base64Url 编码，等于明文。但 JWT 标准族中有加密方案：

- **JWS（JSON Web Signature）**：签名 + 编码，保证不被篡改，但任何人都能读
- **JWE（JSON Web Encryption）**：加密 + 签名，Payload 无法被第三方读取

```
JWS = Header.Payload.Signature
JWE = Header.EncKey.IV.Ciphertext.Tag（5 段）
```

实际建议：
- 大多数场景不需要 JWE，只要不在 JWT 中放敏感数据即可
- 如果必须传敏感信息，使用单独的加密层，或改用不透明 Token + 服务端存储
- JWE 增加了复杂度和 Token 体积，性能开销显著

### Q5: 你们项目中 JWT 认证的完整流程是怎样的？从前端发起登录到后续 API 请求。

**参考答案**：

完整认证流程：

```
1. 前端发送 POST /auth/login { email, password }
2. 后端验证凭证，生成 Token Pair
   - Access Token → 通过 JSON body 返回
   - Refresh Token → 通过 Set-Cookie: HttpOnly; Secure; SameSite=Strict 返回
3. 前端将 Access Token 存在内存变量中（不存 localStorage）
4. 后续 API 请求携带 Authorization: Bearer <access_token>
5. Access Token 过期（15 分钟后）
   - 前端收到 401 响应
   - 自动发送 POST /auth/refresh（浏览器自动带上 Refresh Token Cookie）
   - 后端验证 Refresh Token，签发新的 Token Pair
   - 前端更新内存中的 Access Token，重试失败的请求
6. 用户登出
   - 前端发送 POST /auth/logout
   - 后端吊销 Refresh Token，清除 Cookie
   - 前端清除内存中的 Access Token

关键设计点：
- 前端需要实现请求拦截器：收到 401 时自动 Refresh 并重试
- Refresh 接口需要防止并发：多个请求同时 401 时只发一次 Refresh
- Refresh Token 轮换（Rotation）：每次 Refresh 都发新的 Refresh Token，旧的立即作废
```

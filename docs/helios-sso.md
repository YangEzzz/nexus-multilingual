# Helios 统一登录

Nexus 使用 Helios 账号和 `nexus-multilingual` 项目角色。点击登录打开授权窗口，Helios 已登录时可直接继续；窗口被拦截时自动整页跳转，也可主动选择当前页面登录。Nexus 后端兑换授权码后建立自己的会话，前端通过后端状态确认结果。

## 当前本地联调

| 服务        | 地址                  | 数据库                       |
| ----------- | --------------------- | ---------------------------- |
| Nexus 前端  | http://localhost:5173 | —                            |
| Nexus 后端  | http://127.0.0.1:3457 | 远程 `nexus_db`              |
| Helios 前端 | http://localhost:5174 | —                            |
| Helios 后端 | http://127.0.0.1:3456 | 同一远程服务器的 `system_db` |

Helios 服务的 `.env` 与 Nexus 后端 `.env` 使用相同数据库服务器、端口和数据库账号，数据库名分别为 `system_db` 和 `nexus_db`。这些文件已被 Git 忽略；不需要安装或下载本地 PostgreSQL。Helios `.env` 优先于 `.env-production`；Nexus 保留 `.env-production` 优先的既有加载规则。环境变量优先于文件。

四个仓库分别启动：两个后端执行 `go run ./cmd/api`（Helios）、`go run .`（Nexus）；两个前端执行 `pnpm dev --host localhost`。前端本地配置分别使用 `VITE_APP_API_BASE_URL=`（Helios）和 `VITE_APP_API_BASE_URL=/api/v1`（Nexus），Vite 将 `/api` 转发到对应后端。保持使用 `localhost`，不要交替使用 `127.0.0.1` 访问前端。

## 数据库与接入配置

后端各自提供 `go run ./cmd/sso-migrate`，仅执行新增的 SSO 表迁移，不创建数据库、不改动原业务表。已在上述两个远程数据库执行。联调时保持 `DB_AUTO_MIGRATE=false`（Helios）和 `AUTO_MIGRATE=false`（Nexus），避免全库自动迁移。

Helios 项目详情的“统一登录接入”管理客户端、精确回调地址和启用状态。新建和轮换密钥仅显示一次，保存到 Nexus 后端环境变量，浏览器不保存密钥。当前本地客户端为 `nexus-multilingual-local`，绑定已有项目 `nexus-multilingual`，回调地址为 `http://localhost:5173/api/v1/auth/sso/callback`。注册接入不会添加或修改任何真实用户的项目角色。

也可在 Helios 服务中执行 `go run ./cmd/sso-register-client`，通过环境变量传入 `SSO_CLIENT_ID`、`SSO_CLIENT_SECRET`（至少 32 字符）、`SSO_REDIRECT_URI` 和 `SSO_PROJECT_ID`。项目必须已存在；已有客户端配置不匹配时拒绝覆盖。

## 协议与会话

- Helios 浏览器接口：`GET /api/sso/session`、`GET /api/sso/authorize`、`GET /api/sso/request`，以及 `POST /api/sso/login|continue|cancel|logout`。
- Helios 后端接口：`POST /api/sso/exchange` 和 `/api/sso/identity`，使用 HTTP Basic 客户端凭证。
- Nexus：`GET /api/v1/auth/csrf`，`POST /api/v1/auth/sso/start|cancel`，`GET /api/v1/auth/sso/callback|status`，`POST /api/v1/auth/logout`，以及受保护的用户资料接口。
- 授权请求和登录事务有效期 10 分钟；授权码 60 秒，只能兑换一次，绑定客户端、回调地址及 PKCE S256。数据库行锁保证并发兑换只有一次成功。
- 两端独立 HttpOnly、SameSite=Lax 会话 Cookie，有效期 8 小时；数据库只保存会话和授权码摘要。登录旋转旧会话。密码、客户端密钥和长期凭证不进入跳转 URL 或 localStorage。
- 写操作校验准确 Origin 和 CSRF Cookie/header。弹窗通知校验 Origin、窗口来源、事务标识；即使通知通过，也以 Nexus 后端状态和用户资料为准。
- Nexus 每次写操作重新向 Helios 校验身份和角色；读操作至少每 5 分钟刷新。账号停用、角色撤销时会话失效；认证服务不可用时权限校验返回 503，拒绝继续执行。
- 退出 Nexus 只结束 Nexus 会话，Helios 会话仍可复用。退出 Helios 结束其当前会话；这版不包含跨系统即时全局注销。
- Nexus 旧密码登录接口返回 410，旧 Bearer Token 不再有效。Helios 原有服务端 JWT 接口保留兼容，新浏览器登录使用 Cookie。

## 部署

生产环境沿用现有域名规则：页面域名提供静态页面，所有浏览器 API 请求、授权入口和后端回调都使用各自的 API 子域名。页面域名不增加 `/api` 代理。

| 用途                   | 地址                             |
| ---------------------- | -------------------------------- |
| Helios 页面            | https://helios.team-tool.top     |
| Helios API 与授权入口  | https://helios-api.team-tool.top |
| Nexus 页面与登录完成页 | https://nexus.team-tool.top      |
| Nexus API 与后端回调   | https://nexus-api.team-tool.top  |

前端构建时使用下面的地址。Helios 配置不带 `/api` 后缀；Nexus 配置带 `/api/v1`。Axios 和登录请求共用同一配置。

```bash
# /root/frontendProject/helios-auth-admin
VITE_APP_API_BASE_URL=https://helios-api.team-tool.top pnpm exec vite build

# /root/frontendProject/nexus-multilingual
VITE_APP_API_BASE_URL=https://nexus-api.team-tool.top/api/v1 pnpm build
```

Helios 后端保留现有数据库和 JWT 配置，设置：

```dotenv
FRONTEND_URL=https://helios.team-tool.top
COOKIE_SECURE=true
DB_AUTO_MIGRATE=false
```

Nexus 后端保留现有数据库等配置，设置：

```dotenv
FRONTEND_URL=https://nexus.team-tool.top
ALLOWED_ORIGINS=https://nexus.team-tool.top
COOKIE_SECURE=true
AUTO_MIGRATE=false
HELIOS_BASE_URL=https://helios-api.team-tool.top
HELIOS_INTERNAL_URL=http://127.0.0.1:3456
HELIOS_CLIENT_ID=nexus-multilingual-production
HELIOS_CLIENT_SECRET=replace-with-the-once-displayed-secret
HELIOS_REDIRECT_URI=https://nexus-api.team-tool.top/api/v1/auth/sso/callback
HELIOS_PROJECT_ID=nexus-multilingual
HELIOS_ALLOWED_ROLES=admin,owner,productor,developer,translator
```

`HELIOS_BASE_URL` 是浏览器可访问的 Helios **API** 地址；`HELIOS_INTERNAL_URL` 是 Nexus 后端访问 Helios 的地址，同机使用 loopback，跨机器时使用 HTTPS。Helios 客户端登记的回调地址必须与上面的 `HELIOS_REDIRECT_URI` 完全一致。授权 API 重定向到 Helios 页面域名显示表单；回调在 Nexus API 域名兑换授权码、建立 Cookie，再重定向到 Nexus 页面域名通知原窗口。两个 API 与页面都使用 HTTPS，并位于同一个 `team-tool.top` 站点下；Cookie 保持 host-only、HttpOnly 和 SameSite=Lax，不共享给其他子域名。

### 现有 Nginx 的跨域响应

标准 JSON 写请求携带 `X-CSRF-Token`，浏览器通过 OPTIONS 预检后携带 Cookie。前端保持 `credentials: include` / `withCredentials: true`，后端校验精确 Origin 和 CSRF Cookie/header。没有 text/plain 或请求体 CSRF 变体。

只调整已有的两个 API 虚拟主机，证书、域名、监听端口和前端静态目录保持原样。在 `helios-api.team-tool.top` 的 server 中，用下面的内容替换原来的整个 `location /api/`：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3456;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

在 `nexus-api.team-tool.top` 的 server 中，用下面的内容替换原来的整个 `location /`：

```nginx
location / {
    proxy_pass http://127.0.0.1:3457;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

替换会移除这两个 location 原来手写的 OPTIONS 返回、`proxy_hide_header Access-Control-*` 和 `add_header Access-Control-*`。Nginx 将预检和业务请求转发给后端，由后端统一返回精确的允许来源、`Access-Control-Allow-Credentials: true` 和包含 `X-CSRF-Token` 的允许请求头；避免 Nginx 与后端重复或互相覆盖。不要给携带 Cookie 的接口设置 `Access-Control-Allow-Origin: *`。

配置检查成功后重载：

```bash
nginx -t && systemctl reload nginx
```

反向代理和访问日志应去掉授权回调的查询字符串。Nexus 可使用 `Cross-Origin-Opener-Policy: same-origin-allow-popups`；不要用 `same-origin` 隔离登录弹窗。Helios 登录页不设置会切断 opener 的 COOP。后端状态轮询仍是最终依据。Helios 默认仅信任 loopback 代理来源；远端网关部署应通过 `TRUSTED_PROXIES` 配置实际网关 IP/CIDR（逗号分隔），并在网关增加多实例登录限流。

定期清理已过期 SSO 会话、请求、授权码和登录事务；清理策略由部署维护任务执行，本实现不会自动删除既有业务数据。

## 验证

两个后端执行 `go test ./...`。Helios 数据库集成测试须显式传入 `HELIOS_SSO_TEST_DSN`；使用既有远程数据库还须设置 `SSO_TEST_ALLOW_EXISTING_DATABASE=true`。测试创建 UUID 隔离的临时用户、项目、客户端及授权码，结束时只清理这次测试的数据，不创建数据库、不变更真实账号权限。

前端执行 `pnpm build`。2026-10-10 联调中 Nexus 构建通过，Helios 的 `pnpm exec vite build` 通过；Helios 完整 `pnpm build` 被原有模板中的类型错误阻止（侧栏可空团队、Zod 参数、缺失演示图表依赖等），新增 SSO 文件未产生类型错误。浏览器已验证登录成功、刷新保持会话、独立退出、取消授权和复用 Helios 会话。

额外运行 Nexus `pnpm exec vue-tsc -b --pretty false`，发现现有 Workbench 文件 3 处类型错误（未使用函数、2 处可空语言值），新增 SSO 文件没有类型错误。两端 SSO 相关文件 ESLint 检查均为 0 错误，保留项目已有的函数风格警告。

全项目 premium strict 静态审计保存在各自 `.local`：Nexus 8 项、Helios 10 项既有模板问题，涉及演示任务表单、原生下拉所有权、主题弹出触发按钮等；新增 SSO 页面没有审计发现。这些结果不表示全项目审计通过。

浏览器验证截图仅保存在本地，未包含在代码发布中。

2026-10-10 API 子域名调整验证：两端后端 `go test ./...` 通过；新增 CORS 测试覆盖独立 API 来源的 GET、POST、OPTIONS、允许 Cookie/CSRF 请求头及拒绝其他来源。两个前端使用正式 API 子域名构建通过，修改文件 ESLint 为 0 错误。本地浏览器将两个前端分别直连不同端口的后端 API，已验证已有会话刷新、跨域退出、发起授权、复用 Helios 会话和返回 Nexus 仪表盘。生产服务器的 Nginx 与正式客户端配置仍需按本文部署后验证。

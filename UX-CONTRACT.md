# Nexus 交互约定

## 统一登录

- `src/utils/session.ts`、`use-session-auth.ts` 和 `use-helios-login.ts` 是认证请求、会话恢复和弹窗生命周期的统一入口。
- 登录仅通过 Helios 授权码流程；密码不进入 Nexus。刷新页面通过 `/auth/me` 恢复会话，用户资料不持久化到 localStorage。
- 弹窗在点击时同步打开；拦截或用户选择时使用整页跳转。完成事件校验来源、窗口和事务标识后仍向后端确认。
- 登录返回路径仅允许应用内部路径；取消、失败、超时显示可重试的行内反馈。
- 退出必须先成功撤销后端会话；撤销失败保留当前状态并提示重试。退出 Nexus 不退出 Helios。

## 权限

- 功能权限由 `src/lib/permissions.ts` 统一定义；UI 使用 `v-permission` 和 `usePermission`。
- 操作入口无权限时隐藏；内容字段保留展示并通过原生 disabled 属性禁用编辑。
- 未识别的角色和权限拒绝访问；角色或绑定变化立即重新计算权限。
- 操作函数在提交前再次检查，弹窗已打开时也不能绕过前端检查。
- AI 设置及项目日志的侧栏、命令菜单和路由限制一致；直接访问无权限路由进入 403 页面。
- 基础导航不要求匹配四个角色枚举，角色未加载或无法识别时也保持显示；具体操作权限仍默认拒绝。
- 后端接口授权是数据安全边界，前端指令只是交互控制。项目和语言范围尚未建模。

## Canonical UI Map

| Capability      | Canonical owner                                          | Source of truth       | Allowed variants                          | Verification            |
| --------------- | -------------------------------------------------------- | --------------------- | ----------------------------------------- | ----------------------- |
| Permissions     | `src/lib/permissions.ts`, `src/directives/permission.ts` | `docs/permissions.md` | hidden entry / disabled field / 403 route | `tests/permission.html` |
| Form            | `src/components/ui/form`, Input / Textarea               | `DESIGN.md`           | create / edit / read-only                 | 页面校验及构建          |
| Toast           | `vue-sonner`, `src/components/ui/sonner`                 | `DESIGN.md`           | success / error / info                    | 操作反馈                |
| Select/Listbox  | `src/components/ui/select`                               | `DESIGN.md`           | authored                                  | 保持既有组件            |
| Scrollbar       | `src/assets/scrollbar.css`                               | `DESIGN.md`           | geometry exceptions                       | 保持既有样式            |
| CRUD            | 项目/语言/工作台页面和 `src/request/index.ts`            | 既有业务 API          | single / bulk                             | 权限浏览器回归及构建    |
| Table Selection | 工作台既有选择缓存和 `src/components/data-table`         | 既有分页 API          | page / all-filtered                       | 本次保留既有行为        |

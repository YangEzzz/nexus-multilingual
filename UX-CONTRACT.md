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

## 编辑与异步恢复

- `use-request-scope.ts` 管理项目上下文、请求失效与卸载取消；旧响应不得改变当前项目状态。
- `use-term-translation.ts` 统一行内和抽屉提示词、结果归属与状态策略。AI 结果仍须人工校对，未发布词条保持 pending；人工改动不得被旧响应覆盖。
- `term-draft.ts` 同时恢复表格与跨页选择缓存，同一 ID 的实体引用保持一致。
- `TermEditorSheet.vue` 和 `TermExportDialog.vue` 是编辑与导出的领域组件，基础控件继续使用 shadcn-vue。
- 关闭抽屉、切项目和离开工作台前处理未保存修改；提交期间等待操作完成。确认框高于抽屉，取消确认后保留输入和焦点。
- 编辑及未保存翻译期间冻结筛选与分页；后台刷新保留未提交翻译。
- `use-term-import.ts` 管理文件输入和导入。对象仅接受严格 JSON，不执行代码；Excel 解析库按需加载。
- `project-save.ts` 在创建成功后保留项目 ID；语言保存失败后重试同一项目。
- 生产环境不开放示例 Tasks 路由。

## 工程验证

- `pnpm check` 执行零警告 lint、类型检查和隔离回归；`pnpm build` 在构建前执行类型检查。
- `/tests/permission.html` 验证已有权限回归；`/tests/workbench-regression.html` 使用内存 API 检查编辑、错误恢复和键盘操作。

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

## 工作空间外观与导航

- layouts/index.vue owns localized document titles, the skip link and a mobile-only drawer trigger. There is no global top menu/header. AppSidebar owns Nexus branding, permission-filtered navigation, and the only appearance/collapse control location in its footer.
- SidebarProvider / SidebarRail own collapse, mobile drawer and pointer/keyboard width control (220–360px, default 264px). Desktop width persists under nexus-sidebar-width; mobile navigation closes after choosing a route. Shortcuts never intercept text input or IME composition.
- style.css owns workspace-page, metric-strip, semantic panel geometry, table density, focus and reduced-motion behavior. Editing overlays continue to use the canonical Dialog / Sheet / AlertDialog primitives and existing unsaved-change guards.
- Project directory rows, dashboard panels, language tables, settings and workbench share neutral surfaces. Status labels and icons retain meaning without requiring color.
- tests/ui-preview.html mounts real route components against in-memory API data for desktop, narrow, theme, loading/error/empty and overlay verification. It does not call live APIs.

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
- “复制键值对”只处理打开弹窗时的选中范围（包括跨页选择和全筛选排除项），选择语言后预览并复制 JSON 成员片段；保留原始 Key，去掉模块包装和外层大括号。空译文跳过并显示数量，重复 Key 拒绝生成并提示按模块筛选。未保存的编辑须先保存或取消。`terms/export/copy` 的 `format: pairs` 是片段内容来源，`src/lib/clipboard.ts` 统一写入剪贴板；复制失败保留预览供手动复制。
- 关闭抽屉、切项目和离开工作台前处理未保存修改；提交期间等待操作完成。确认框高于抽屉，取消确认后保留输入和焦点。
- 编辑及未保存翻译期间冻结筛选与分页；后台刷新保留未提交翻译。
- 表格编辑仅支持明确勾选的未发布词条；未选择、跨页全选或仅选择已发布项时禁用入口并显示原因。混合选择说明跳过的已发布项，保存请求只提交未发布项。已发布词条可从详情修改译文，沿用既有保存及重新校对流程。
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

- `assets/scrollbar.css` 将最外层页面滚动统一交给 `#app`（100dvh、overflow-y:auto、scrollbar-gutter:stable）；html/body 不承担页面滚动。浮层 Portal 位于 body，与页面滚动容器分离；Reka UI 锁定 body 和背景指针交互时，页面滚动条保持可见，浮层内部正常滚动。`AppUiProvider.vue` 禁止额外 padding/margin 补偿。路由按 history position 保存、恢复 `#app` 滚动位置；打印恢复自然文档流。`tests/ui-preview.ts` 复用同一 Provider。

- layouts/index.vue owns localized document titles, the skip link and a mobile-only drawer trigger. There is no global top menu/header. AppSidebar owns Nexus branding, permission-filtered navigation, and the only appearance/collapse control location in its footer.
- SidebarProvider / SidebarRail own collapse, mobile drawer and pointer/keyboard width control (220–360px, default 264px). Desktop width persists under nexus-sidebar-width; mobile navigation closes after choosing a route. Shortcuts never intercept text input or IME composition.
- style.css owns workspace-page, metric-strip, semantic panel geometry, table density, focus and reduced-motion behavior. Editing overlays continue to use the canonical Dialog / Sheet / AlertDialog primitives and existing unsaved-change guards.
- Project directory rows, dashboard panels, language tables, settings and workbench share light semantic panels with teal selection and primary actions (or the user-selected alternate palette). Status labels and icons retain meaning without requiring color.
- tests/ui-preview.html mounts real route components against in-memory API data for desktop, narrow, theme, loading/error/empty and overlay verification. It does not call live APIs.

- `src/lib/source-language.ts` 统一工作台与总览的原文语种解析：显式 is_source 优先，历史项目延续 cn / zh / zh-CN / en / 首项的既有回退顺序。总览目标语种数量排除有效原文语种；优先关注只列出确实缺少译文的目标语种。

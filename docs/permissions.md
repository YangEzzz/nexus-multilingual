# 前端权限

角色继续使用 `admin`、`productor`、`developer`、`translator`。
权限分配统一维护在 `src/lib/permissions.ts`。`owner` 兼容为管理员；不按用户 ID 授权。
未知角色、未知权限和空列表均拒绝访问。

```vue
<!-- 使用功能权限，推荐 -->
<UiButton v-permission="'term.create'">
新建词条
</UiButton>

<!-- 也可直接按现有角色控制；数组默认任一满足 -->
<UiButton v-permission="['admin', 'developer']">
开发操作
</UiButton>

<!-- 全部功能权限都满足时显示 -->
<UiButton v-permission.all="['term.review', 'term.publish']">
审核发布
</UiButton>
```

`v-permission` 使用 `display: none !important` 隐藏没有权限的入口，保留节点以便响应角色与绑定变化，
同时阻止拒绝访问时的点击和键盘事件。应用于原生元素或具有单一元素根节点的组件；
不要放在 `template`、Teleport、Dialog/Dropdown 根容器或具有多个根节点的组件上。
不要在同一元素上同时使用 `v-show` 或动态修改 `display`；业务条件用 `v-if`，权限交给指令。

表单只读和操作函数复用同一规则：

```ts
const { can } = usePermission()
const _deleteTerm = async () => {
  if (!can('term.delete'))
    return
  await api.post({ url: '/projects/1/terms/1/delete' })
}
void _deleteTerm
```

```vue
<UiInput :disabled="!can('term.structure')" />
```

项目创建/编辑、项目提示词及词条审核/发布开放给管理员和产品；
词条结构、创建、导入、删除开放给管理员和开发；
译文和 AI 翻译开放给管理员、产品和翻译员；
项目删除、语言库维护、AI 凭据及线上文件发布仅管理员。
四个角色均可导出；当前未实现按项目成员和负责语言限制导出或编辑。

AI 设置和项目日志的导航、命令菜单和直接路由访问使用同一权限表。
项目总览、项目管理、工作台及可选语言属于基础导航，不按角色枚举隐藏；角色未加载或无法识别时仍保留入口。
页面入口隐藏及函数检查仅用于前端交互，不能替代后端授权；现有接口需另行补齐权限校验。

浏览器回归：启动 `pnpm dev`，打开 `/tests/permission.html`。
覆盖四角色权限、未知值、角色切换、绑定变化、单根组件、拒绝点击、卸载和真实项目列表入口。
测试接口由本地 fixture 替代，不创建或删除任何业务数据。

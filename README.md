# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3
`<script setup>` SFCs, check out the
[script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the
[Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

# 聚合工具项目

聚合工具是一个用于数据聚合和分析的Web应用，使用Vue 3、TypeScript和Shadcn UI构建。

## 动态路由注入

本项目实现了基于后端返回的菜单数据动态注入路由的功能。以下是实现的关键部分：

### 1. 菜单数据结构

后端返回的菜单数据格式如下：

```json
[
  {
    "id": 1,
    "name": "控制台",
    "path": "/dashboard",
    "component": "Dashboard",
    "icon": "dashboard",
    "permission_code": "dashboard",
    "children": []
  },
  {
    "id": 6,
    "name": "实用工具",
    "path": null,
    "component": null,
    "icon": null,
    "permission_code": null,
    "children": [
      {
        "id": 7,
        "name": "剪贴板",
        "path": "/paste",
        "component": "Paste",
        "icon": null,
        "permission_code": null,
        "children": []
      }
    ]
  }
]
```

### 2. 权限与路由状态管理

使用Pinia管理权限和路由状态（`src/store/permission.ts`）：

- `setMenus`: 设置菜单数据
- `generateRoutes`: 根据菜单数据生成路由配置
- `addRoutes`: 动态添加路由到router实例
- `resetRoutes`: 重置路由配置

### 3. 约定式组件加载

使用约定式路由方式，结合Vite的模块导入功能自动加载组件：

```typescript
// 预先加载所有视图组件
const modules = import.meta.glob('@/views/**/index.vue')

// 在路由配置中查找对应组件
const importFn = modules[componentPath]
if (importFn) {
  route.component = importFn
}
```

由于Vite限制了动态导入路径必须是静态可分析的（不能使用完全动态的变量路径），我们使用`import.meta.glob`预先加载所有视图组件，然后在路由配置中查找对应的组件。

#### 层级菜单的配置

对于层级菜单，有以下几种配置方式：

1. **父菜单作为分组，无对应页面**

```json
{
  "id": 6,
  "name": "实用工具",
  "path": null,
  "component": null,
  "icon": null,
  "permission_code": null,
  "children": [
    {
      "id": 7,
      "name": "剪贴板",
      "path": "/paste",
      "component": "Tools/Paste",
      "icon": null,
      "permission_code": null,
      "children": []
    }
  ]
}
```

在这种情况下，"实用工具"仅作为一个分组，没有对应的页面和路径，而其子菜单"剪贴板"的component值需要包含完整的相对路径`Tools/Paste`，这样系统会自动加载`/views/Tools/Paste/index.vue`组件。由于子菜单路径以"/"开头，它将作为根路径处理。

2. **父菜单有对应页面，子菜单使用完整路径**

```json
{
  "id": 2,
  "name": "用户管理",
  "path": "/users",
  "component": "Users",
  "icon": "user",
  "permission_code": "user:view",
  "children": [
    {
      "id": 3,
      "name": "用户列表",
      "path": "/users/list",
      "component": "UserList",
      "icon": null,
      "permission_code": null,
      "children": []
    }
  ]
}
```

在这种情况下，子菜单路径是完整的URL路径，系统会分别加载`/views/Users/index.vue`和`/views/UserList/index.vue`组件。

3. **父菜单有对应页面，子菜单使用相对路径**

```json
{
  "id": 2,
  "name": "用户管理",
  "path": "/users",
  "component": "Users",
  "icon": "user",
  "permission_code": "user:view",
  "children": [
    {
      "id": 3,
      "name": "用户列表",
      "path": "list", // 注意这里没有前导斜杠
      "component": "List",
      "icon": null,
      "permission_code": null,
      "children": []
    }
  ]
}
```

在这种情况下，子菜单路径是相对于父菜单的路径，系统会自动拼接为`/users/list`，并加载`/views/Users/List/index.vue`组件，自动处理父子组件的路径关系。

#### 路径处理规则

系统会根据以下规则处理菜单路径：

1. 以 `/` 开头的路径被视为绝对路径，直接使用
2. 不以 `/` 开头的路径被视为相对路径，会自动拼接父级路径
3. 嵌套的子菜单会继承父级路径，形成树状结构

### 4. 路由初始化流程

1. 用户登录成功后获取菜单数据
2. 基于菜单数据生成路由配置
3. 动态注册路由
4. 跳转到目标页面

### 5. 路由守卫

使用全局前置守卫检查用户是否登录以及是否需要初始化动态路由。

### 6. 菜单渲染

Layout组件将后端菜单数据转换为前端UI格式进行渲染。

### 7. 权限控制

通过菜单中的`permission_code`属性进行权限控制，未授权的菜单项不会显示，未授权的路由访问会被重定向到404页面。

## 技术栈

- Vue 3
- TypeScript
- Vue Router
- Pinia
- Shadcn UI
- VeeValidate
- Zod
- VueUse
- Tailwind CSS

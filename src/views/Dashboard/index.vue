<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// 定义组件名称解决linter错误
defineOptions({
  name: 'DashboardPage'
})

// 模拟用户数据
const userData = ref({
  name: '张三',
  email: 'zhangsan@example.com',
  role: 'admin', // 'user' 或 'admin'
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan'
})

// 普通用户：参与的项目
const userProjects = ref([
  { id: 1, name: '项目 A', description: '这是一个示例项目', status: '进行中', joinDate: '2024-01-15' },
  { id: 2, name: '项目 B', description: '这是另一个示例项目', status: '进行中', joinDate: '2024-02-20' },
  { id: 3, name: '项目 C', description: '已完成的项目', status: '已完成', joinDate: '2023-12-01' }
])

// 管理员：用户统计
const adminStats = ref([
  { label: '总用户数', value: '1,234', icon: '👥' },
  { label: '活跃用户', value: '856', icon: '✅' },
  { label: '今日登录', value: '342', icon: '📊' }
])

// 管理员：最近注册的用户
const recentUsers = ref([
  { id: 1, name: '李四', email: 'lisi@example.com', joinDate: '2024-12-24', status: '活跃' },
  { id: 2, name: '王五', email: 'wangwu@example.com', joinDate: '2024-12-23', status: '活跃' },
  { id: 3, name: '赵六', email: 'zhaoliu@example.com', joinDate: '2024-12-22', status: '活跃' },
  { id: 4, name: '孙七', email: 'sunqi@example.com', joinDate: '2024-12-21', status: '禁用' }
])

const isAdmin = ref(userData.value.role === 'admin')
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- 顶部欢迎区域 -->
    <div class="border-b bg-card">
      <div class="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div class="flex items-center gap-4">
          <img :src="userData.avatar" :alt="userData.name" class="w-14 h-14 rounded-full border-2 border-primary" />
          <div>
            <h1 class="text-2xl font-bold">{{ userData.name }}</h1>
            <p class="text-muted-foreground text-sm">{{ userData.email }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <!-- 普通用户视图 -->
      <template v-if="!isAdmin">
        <!-- 用户信息卡片 -->
        <Card class="mb-8">
          <CardHeader>
            <CardTitle>个人信息</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-muted-foreground text-sm">邮箱</p>
                <p class="font-semibold">{{ userData.email }}</p>
              </div>
              <div>
                <p class="text-muted-foreground text-sm">角色</p>
                <p class="font-semibold">普通用户</p>
              </div>
            </div>
            <Button variant="outline" class="w-full">编辑个人信息</Button>
          </CardContent>
        </Card>

        <!-- 参与的项目 -->
        <Card>
          <CardHeader>
            <CardTitle>我的项目</CardTitle>
            <CardDescription>共 {{ userProjects.length }} 个项目</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-for="project in userProjects" :key="project.id" class="flex items-start justify-between pb-4 border-b last:border-b-0">
                <div class="flex-1">
                  <h3 class="font-semibold">{{ project.name }}</h3>
                  <p class="text-muted-foreground text-sm">{{ project.description }}</p>
                  <p class="text-muted-foreground text-xs mt-1">加入时间：{{ project.joinDate }}</p>
                </div>
                <span :class="['text-xs font-semibold px-3 py-1 rounded whitespace-nowrap ml-4', project.status === '进行中' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800']">
                  {{ project.status }}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </template>

      <!-- 管理员视图 -->
      <template v-else>
        <!-- 统计数据 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card v-for="stat in adminStats" :key="stat.label" class="flex flex-col items-center justify-center py-8">
            <div class="text-4xl mb-2">{{ stat.icon }}</div>
            <div class="text-3xl font-bold">{{ stat.value }}</div>
            <div class="text-muted-foreground text-sm">{{ stat.label }}</div>
          </Card>
        </div>

        <!-- 最近注册的用户 -->
        <Card>
          <CardHeader>
            <CardTitle>最近注册的用户</CardTitle>
            <CardDescription>共 {{ recentUsers.length }} 条记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-for="user in recentUsers" :key="user.id" class="flex items-center justify-between pb-4 border-b last:border-b-0">
                <div class="flex-1">
                  <h3 class="font-semibold">{{ user.name }}</h3>
                  <p class="text-muted-foreground text-sm">{{ user.email }}</p>
                  <p class="text-muted-foreground text-xs mt-1">注册时间：{{ user.joinDate }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="['text-xs font-semibold px-3 py-1 rounded', user.status === '活跃' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
                    {{ user.status }}
                  </span>
                  <Button variant="outline" size="sm">管理</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>

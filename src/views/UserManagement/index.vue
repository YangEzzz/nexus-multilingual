<script setup lang="ts">
import { ref, computed } from 'vue'
import { getUserList, deleteUser, getRoleList, updateUserRole } from '@/api/user'
import type { UserInfo, PaginationType, RoleInfo } from '@/api/user/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'vue-sonner'

// 定义组件名称解决linter错误
defineOptions({
  name: 'UserManagementPage'
})

// 加载状态
const isLoading = ref(false)
const isRoleLoading = ref(false)
const isUpdatingRole = ref(false)

// 用户列表数据
const users = ref<UserInfo[]>([])

// 分页数据
const pagination = ref<PaginationType>({
  current: 1,
  pageSize: 10,
  total: 0
})

// 搜索关键字
const searchKeyword = ref('')

// 角色列表
const roles = ref<RoleInfo[]>([])

// 编辑状态
const editingUserId = ref<number | null>(null)
const selectedRoleId = ref<number | null>(null)

// 计算角色名称颜色
const getRoleColor = (roleName: string) => {
  switch (roleName) {
    case '管理员':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case '编辑':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

// 总页数
const totalPages = computed(() => {
  return Math.ceil(pagination.value.total / pagination.value.pageSize)
})

// 加载用户列表
const loadUserList = async (page = 1, pageSize = 10, keyword = '') => {
  isLoading.value = true

  try {
    const response = await getUserList({
      page,
      pageSize,
      keyword
    })

    if (response.success && response.data) {
      users.value = response.data.list
      pagination.value = {
        current: page,
        pageSize,
        total: response.data.pagination.total
      }
    } else {
      toast.error('获取用户列表失败', {
        description: response.message || '请稍后重试'
      })
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    toast.error('获取用户列表失败', {
      description: '请检查网络连接后重试'
    })
  } finally {
    isLoading.value = false
  }
}

// 加载角色列表
const loadRoleList = async () => {
  isRoleLoading.value = true
  try {
    const response = await getRoleList()
    if (response.success && response.data) {
      roles.value = response.data
    } else {
      toast.error('获取角色列表失败', {
        description: response.message || '请稍后重试'
      })
    }
  } catch (error) {
    console.error('获取角色列表失败:', error)
    toast.error('获取角色列表失败', {
      description: '请检查网络连接后重试'
    })
  } finally {
    isRoleLoading.value = false
  }
}

// 处理页码变更
const handlePageChange = (page: number) => {
  if (page === pagination.value.current) return
  loadUserList(page, pagination.value.pageSize, searchKeyword.value)
}

// 处理搜索
const handleSearch = () => {
  loadUserList(1, pagination.value.pageSize, searchKeyword.value)
}

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = ''
  loadUserList(1, pagination.value.pageSize, '')
}

// 开始编辑用户角色
const startEditRole = (user: UserInfo) => {
  editingUserId.value = user.id
  selectedRoleId.value = user.role?.id || null

  // 如果角色列表为空，加载角色列表
  if (roles.value.length === 0) {
    loadRoleList()
  }
}

// 取消编辑
const cancelEdit = () => {
  editingUserId.value = null
  selectedRoleId.value = null
}

// 确认更新角色
const confirmUpdateRole = async () => {
  if (!editingUserId.value || !selectedRoleId.value) {
    return
  }

  isUpdatingRole.value = true

  try {
    const response = await updateUserRole({
      userId: editingUserId.value,
      roleId: selectedRoleId.value
    })

    if (response.success) {
      toast.success('更新成功', {
        description: '用户角色已更新'
      })

      // 更新本地数据
      const user = users.value.find((u) => u.id === editingUserId.value)
      const role = roles.value.find((r) => r.id === selectedRoleId.value)

      if (user && role) {
        user.role = {
          id: role.id,
          name: role.name
        }
      }

      // 重置编辑状态
      cancelEdit()
    } else {
      toast.error('更新失败', {
        description: response.message || '请稍后重试'
      })
    }
  } catch (error) {
    console.error('更新用户角色失败:', error)
    toast.error('更新失败', {
      description: '请检查网络连接后重试'
    })
  } finally {
    isUpdatingRole.value = false
  }
}

// 删除用户
const handleDelete = async (user: UserInfo) => {
  try {
    const response = await deleteUser(user.id)
    if (response.success) {
      toast.success('删除成功', {
        description: `用户 ${user.name} 已被删除`
      })
      // 重新加载当前页数据
      loadUserList(pagination.value.current, pagination.value.pageSize, searchKeyword.value)
    } else {
      toast.error('删除失败', {
        description: response.message || '请稍后重试'
      })
    }
  } catch (error) {
    console.error('删除用户失败:', error)
    toast.error('删除失败', {
      description: '请检查网络连接后重试'
    })
  }
}

// 删除确认对话框
const showDeleteDialog = ref(false)
const userToDelete = ref<UserInfo | null>(null)

const openDeleteDialog = (user: UserInfo) => {
  userToDelete.value = user
  showDeleteDialog.value = true
}

const closeDeleteDialog = () => {
  userToDelete.value = null
  showDeleteDialog.value = false
}

// 初始化加载
loadUserList(pagination.value.current, pagination.value.pageSize)
loadRoleList()
</script>

<template>
  <div class="py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">用户管理</h1>
      <p class="text-muted-foreground">管理系统用户及权限</p>
    </div>

    <!-- 用户列表 -->
    <div class="bg-card border rounded-lg overflow-hidden">
      <div class="p-4 border-b flex flex-wrap justify-between items-center gap-4">
        <h2 class="text-xl font-bold">用户列表</h2>

        <!-- 搜索区域 -->
        <div class="flex items-center space-x-2">
          <div class="relative">
            <Input
              v-model="searchKeyword"
              placeholder="搜索用户名或邮箱..."
              class="min-w-[200px] pr-8"
              @keyup.enter="handleSearch"
            />
            <button
              v-if="searchKeyword"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              @click="clearSearch"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          </div>
          <Button @click="handleSearch">搜索</Button>
        </div>

        <Button> 添加用户 </Button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex justify-center items-center py-20">
        <svg
          class="animate-spin h-8 w-8 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-muted">
              <th class="px-4 py-3 text-left font-medium">ID</th>
              <th class="px-4 py-3 text-left font-medium">用户名</th>
              <th class="px-4 py-3 text-left font-medium">邮箱</th>
              <th class="px-4 py-3 text-left font-medium">角色</th>
              <th class="px-4 py-3 text-left font-medium">创建时间</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-t hover:bg-muted/50">
              <td class="px-4 py-3">{{ user.id }}</td>
              <td class="px-4 py-3 font-medium">{{ user.name }}</td>
              <td class="px-4 py-3">{{ user.email }}</td>
              <td class="px-4 py-3">
                <!-- 角色编辑状态 -->
                <div v-if="editingUserId === user.id">
                  <Select v-model="selectedRoleId" :disabled="isRoleLoading || isUpdatingRole">
                    <SelectTrigger class="w-[180px]">
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <div v-if="isRoleLoading" class="flex justify-center items-center py-2">
                        <svg
                          class="animate-spin h-4 w-4 text-primary"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                      <SelectItem v-for="role in roles" :key="role.id" :value="role.id">
                        {{ role.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- 角色展示状态 -->
                <span
                  v-else
                  :class="{
                    'px-2 py-1 rounded-full text-xs': true,
                    [getRoleColor(user.role?.name || '普通用户')]: true
                  }"
                >
                  {{ user.role?.name || '普通用户' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm">{{ new Date(user.createdAt).toLocaleString() }}</td>
              <td class="px-4 py-3">
                <!-- 编辑状态的操作按钮 -->
                <div v-if="editingUserId === user.id" class="flex space-x-2">
                  <Button variant="default" size="sm" :disabled="isUpdatingRole" @click="confirmUpdateRole">
                    <svg
                      v-if="isUpdatingRole"
                      class="animate-spin h-4 w-4 mr-1"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    确定
                  </Button>
                  <Button variant="outline" size="sm" :disabled="isUpdatingRole" @click="cancelEdit"> 取消 </Button>
                </div>

                <!-- 正常状态的操作按钮 -->
                <div v-else class="flex space-x-2">
                  <Button variant="ghost" size="sm" @click="startEditRole(user)">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-4 w-4"
                    >
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                      <path d="m15 5 4 4"></path>
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" class="text-destructive" @click="openDeleteDialog(user)">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-4 w-4"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </Button>
                </div>
              </td>
            </tr>

            <!-- 空状态 -->
            <tr v-if="users.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-muted-foreground">
                <div class="flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mb-4"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                    <line x1="3" x2="21" y1="9" y2="9"></line>
                    <line x1="9" x2="9" y1="21" y2="9"></line>
                  </svg>
                  <p>{{ searchKeyword ? '没有找到匹配的用户' : '暂无用户数据' }}</p>
                  <Button v-if="searchKeyword" variant="link" @click="clearSearch"> 清除搜索 </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页控件 -->
      <div class="p-4 border-t flex flex-wrap justify-between items-center gap-4">
        <div>共 {{ pagination.total }} 条记录</div>
        <Pagination
          v-slot="{ page }"
          :items-per-page="pagination.pageSize"
          :total="pagination.total"
          :sibling-count="1"
          show-edges
          :default-page="pagination.current"
          @update:page="handlePageChange"
        >
          <PaginationContent v-slot="{ items }" class="flex items-center gap-1">
            <PaginationFirst @click="handlePageChange(1)" />
            <PaginationPrevious @click="handlePageChange(page - 1)" />

            <template v-for="(item, index) in items">
              <PaginationItem v-if="item.type === 'page'" :key="index" :value="item.value" as-child>
                <Button
                  class="w-10 h-10 p-0"
                  :variant="item.value === page ? 'default' : 'outline'"
                  @click="handlePageChange(item.value)"
                >
                  {{ item.value }}
                </Button>
              </PaginationItem>
              <PaginationEllipsis v-else :key="item.type" :index="index" />
            </template>

            <PaginationNext @click="handlePageChange(page + 1)" />
            <PaginationLast @click="handlePageChange(totalPages)" />
          </PaginationContent>
        </Pagination>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除用户</AlertDialogTitle>
          <AlertDialogDescription>
            您确定要删除用户 "{{ userToDelete?.name }}" 吗？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="closeDeleteDialog">取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="
              () => {
                if (userToDelete) {
                  handleDelete(userToDelete)
                  closeDeleteDialog()
                }
              }
            "
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

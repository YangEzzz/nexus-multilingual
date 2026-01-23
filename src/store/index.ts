import { createPinia } from 'pinia'

const store = createPinia()
export default store

// 导出所有store模块，便于统一导入
export * from './permission'

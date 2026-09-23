import type { App } from 'vue'

import router from '@/router/index'

export function setupRouter(app: App) {
  app.use(router)
}

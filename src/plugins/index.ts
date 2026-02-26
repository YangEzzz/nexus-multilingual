import type { App } from 'vue'

import { setupDayjs } from './dayjs/setup'
import { setupI18n } from './i18n/setup'
import { setupPinia } from './pinia/setup'
import { setupRouter } from './router/setup'

export const setupPlugins = (app: App) => {
  setupDayjs()
  setupI18n(app)
  setupPinia(app)
  setupRouter(app)
}

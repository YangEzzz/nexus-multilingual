import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

// import basicSsl from '@vitejs/plugin-basic-ssl'
import VueDevTools from 'vite-plugin-vue-devtools'
import { createViteVConsole } from './vconsole'

export function createVitePlugins(viteEnv: any, isBuild = false) {
  return [
    // 开启https测试
    // basicSsl(),
    // https://github.com/pengzhanbo/vite-plugin-mock-dev-server
    // mockDevServerPlugin(),
    // https://github.com/vadxq/vite-plugin-vconsole
    createViteVConsole(viteEnv),

    // https://github.com/vuejs/devtools-next
    VueDevTools()
  ]
}

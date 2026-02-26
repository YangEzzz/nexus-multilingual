import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Component from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const RouteGenerateExclude = ['**/components/**', '**/layouts/**', '**/data/**', '**/types/**']

export default defineConfig({
  plugins: [vue(), tailwindcss(), VueRouter({
    exclude: RouteGenerateExclude,
    dts: 'src/types/typed-router.d.ts',
  }), vueDevTools(), AutoImport({
    include: [
      /\.[tj]sx?$/,
      /\.vue$/,
    ],
    imports: [
      'vue',
      VueRouterAutoImports,
    ],
    dirs: [
      'src/composables/**/*.ts',
      'src/constants/**/*.ts',
      'src/store/**/*.ts',
    ],
    defaultExportByFilename: true,
    dts: 'src/types/auto-import.d.ts',
  }), Component({
    dirs: [
      'src/components',
      'src/components/ui',
    ],
    collapseSamePrefixes: true,
    directoryAsNamespace: true,
    dts: 'src/types/auto-import-components.d.ts',
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

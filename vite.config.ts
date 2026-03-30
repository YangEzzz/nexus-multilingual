import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Component from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const RouteGenerateExclude = ['**/components/**', '**/layouts/**', '**/data/**', '**/types/**']

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    ...(command === 'serve'
      ? [VueRouter({
          exclude: RouteGenerateExclude,
          dts: 'src/types/typed-router.d.ts',
        })]
      : []),
    ...(command === 'serve' ? [vueDevTools()] : []),
    AutoImport({
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
      dts: command === 'serve' ? 'src/types/auto-import.d.ts' : false,
    }),
    Component({
      dirs: [
        'src/components',
        'src/components/ui',
      ],
      collapseSamePrefixes: true,
      directoryAsNamespace: true,
      dts: command === 'serve' ? 'src/types/auto-import-components.d.ts' : false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))

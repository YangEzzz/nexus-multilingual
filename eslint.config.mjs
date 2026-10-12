import antfu from '@antfu/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default antfu({
  type: 'app',
  vue: true,
  typescript: true,
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },
  ignores: [
    'src/components/ui/**',
    // ...globs
  ],
  globals: {
    definePage: 'readonly',
  },
  rules: {
    // 禁用 antfu 的顶层函数规则（与箭头函数规则冲突）
    'antfu/top-level-function': 'off',
    // 强制使用箭头函数
    'prefer-arrow-callback': ['warn', { allowNamedFunctions: false }],
    // 命名业务函数允许声明式；回调继续使用箭头函数。
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    // setup 中的延迟执行闭包不要求变量提前声明；类仍检查顺序。
    'ts/no-use-before-define': ['error', { functions: false, variables: false, classes: true, typedefs: false }],
    // console 使用警告而不是错误
    'no-console': 'warn',
    // 未使用的变量警告而不是错误
    'no-unused-vars': 'warn',
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'yaml/indent': ['error', 2],
    'jsonc/indent': ['error', 2],
    'vue/block-lang': ['warn', {
      script: { lang: ['ts', 'tsx'] },
    }],
    'vue/valid-v-model': 'off',
  },
  ...pluginQuery.configs['flat/recommended'],
})

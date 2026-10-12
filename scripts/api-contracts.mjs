import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

export async function checkAPIBoundaries(root, scenarios) {
  const server = await createServer({ configFile: false, root, resolve: { alias: { '@': path.join(root, 'src') } }, plugins: [{
    name: 'api-contract-transport',
    load(id) {
      const normalized = id.replaceAll('\\', '/')
      if (normalized.endsWith('/src/request/index.ts'))
        return 'export const api = Object.fromEntries(["get", "post", "downloadPost"].map(method => [method, async options => ({ method, ...options })]));'
      if (normalized.endsWith('/src/utils/session.ts'))
        return 'export const apiBaseURL = "https://api.example.test/api/v1"; export const authRequest = async (path, data) => ({ path, data }); export const ssoRequest = authRequest;'
    },
  }], server: { middlewareMode: true, watch: null } })
  try {
    for (const [module, name, args, expected] of scenarios) {
      const api = await server.ssrLoadModule(`/src/api/${module}.ts`)
      const result = await api[name](...args)
      for (const [key, value] of Object.entries(expected))
        assert.deepEqual(result[key], value, `${name}: ${key}`)
    }
    async function inspect(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await inspect(file)
        }
        else if (/\.(?:ts|vue)$/.test(entry.name) && entry.name !== 'use-axios.ts') {
          const source = await readFile(file, 'utf8')
          assert.ok(!/from ['"]@\/request['"]/.test(source), `business UI must call domain APIs: ${file}`)
          assert.ok(!/\b(?:authRequest|ssoRequest|fetch)\s*(?:<[^;\n]+>)?\(/.test(source), `raw transport in business UI: ${file}`)
        }
      }
    }
    await inspect(path.join(root, 'src/views'))
    await inspect(path.join(root, 'src/composables'))
    process.stdout.write(`PASS ${scenarios.length} API request contracts and UI/API boundaries\n`)
  }
  finally { await server.close() }
}

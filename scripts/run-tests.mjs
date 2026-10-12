import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { effectScope, reactive } from 'vue'
import { checkAPIBoundaries } from './api-contracts.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ configFile: false, root, resolve: { alias: { '@': path.join(root, 'src') } }, server: { middlewareMode: true, watch: null } })
let passed = 0
async function check(name, test) {
  await test()
  passed++
  process.stdout.write(`PASS ${name}\n`)
}
function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
function term(id = '1') {
  return { id, key: id, module: '', description: 'reference', translations: { en: 'original' }, status: 'pending' }
}

try {
  const json = await server.ssrLoadModule('/src/lib/import-json.ts')
  const drafts = await server.ssrLoadModule('/src/lib/term-draft.ts')
  const translation = await server.ssrLoadModule('/src/composables/use-term-translation.ts')
  const requests = await server.ssrLoadModule('/src/composables/use-request-scope.ts')
  const projectSave = await server.ssrLoadModule('/src/lib/project-save.ts')
  const tables = await server.ssrLoadModule('/src/components/data-table/use-generate-vue-table.ts')
  await check('pasted JavaScript is rejected without execution', () => {
    globalThis.reviewMarker = false
    assert.throws(() => json.parsePastedObject('({x: (globalThis.reviewMarker = true)})'), /JSON/)
    assert.equal(globalThis.reviewMarker, false)
    delete globalThis.reviewMarker
    assert.deepEqual(json.normalizeJsonImport(json.parsePastedObject('{"auth":{"login":{"title":"登录"}}}'), 'object'), [{ module: 'auth', key: 'login.title', content: '登录' }])
  })
  await check('discard restores page and cross-page selection with shared references', () => {
    const first = term('1')
    const second = term('2')
    const snapshot = drafts.captureTermDraft([first], new Map([['1', first], ['2', second]]))
    first.key = 'discarded'
    second.key = 'also discarded'
    const restored = drafts.restoreTermDraft(snapshot)
    assert.equal(restored.terms[0].key, '1')
    assert.equal(restored.selected.get('2').key, '2')
    assert.equal(restored.selected.get('1'), restored.terms[0])
  })
  await check('late translation cannot write into a replacement editor', async () => {
    const waiting = deferred()
    const first = term('A')
    const second = term('B')
    let active = first
    const service = translation.useTermTranslation(() => waiting.promise, () => ({ isCurrent: () => true }))
    const pending = service.translate(first, { template: '{description}', languages: ['en'], placeholderRule: '', isActive: () => active === first })
    active = second
    waiting.resolve({ translations: { en: 'result for A' } })
    assert.equal(await pending, 'skipped')
    assert.equal(first.translations.en, 'original')
    assert.equal(second.translations.en, 'original')
  })
  await check('translation failure propagates and does not mutate status', async () => {
    const target = term()
    const service = translation.useTermTranslation(async () => {
      throw new Error('AI unavailable')
    }, () => ({ isCurrent: () => true }))
    await assert.rejects(service.translate(target, { template: '', languages: ['en'], placeholderRule: '', isActive: () => true }), /AI unavailable/)
    assert.equal(target.status, 'pending')
    assert.equal(target.translations.en, 'original')
  })
  await check('editor changes invalidate a pending translation', async () => {
    const waiting = deferred()
    const target = term()
    const service = translation.useTermTranslation(() => waiting.promise, () => ({ isCurrent: () => true }))
    const pending = service.translate(target, { template: '', languages: ['en'], placeholderRule: '', isActive: () => true })
    target.translations.en = 'human edit'
    waiting.resolve({ translations: { en: 'AI edit' } })
    assert.equal(await pending, 'skipped')
    assert.equal(target.translations.en, 'human edit')
  })
  await check('successful translation retains human review stage for both surfaces', async () => {
    const target = term()
    const service = translation.useTermTranslation(async () => ({ translations: { en: 'translated' } }), () => ({ isCurrent: () => true }))
    assert.equal(await service.translate(target, { template: '', languages: ['en'], placeholderRule: '', isActive: () => true }), 'success')
    assert.equal(target.status, 'pending')
    assert.equal(target.translations.en, 'translated')
  })
  await check('project switch and scope disposal invalidate old requests', () => {
    const scope = effectScope()
    let context = 'A'
    const owner = scope.run(() => requests.useRequestScope(() => context))
    const first = owner.request()
    context = 'B'
    assert.equal(first.isCurrent(), false)
    owner.invalidate()
    assert.equal(first.signal.aborted, true)
    const second = owner.request()
    scope.stop()
    assert.equal(second.isCurrent(), false)
    assert.equal(second.signal.aborted, true)
  })
  await check('failed language save retries the existing project rather than creating twice', async () => {
    const form = { id: 0, name: 'test', code: 'test', description: '' }
    let created = 0
    let updated = 0
    let attempts = 0
    const api = {
      create: async () => {
        created++
        return 7
      },
      update: async () => { updated++ },
      languages: async () => {
        if (!attempts++)
          throw new Error('language failure')
      },
    }
    await assert.rejects(projectSave.saveProjectConfiguration(form, [], api), /language failure/)
    assert.equal(form.id, 7)
    await projectSave.saveProjectConfiguration(form, [], api)
    assert.equal(created, 1)
    assert.equal(updated, 1)
  })
  await check('server table reacts to total and delegates pagination using stable IDs', () => {
    const scope = effectScope()
    const props = reactive({ data: [term('A')], columns: [{ accessorKey: 'key' }], serverPagination: { page: 1, pageSize: 10, total: 21, onPageChange: (page) => {
      props.serverPagination.page = page
    }, onPageSizeChange: (size) => {
      props.serverPagination.pageSize = size
    } } })
    const table = scope.run(() => tables.generateVueTable(props))
    assert.equal(table.getPageCount(), 3)
    props.serverPagination.total = 41
    assert.equal(table.getPageCount(), 5)
    table.nextPage()
    assert.equal(props.serverPagination.page, 2)
    table.setPageSize(20)
    assert.equal(props.serverPagination.pageSize, 20)
    assert.equal(table.getRowModel().rows[0].id, 'A')
    scope.stop()
  })
  process.stdout.write(`${passed} regression checks passed\n`)
}
finally {
  await server.close()
}

const apiTestSignal = new AbortController().signal
await checkAPIBoundaries(root, [
  ['projects', 'listProjects', [], { method: 'get', url: '/projects' }],
  ['projects', 'getProject', ['a/b', { params: { limit: 10 } }], { method: 'get', url: '/projects/a%2Fb', params: { limit: 10 } }],
  ['projects', 'createProject', [{ data: { name: 'test' } }], { method: 'post', url: '/projects', data: { name: 'test' } }],
  ['projects', 'updateProjectLanguages', [7, { data: [{ code: 'en' }] }], { method: 'post', url: '/projects/7/languages/update', data: [{ code: 'en' }] }],
  ['terms', 'listTerms', [7, { params: { page: 2 }, signal: apiTestSignal }], { method: 'get', url: '/projects/7/terms', params: { page: 2 }, signal: apiTestSignal }],
  ['terms', 'updateTerm', [7, 'a/b', { data: { status: 'review' } }], { method: 'post', url: '/projects/7/terms/a%2Fb/update', data: { status: 'review' } }],
  ['terms', 'previewTermBulk', [7, { data: { operation: 'delete' } }], { method: 'post', url: '/projects/7/terms/bulk/preview', data: { operation: 'delete' } }],
  ['terms', 'executeTermBulk', [7, { data: { operation: 'delete' } }], { method: 'post', url: '/projects/7/terms/bulk/execute', data: { operation: 'delete' } }],
  ['terms', 'importTermsJson', [7, { data: { language_code: 'en', items: [] } }], { method: 'post', url: '/projects/7/terms/import-json', data: { language_code: 'en', items: [] } }],
  ['terms', 'downloadTermsJson', [7, { data: { languages: ['en'] } }], { method: 'downloadPost', url: '/projects/7/terms/export/json', data: { languages: ['en'] } }],
  ['terms', 'downloadTermsExcel', [7, { data: { scope: { mode: 'all' } } }], { method: 'downloadPost', url: '/projects/7/terms/export/excel', data: { scope: { mode: 'all' } } }],
  ['locales', 'publishLocaleRelease', [7], { method: 'post', url: '/projects/7/locale-release/publish' }],
  ['languages', 'updateLanguage', [7, { data: { code: 'en' } }], { method: 'post', url: '/languages/7/update', data: { code: 'en' } }],
  ['ai', 'saveAISettings', [{ data: { model: 'test' } }], { method: 'post', url: '/ai/settings', data: { model: 'test' } }],
  ['auth', 'getLoginStatus', ['a&b'], { path: '/sso/status?transaction=a%26b' }],
  ['auth', 'cancelSSOLogin', ['t'], { path: '/sso/cancel', data: { transaction: 't' } }],
])

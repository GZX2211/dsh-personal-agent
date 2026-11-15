// tests/host/store/kv-store.test.ts
//
// kv 只存技术元数据（router 身份等），允许改写，但不允许把账本写坏：
// 原子替换、损坏降级、串行写入。

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KvStore } from '../../../src/host/store/kv-store.ts'

let directory: string
const opened: KvStore[] = []

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-kv-'))
})

afterEach(async () => {
  for (const store of opened.splice(0)) await store.close()
  await rm(directory, { recursive: true, force: true })
})

async function openStore(overrides: { onWarning?: (message: string) => void } = {}): Promise<KvStore> {
  const store = await KvStore.open({ directory, ...overrides })
  opened.push(store)
  return store
}

function kvPath(): string {
  return join(directory, 'kv.json')
}

describe('KvStore', () => {
  it('starts empty when no file exists', async () => {
    const store = await openStore()

    expect(store.get('router.session')).toBeUndefined()
    expect(existsSync(kvPath())).toBe(false)
  })

  it('persists values across reopen', async () => {
    const first = await openStore()
    await first.set('router.session', '{"sessionId":"session-1"}')
    await first.close()

    const reopened = await openStore()

    expect(reopened.get('router.session')).toBe('{"sessionId":"session-1"}')
  })

  it('overwrites values atomically and leaves no temp file', async () => {
    const store = await openStore()
    await store.set('router.session', 'first')
    await store.set('router.session', 'second')

    expect(store.get('router.session')).toBe('second')
    expect(JSON.parse(await readFile(kvPath(), 'utf8'))).toEqual({ 'router.session': 'second' })
    expect(existsSync(`${kvPath()}.tmp`)).toBe(false)
  })

  it('degrades a corrupt file to empty and warns', async () => {
    await writeFile(kvPath(), 'not json', 'utf8')
    const warnings: string[] = []

    const store = await openStore({ onWarning: message => warnings.push(message) })

    expect(store.get('router.session')).toBeUndefined()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/kv\.json/)
  })

  it('serializes concurrent writes', async () => {
    const store = await openStore()

    await Promise.all([store.set('a', '1'), store.set('b', '2'), store.set('c', '3')])

    const reopened = await openStore()
    expect(reopened.get('a')).toBe('1')
    expect(reopened.get('b')).toBe('2')
    expect(reopened.get('c')).toBe('3')
  })

  it('deletes a value and persists the deletion', async () => {
    const store = await openStore()
    await store.set('router.session', 'x')
    await store.delete('router.session')
    await store.close()

    const reopened = await openStore()

    expect(reopened.get('router.session')).toBeUndefined()
  })

  it('recovers a corrupt file on the next write', async () => {
    await writeFile(kvPath(), 'not json', 'utf8')
    const warnings: string[] = []
    const store = await openStore({ onWarning: message => warnings.push(message) })

    await store.set('router.session', 'fresh')
    await store.close()

    const reopened = await openStore()
    expect(reopened.get('router.session')).toBe('fresh')
    expect(warnings).toHaveLength(1)
  })

  it('rejects writes after close', async () => {
    const store = await openStore()
    await store.close()

    await expect(store.set('router.session', 'x')).rejects.toThrow(/closed/i)
  })
})

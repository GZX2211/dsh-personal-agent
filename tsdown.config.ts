// tsdown.config.ts
//
// 两个半区分别构建：Host 走 ESM（Node 进程内加载），Client 走 lazy-CJS
// （浏览器模块表通过 `factory(require)` 提供 react），后者再由
// scripts/wrap-client.mjs 包成 `window.__ModuleLoader__.load({...})`。

import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: 'host',
    entry: ['src/host/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    dts: false,
    clean: false,
    outExtensions: () => ({ js: '.js' }),
    deps: { neverBundle: [/^@deepseek-ai\//] },
  },
  {
    name: 'client',
    entry: { 'client.body': 'src/client/entry.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    outExtensions: () => ({ js: '.js' }),
    deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] },
  },
])

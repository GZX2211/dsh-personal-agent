// collab/scr/check-client.mjs
//
// 本地校验 lib/client.js：外壳形状、工厂返回值、apply 是否能在伪 ctx 上跑通。
// 不是产品代码，只用于安装前的一次性验证。

import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../../lib/client.js', import.meta.url), 'utf8')

let captured
const window = { __ModuleLoader__: { load: entry => { captured = entry } } }
new Function('window', source)(window)

if (!captured) throw new Error('client.js did not call window.__ModuleLoader__.load')
console.log('loader id:', captured.id)

const react = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: initial => [initial, () => {}],
  useEffect: () => {},
  Fragment: 'Fragment',
}
const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: 'Fragment',
}
const table = {
  react,
  'react-dom': {},
  'react/jsx-runtime': jsxRuntime,
}
const exports = captured.factory(specifier => {
  const hit = table[specifier]
  if (hit === undefined) throw new Error(`unexpected require("${specifier}")`)
  return hit
})

console.log('exports:', Object.keys(exports).sort().join(', '))
if (typeof exports.apply !== 'function') throw new Error('client half exports no apply()')
console.log('inject:', JSON.stringify(exports.inject))

const seen = { tabs: [], slots: [], opened: [], effects: [], beacons: [] }
const fakeCtx = {
  locale: { getLocale: () => ({ active: 'zh', locales: [], revision: 0 }) },
  effect: (fn, label) => {
    const dispose = fn()
    seen.effects.push(label)
    return () => dispose?.()
  },
  sidebarRightTabs: {
    register: definition => {
      seen.tabs.push(definition)
      return () => {}
    },
  },
  slots: {
    inject: (key, callback) => {
      const dispose = callback()
      seen.effects.push(`slots.inject:${key}`)
      return () => dispose?.()
    },
    register: (options, component) => {
      seen.slots.push({ options, component })
      return () => {}
    },
  },
  sidebarRight: {
    openTab: kind => {
      seen.opened.push(kind)
    },
  },
}

// 上报走 fetch；Node 里相对 URL 会 reject，代码本身按静默处理，这里只是别让它炸。
globalThis.fetch = () => Promise.reject(new Error('offline'))
globalThis.location = { href: 'http://127.0.0.1:52810/', origin: 'http://127.0.0.1:52810' }

exports.apply(fakeCtx)
await new Promise(resolve => setTimeout(resolve, 1800))

console.log('effects:', seen.effects)
console.log('tab types:', seen.tabs.map(tab => `${tab.id}/${tab.kind}`))
console.log('guide entries:', JSON.stringify(seen.tabs.map(tab => tab.guide)))
console.log('slot bodies:', seen.slots.map(slot => `${slot.options.name}#${slot.options.key}`))
console.log('opened tabs:', seen.opened)
console.log('tab title (zh):', seen.tabs[0]?.title(''))

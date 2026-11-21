// tests/client/views/settings.test.tsx
//
// 设置页三段：规则、执行器、提示词。这里验证结构与文案，交互逻辑由纯函数与
// 网络边界各自覆盖；不引入真实网络或宿主服务。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SettingsView } from '../../../src/shared/settings.ts'
import type { SettingsActions } from '../../../src/client/components/settings/types.ts'
import { SettingsBody } from '../../../src/client/components/settings/SettingsBody.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')

const actions: SettingsActions = {
  savePolicy: async () => undefined,
  saveExecutor: async () => undefined,
  savePrompts: async () => undefined,
  loadPromptRevision: async revision => ({
    revision,
    savedAt: '2026-01-01T00:00:00.000Z',
    source: 'panel',
    parts: 3,
    chars: 30,
    texts: { shared: '共享约定', router: '路由角色', worker: '执行角色' },
  }),
  copyText: async () => true,
  refresh: async () => undefined,
}

function view(overrides: Partial<SettingsView> = {}): SettingsView {
  return {
    revision: 1,
    executor: { maxWorkers: 5, model: null, rootDirectory: null },
    defaultRoot: 'C:\\state\\personal-agent\\work',
    policy: {
      rules: [],
      version: 'abcd1234',
      permissions: [],
    },
    prompts: {
      current: {
        revision: 2,
        savedAt: '2026-01-01T00:00:00.000Z',
        source: 'panel',
        parts: 3,
        chars: 30,
        texts: { shared: '共享约定', router: '路由角色', worker: '执行角色' },
      },
      defaults: { shared: '默认共享', router: '默认路由', worker: '默认执行' },
      history: [
        { revision: 2, savedAt: '2026-01-01T00:00:00.000Z', source: 'panel', parts: 3, chars: 30 },
      ],
    },
    models: {
      default: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
      providers: [
        {
          id: 'deepseek-official',
          name: 'DeepSeek',
          models: [
            { id: 'deepseek-flash', name: 'Flash', reasoning: { efforts: [{ id: 'high', name: 'High' }] } },
          ],
        },
      ],
      failures: [],
    },
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof SettingsBody>> = {}): string {
  return renderToStaticMarkup(
    <SettingsBody
      t={t}
      language="zh"
      view={view()}
      actions={actions}
      onSaved={() => undefined}
      onNotice={() => undefined}
      {...props}
    />,
  )
}

describe('SettingsBody sections', () => {
  it('offers the three sections with the policy tab named after the whole page', () => {
    const html = render()

    expect(html).toContain('策略')
    expect(html).toContain('执行器')
    expect(html).toContain('提示词')
  })

  it('shows the policy version and the empty-rule hint', () => {
    const html = render({ initialSection: 'policy' })

    expect(html).toContain('派单规则')
    expect(html).toContain('策略版本 abcd1234')
    expect(html).toContain('还没有派单规则')
    expect(html).toContain('添加规则')
  })

  it('lists every rule with its name and instruction', () => {
    const base = view()
    const html = render({
      initialSection: 'policy',
      view: view({
        policy: {
          version: 'efgh5678',
          permissions: [],
          rules: [
            { id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true },
            { id: 'rule-b', name: '视觉修正', instruction: '调整间距', enabled: false },
          ],
        },
      }),
    })

    expect(base.policy.rules).toEqual([])
    expect(html).toContain('文案修正')
    expect(html).toContain('修正错别字')
    expect(html).toContain('视觉修正')
    expect(html).toContain('策略版本 efgh5678')
  })

  it('shows the decision-permission card under the same policy version', () => {
    const html = render({
      initialSection: 'policy',
      view: view({
        policy: {
          rules: [],
          version: 'efgh5678',
          permissions: [
            { id: 'rule-c', name: '提交审批', instruction: '改动生产数据前问人', enabled: true },
          ],
        },
      }),
    })

    expect(html).toContain('决策权限')
    expect(html).toContain('添加权限')
    expect(html).toContain('提交审批')
    expect(html).toContain('改动生产数据前问人')
    expect(html.match(/策略版本/g)).toHaveLength(1)
    expect(html).toContain('策略版本 efgh5678')
    expect(html).not.toContain('权限版本')
  })

  it('renders rule rows collapsed with a switch and no editor by default', () => {
    const html = render({
      initialSection: 'policy',
      view: view({
        policy: {
          version: 'efgh5678',
          permissions: [],
          rules: [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }],
        },
      }),
    })

    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('删除规则')
  })

  it('reports an invalid rule name next to the rule', () => {
    const html = render({
      initialSection: 'policy',
      view: view({
        policy: {
          version: 'efgh5678',
          permissions: [],
          rules: [{ id: 'rule-a', name: '  ', instruction: '修正错别字', enabled: true }],
        },
      }),
    })

    expect(html).toContain('规则名称不能为空')
  })
})

describe('executor section', () => {
  it('shows the DSH default, the slot count and the default root', () => {
    const html = render({ initialSection: 'executor' })

    expect(html).toContain('DSH 当前默认：deepseek-official / deepseek-flash · high')
    expect(html).toContain('并行工单数')
    expect(html).toMatch(/value="5"/)
    expect(html).toContain('C:\\state\\personal-agent\\work')
    expect(html).toContain('DeepSeek')
    expect(html).toContain('继承 DSH 默认值')
  })

  it('shows the saved model selected in the catalog dropdowns', () => {
    const html = render({
      initialSection: 'executor',
      view: view({
        executor: {
          maxWorkers: 5,
          model: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
          rootDirectory: null,
        },
      }),
    })

    expect(html).toMatch(/<option value="deepseek-official" selected="">DeepSeek/)
    expect(html).toMatch(/<option value="deepseek-flash" selected="">Flash/)
    expect(html).toMatch(/<option value="high" selected="">High/)
  })

  it('marks a saved model that is no longer in the catalog', () => {
    const html = render({
      initialSection: 'executor',
      view: view({ executor: { maxWorkers: 5, model: { provider: 'ghost', model: 'missing' }, rootDirectory: null } }),
    })

    expect(html).toContain('当前模型目录里没有这个模型')
    expect(html).toContain('ghost')
    expect(html).toContain('missing')
  })

  it('shows an unavailable default when the host reports none', () => {
    const html = render({
      initialSection: 'executor',
      view: view({
        models: {
          default: null,
          providers: [],
          failures: [{ id: 'llm', name: 'LLM', message: '模型服务不可用' }],
        },
      }),
    })

    expect(html).toContain('DSH 当前默认：不可用')
    expect(html).toContain('LLM: 模型服务不可用')
  })
})

describe('prompts section', () => {
  it('edits the shared part by default and shows the saved revision', () => {
    const html = render({ initialSection: 'prompts' })

    expect(html).toContain('共享约定')
    expect(html).toContain('Router 角色')
    expect(html).toContain('Worker 角色')
    expect(html).toContain('共 3 段')
    expect(html).toContain('版本 2')
    expect(html).toContain('共享约定')
  })

  it('shows the full router prompt with copy and compare controls', () => {
    const html = render({ initialSection: 'prompts', initialPromptsTab: 'full' })

    expect(html).toContain('复制全文')
    expect(html).toContain('当前版本')
    expect(html).toContain('与默认比较')
    expect(html).toContain('路由角色')
  })

  it('renders a diff against the defaults when requested', () => {
    const html = render({
      initialSection: 'prompts',
      initialPromptsTab: 'full',
      initialCompare: true,
    })

    expect(html).toContain('<ins>')
    expect(html).toContain('<del>')
    expect(html).toContain('默认共享')
  })

  it('lists saved versions with view and load actions', () => {
    const html = render({ initialSection: 'prompts', initialPromptsTab: 'history' })

    expect(html).toContain('版本 2')
    expect(html).toContain('查看')
    expect(html).toContain('载入编辑器')
    expect(html).toContain('载入编辑器后还需要保存才会生效')
  })

  it('explains an empty history', () => {
    const base = view()
    const html = render({
      initialSection: 'prompts',
      initialPromptsTab: 'history',
      view: view({
        prompts: { ...base.prompts, history: [] },
      }),
    })

    expect(html).toContain('还没有保存过提示词版本')
  })

  it('flags a blank prompt part before saving', () => {
    const base = view()
    const html = render({
      initialSection: 'prompts',
      view: view({
        prompts: {
          ...base.prompts,
          current: { ...base.prompts.current, texts: { shared: '', router: '路由角色', worker: '执行角色' } },
        },
      }),
    })

    expect(html).toContain('共享约定 不能为空')
  })
})


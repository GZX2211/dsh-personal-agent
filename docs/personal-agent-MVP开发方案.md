# DSH Personal Agent — MVP 开发方案

> **版本** v0.1　|　**日期** 2026-11-15　|　**状态** 待评审
>
> 本文件锁定 MVP 的实现契约。`docs/personal-agent-架构设计方案.md` 负责全局蓝图与未来视图，与本文冲突时以本文为准；本文未覆盖的部分回到架构文档。

---

## 0. 文档定位

MVP 只证明一件事：**「确定性事件层 + 两端概率模型」这个形状跑得通**。

所以本协议把三件事钉死：

1. 状态归事件层所有（工单、审批），两端只提交事实；
2. 传输只有两条（工具调用、同源 HTTP），不引入第三种；
3. 所有"中间态"要么被事件表达，要么被显式排除，不留沉默状态。

---

## 1. 目标与验收

### 1.1 MVP 闭环

```
用户发言 → router 会话 → pa_task_route 派发 → 工单入队/放行
  → worker 会话执行 → pa_approval_submit 提交审批并阻塞
  → 总控台出现待审批 → 用户提交决定
  → worker 继续执行 → worker 回合结束 → 工单结束
  → 总控台状态更新
```

### 1.2 验收标准

| # | 场景 | 可观测结果 |
|---|---|---|
| A1 | 用户在 router 会话提出一个可执行任务 | router 调用 `pa_task_route`；总控台工单页 1s 内出现该工单（待处理或进行中） |
| A2 | 执行期间需要人类决策 | worker 调用 `pa_approval_submit`；总控台审批页 1s 内出现待审批卡片；worker 该回合保持阻塞 |
| A3 | 用户在审批卡片选择并提交 | worker 在同一回合内继续执行；审批条目移出"待审批"，进入"已通过" |
| A4 | worker 回合正常结束且无待审批 | 工单自动结束；卡片进入"已结束"，带汇报摘要 |
| A5 | 进程重启后 | 待审批仍在"待审批"列表；点确认 → followup 唤醒 worker，下个回合继续 |
| A6 | 目标 worker 会话已归档时点确认 | 该审批被销毁：不出现在任何胶囊（含"全部"），不产生决策数据 |
| A7 | 派发超过执行槽位 | 工单停留在"待处理"；有槽位释放后按入队顺序自动放行 |
| A8 | 追加给忙碌 worker | 工单停留在"待处理"；该 worker 当前任务结束后自动放行 |
| A9 | 两页搜索 | 输入标题、id 片段、审批正文、时间片段、选项文字均能命中对应卡片 |

### 1.3 非目标（MVP 明确不做）

工单详情页、时间范围筛选、多问题分页器、附件区、概览/事件/来源/设置四个 Tab 的实际内容、桌面通知、管理 worker、决策权限矩阵、外部事件源（GitHub/Webhook）、定时事件、跨进程与多实例、权限档位可视化、工单终止/取消动作。

四个未开放 Tab 的 UI 一律显示"暂未开放 / Not available yet"。

---

## 2. 运行时形状

### 2.1 载体

单 bundle：`dsh-personal-agent`，三面导出。

| 面 | 路径 | 作用 |
|---|---|---|
| Host | `index.js`（`apply(ctx, config)`） | 事件层、调度、会话、工具、HTTP |
| Client | `client.js`（`window.__ModuleLoader__.load`） | 右侧栏 tab 类型与面板 |
| 资源 | `locale/*.json`、`icon.svg`、`docs/DETAIL.md` | Plugin Manager 展示 |

不需要 preset：角色差异用 `agent/created` 上的 `agent.ctx` 装饰（提示词 section + 工具 + 工具裁剪）。原因见 §7.3。

### 2.2 状态目录

`$DSH_HOME/state/personal-agent/`

| 文件/目录 | 用途 |
|---|---|
| `events.jsonl` | L2 事件账本，append-only，一行一事件 |
| `work/<ticketId>/` | 工单默认工作目录（隔离模式 `dir`） |

MVP 不做单实例锁（同一 profile 单进程）。若后续出现双开需求，再引入 PID 锁。

### 2.3 构建与依赖

| 项 | 选择 |
|---|---|
| 构建 | `tsdown`（host ESM + client loader 格式），`tsc --noEmit` 类型检查，`vitest` 测试 |
| 运行时依赖 | `zod`（工具参数校验与 JSON Schema 生成） |
| peerDependencies | `@deepseek-ai/cordis`、`dsh-agent`、`dsh-api-session-controller`、`dsh-session`、`dsh-session-persistence`、`dsh-system-prompt`、`dsh-tools`、`dsh-workspace`、`dsh-host-webserver`、`dsh-client-locale`、`dsh-client-ui-renderer`、`dsh-client-ui-sidebar`、`dsh-client-ui-layout`，版本锁 `^0.2.2-rc.1`（运行版本 0.2.2-rc.3） |
| 运行要求 | `ctx.webServer.host === '127.0.0.1'`（同源 HTTP 前提），非回环时插件拒绝激活并给出可行动错误 |

### 2.4 权限与沙箱

MVP **不显式设置** worker 与 router 的权限档位，跟随 profile 默认（当前 `danger-full-access`）。

理由：若降到 `workspace-write`，沙箱升级请求会弹在 worker 自己的会话里，而总控台看不见 → worker 卡死；这比"无沙箱"更难排查。安全网改为：**工单目录 + 审批门禁 + 提示词纪律 + 会话日志可回溯**。

该取舍在 §14 记为显式风险，后续由"决策权限矩阵"统一解决。

---

## 3. 数据模型（L2）

### 3.1 事件类型

| type | 生产者 | 语义 |
|---|---|---|
| `signal/received` | trigger | 一次到达 router 的触发（含被过滤的） |
| `decision/recorded` | router 工具 / 推断 | router 的处理决定 |
| `task/queued` | `pa_task_route` | 工单入队（**未分配会话**） |
| `task/dispatched` | dispatcher | 工单放行，绑定 worker 会话 |
| `task/reported` | 回合结束观察 | worker 汇报 |
| `task/closed` | 规则 | 工单结束 |
| `approval/pending` | `pa_approval_submit` | 审批已提交 |
| `approval/decided` | console api | 人已决定，且**已送达** |
| `approval/discarded` | console api | 审批作废（worker 已归档），不携带决策数据 |

审批没有"已决定未送达"事件——这个窗口只存在于一次函数调用期间，见 §6.3。

### 3.2 通用字段

```ts
interface L2Event {
  seq: number            // 账本单调递增
  eventId: string        // sha256(type+correlationId+关键字段+causationId) 前 32 位，唯一
  type: string
  time: number           // epoch ms
  actor: 'router' | 'worker' | 'human' | 'system'
  correlationId: string  // 一次用户请求或一次工单域的串联键
  causationId?: string   // 父事件 eventId
  sessionId?: string     // 产生该事件的会话
  policyVersion?: string // 预留：决策权限矩阵版本
  l1Ref?: { sessionId: string; seq: number } // 预留：反查 L1
  payload: object
}
```

### 3.3 append 协议

1. 全部写入收敛到 `EventStore.append(event)` 一个方法：分配 `seq` → 同步 `fsync` 写 `events.jsonl` → 更新内存投影 → 通知订阅者。
2. 业务事件只增不改；唯一允许改写的是技术元数据（MVP 无）。
3. **先存后做**：任何外部副作用（建会话、投递、resolve）必须在 append 之后。**审批决定是唯一例外，见 §6.3**。
4. 启动时重放 `events.jsonl` 重建投影；文件尾部不完整行（断电）跳过并记警告。

### 3.4 投影

| 投影 | 派生 |
|---|---|
| Ticket | 按 `ticketId` 分组取最后事件；阶段由 §5.1 的表计算 |
| Approval | 按 `approvalId` 分组；`discarded` 的条目从所有对外列表剔除 |
| Stats | 各阶段计数、待审批数（供 tab 徽标） |

投影是纯函数 `project(events) → { tickets, approvals }`，输入即全部事实，无环境读取。

---

## 4. 触发与记账

### 4.1 输入事件类型（到达 router 的所有事件）

| kind | 来源 | MVP 是否唤醒 router |
|---|---|---|
| `user-message` | router 会话的用户消息 | 是（DSH 原生） |
| `worker-reply` | worker 回合结束 / 汇报 | 否（默认过滤） |
| `trigger` | 外部触发（未来 Source） | 无来源，规则已就位 |
| `timer` | 定时（未来 schedule） | 无来源，规则已就位 |

### 4.2 过滤

过滤是**声明式规则表**（MVP 只有一条默认规则），命中即 `delivered:false`：

```ts
{ kind: 'worker-reply', rule: 'default-silent', delivered: false }
```

被过滤的事件**照样写 `signal/received`**，只是不投递、不唤醒 router。规则表放 Config，后续接外部 Source 时按 sourceId 扩展。

### 4.3 每次 router 触发都记录

- 用户消息在 router 会话里出现 → 立即写 `signal/received{kind:'user-message', delivered:true}`；
- router 回合结束时，若本次触发没有产生路由工具调用 → 由系统补一条 `decision/recorded{action:'reply', inferred:true}`。

于是账本对每次触发都有"进来了什么 + router 怎么处理"两条事实。

### 4.4 router 的四种输出

| action | 来源 |
|---|---|
| `dispatch` | `pa_task_route{action:'dispatch'}` |
| `append` | `pa_task_route{action:'append'}` |
| `reply` | 盘后推断（无工具调用） |
| `ignore` | 过滤命中时由 trigger 写 `decision/recorded{action:'ignore'}` |

---

## 5. 工单状态与调度

### 5.1 派生阶段

工单**没有 status 字段**，阶段由事件序列计算：

| 阶段 | 胶囊 | 判定 |
|---|---|---|
| 待处理 `queued` | 待处理 | 最后一条 `task/queued`，无 `task/dispatched` |
| 进行中 `running` | 进行中 | 有 `task/dispatched` 且无 `task/closed`，且无未决审批 |
| 进行中·阻塞中 `blocked` | 进行中（副标签"阻塞中"） | 有 `approval/pending` 且无对应 `approval/decided`/`discarded` |
| 已结束 `ended` | 已结束 | 有 `task/closed` |

结束原因 `outcome`：`completed`（回合正常结束）/ `failed`（回合以错误结束）。

### 5.2 "待处理"从哪来

Router 派发**不受并发约束**，一律先入队（写 `task/queued`），由宿主决定何时放行：

| 入队情况 | 放行条件 |
|---|---|
| `dispatch`（新 worker） | 存在空闲执行槽位 |
| `append`（旧 worker） | 目标 worker 空闲 **且** 存在空闲执行槽位 |

目标 worker 忙碌、或槽位已满 → 停在待处理，这就是"排队"。

### 5.3 执行槽位

- **槽位 = 处于进行中（含阻塞中）的工单数**，上限 `maxWorkers`，默认 **5**。
- 放在插件 Config（`maxWorkers: 5`），MVP 不提供修改 UI。
- 待处理工单不占槽位；工单结束释放槽位。
- 放行顺序：先消化 `append`（不新开会话），再开 `dispatch`（FIFO 入队序）。同一 worker 的追加也按入队序。

> 说明：一个 worker 同时只允许一个进行中工单，所以"槽位数 ≤ 并发 worker 数"始终成立；这条解释覆盖了"追加到闲置 worker"的情况，避免绕过上限。

### 5.4 调度器

纯函数 + 副作用分离：

```ts
planDispatch(queue: QueuedTicket[], workers: WorkerState[], capacity: number) → Action[]
// Action = { kind: 'start-append', ticketId, sessionId }
//        | { kind: 'start-dispatch', ticketId }
```

触发时机（每次触发都跑一遍，重入保护用 `scheduling` 标志 + 尾部重跑）：

1. `task/queued` 写入后；
2. 任一 worker 的 `turn/end`；
3. 工单结束释放槽位后；
4. worker 会话被归档/销毁后；
5. 插件启动完成、重放投影后。

放行动作：`dispatch` → 建 worker 会话 → 写 `task/dispatched` → 投递任务简报；`append` → 写 `task/dispatched` → 投递追加简报。

### 5.5 排队时的界面

待处理卡片显示"排队中"与原因（`worker-busy` / `capacity-full`）。工单此时**没有 worker 会话**，卡片不提供跳转。

---

## 6. 审批生命周期

### 6.1 两态

| 状态 | 胶囊 | 判定 |
|---|---|---|
| 待审批 | 待审批 | 有 `approval/pending`，无 `decided` / `discarded` |
| 已通过 | 已通过 | 有 `approval/decided`（含"跳过"决定） |
| （作废） | 不展示 | 有 `approval/discarded` |

"全部" = 待审批 + 已通过。**不包含作废条目**。

### 6.2 确认时的三支路

用户点击确认（含跳过）时，按顺序执行：

```
1. 读 pending（不存在或已决 → 返回 already-decided/not-found，不重复处理）
2. 解析目标 worker：
   a. 会话已归档（archived）        → append approval/discarded{reason:'worker-archived'} → 结束
   b. 该审批持有活的阻塞 resolver   → resolve(决定)，等待工具侧确认已返回 → transport = 'inline'
   c. 否则（agent 存在但已停止）     → followup 投递送达消息（requestId = pa-approval-delivery:<approvalId>）
                                      → transport = 'followup'
3. 送达成功后 append approval/decided{..., transport}
4. 任一步失败 → 不写 decided → 返回错误 → 条目回退为待审批
```

顺序是**先送达、后记账**，这是"点确认时崩溃 → 回退待审批"成立的前提。

"跳过"：以 `{ kind: 'skipped' }` 送达，语义为"由 worker 自行决定或放弃该动作"，同样写入 `approval/decided`，归入"已通过"胶囊。

### 6.3 失败与回退

| 情况 | 行为 |
|---|---|
| 送达抛错（会话不存在/投递被拒） | 不写 decided；返回稳定错误码；条目仍为待审批；UI toast 说明原因 |
| 处理过程中进程崩溃 | decided 未写入 → 重启后是待审批（唯一脏窗口见下） |
| 用户重复点击 | 第二次读到已决 → `already-decided`，不重复送达 |
| worker 在等审批期间被用户停止回合 | resolver 失效；此时点确认走 followup 支路 |

**唯一脏窗口**：inline 支路已 resolve、decided 未落盘时崩溃。重启后该审批是待审批，但 worker 已收到决定。启动自愈（§6.4）负责收敛；即使关掉自愈，重复赠送一次决定也不会破坏工单正确性，属可接受极端情况。

### 6.4 启动自愈（可选，建议保留）

启动时为每条 pending 审批做一次只读检查：

1. 若 worker 会话日志中存在该工具调用的 `tool/result` → 说明 inline 已送达 → 补写 `approval/decided{recovered:true}`；
2. 否则保持待审批。

只读、只处理 pending、不影响正常路径；失败只记日志不阻断启动。

### 6.5 送达消息模板

投递给 worker 的消息必须是"自解释"的，因为原工具调用已随中断结束、结果未知：

```
[审批结果] 审批 <approvalId>（工单 <ticketId>）已有决定。

决定：<选项标签>（option <index>）      ← 或：跳过（由你自行决定或放弃该动作）
补充说明：<note>
填写字段：
- <label>: <value>

提醒：你先前提交该审批的工具调用已结束（若期间进程重启，其结果为"未知"）。
请据此继续；若该决定不足以继续，请再次提交审批。
```

投递实现：`freezeMessage` + `agent.followup()` + `sessionPersistence.flush()`；`requestId` 固定为 `pa-approval-delivery:<approvalId>`，重复投递由会话侧 messageId 去重。

---

## 7. 会话管理

### 7.1 router 会话

- 首次启动：`workspaceRegistry.create(<userRoot>)` → `sessionController.create({ sessionId, workspaceId })` → `workspaceRegistry.pinSession(id)` → `rename('Personal Agent · Router')`。
- 会话 id 持久化在账本 `kv`（技术元数据，允许改写）。
- **置顶**：`pinSession` 让它在左栏固定区显示；插件启动时若发现被取消置顶则恢复。
- 不强制角色模型（跟随用户默认模型）。

### 7.2 worker 会话

- 放行时才创建：`sessionController.create({ sessionId: worker-<ticketId 短码>, workspaceId: workerWorkspaceId })`；
- 标题：`<标题> · 工单 #<短码>`（名称在前：左栏宽度有限，先看到的是这一单要做什么）；
- 工作目录：`workingDirectory.set(agent, <state>/work/<ticketId>)`（未指定 `cwd` 时），目录在投递前创建；
- 会话归属：独立工作区"Personal Agent 工单"，不与用户自己的工作区混排；
- 追加复用：不新建会话，只投递新简报。

### 7.3 角色装饰（`agent/created`）

对属于本插件的会话（router id / worker id 命中账本）注册到 `agent.ctx`：

| 角色 | 提示词 section | 工具 |
|---|---|---|
| router | 角色、派发/追加/回复/忽略的判定标准、`pa_task_route` 用法、账本查询 | `pa_task_route`、`pa_ledger_query` |
| worker | 角色、简报约定、**需要人类输入必须用 `pa_approval_submit`**、结束时报汇报 | `pa_approval_submit` |

并 `ctx.tools.restrict()` 裁掉不相干工具（router 不给文件写/命令；worker 不给派发）。装饰是幂等的，`agent/created` 在恢复时也会重新执行。

> 为什么不用 preset：preset 要在 patch 里复制一遍 `standard` 的全量插件清单，DSH 升级必漂移，且会在用户的新会话预设选择器里多出"不供手动选择"的条目。需要"用户手动新建带角色会话"时再升级为 preset，不影响现有代码。

### 7.4 恢复

- 启动重放账本 → 恢复 router / worker id；
- `sessionController.resolveAgent(id)` 拿到活会话（必要时 `resume`）；
- 待审批保持（§6.4）；
- 待处理工单继续排队（§5.4 第 5 条触发）；
- 进行中、但 worker 回合已随重启中断的工单：不特殊处理，等待下一次投递（审批结果）或用户干预。

---

## 8. 工具契约

### 8.1 `pa_task_route`（router）

| 参数 | 类型 | 说明 |
|---|---|---|
| `action` | `'dispatch' \| 'append'` | 派新 worker / 追加旧 worker |
| `title` | string（≤40 字） | 工单标题，账本与卡片展示 |
| `goal` | string | 整理后的任务目标（不含闲聊） |
| `context` | string? | 背景与用户原话摘录 |
| `constraints` | string[]? | 约束与禁止事项 |
| `expectedOutput` | string? | 验收标准 |
| `workerSessionId` | string? | `append` 必填 |
| `cwd` | string? | 工单目录（默认 `<state>/work/<ticketId>`） |

返回：`{ ticketId, status: 'queued' | 'running', sessionId?, queueReason? }`。

失败码：`invalid-append-target`（workerSessionId 不存在/不是 worker）、`invalid-directory`。

副作用：写 `signal` 无关，写 `task/queued` → 调度；**不建会话**（放行时才建），所以工具总是快速返回。

### 8.2 `pa_approval_submit`（worker）

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | string（≤40 字） | 一句话：要批准什么 |
| `question` | string | 详细说明：背景、每个选项的含义与后果 |
| `options` | `{label, description}[]`（2–4） | 选项；标签两字以内最佳 |
| `fields` | `{key,label,type,required?}[]`? | 需人填写的字段（text/textarea/number/boolean） |
| `risk` | `'low'\|'medium'\|'high'`? | 供审批页排序与视觉强调 |
| `ticketId` | string? | 缺省取当前会话绑定的进行中工单 |

返回：`{ approvalId, decision: {kind:'selected',index,label} | {kind:'skipped'}, note?, fields?, decidedAt }`。

语义：**阻塞**直到有人决定（不声明 `timeoutMs`，因此不受超时策略裁剪）。进程重启导致的阻塞中止不算失败——决定会以 followup 送达。

失败码：`no-active-ticket`、`invalid-options`、`approval-cancelled`（回合被中止）。

### 8.3 `pa_ledger_query`（router，只读）

| 参数 | 类型 | 说明 |
|---|---|---|
| `scope` | `'tickets' \| 'approvals' \| 'both'` | 查询范围 |
| `filter` | `'active' \| 'ended' \| 'all'` | 阶段过滤 |
| `limit` | number? | 默认 10，上限 50 |

返回紧凑文本（不是 JSON 大对象），供 router 回答"做到哪了"。无副作用。

---

## 9. 客户端通道

### 9.1 路由表（同源，前缀 `/personal-agent/api`）

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/health` | — | `{ ok, version, port }` |
| GET | `/snapshot` | — | `{ tickets: TicketView[], approvals: ApprovalView[], stats }` |
| POST | `/approvals/:id/decide` | `{ kind:'selected', index } \| { kind:'skipped' }, note?, fields? }` | `{ ok:true, transport }` 或 `{ ok:false, code, message }` |

校验：仅回环 + 同源（`Origin`/`Referer` 与 `ctx.webServer.port` 比对）+ 自定义头 `x-personal-agent-request: 1`（拒绝简单表单式跨站请求）。

### 9.2 视图字段

`TicketView`：`id, shortId, title, stage('queued'|'running'|'blocked'|'ended'), queueReason?, goal, workerSessionId?, directory?, createdAt, updatedAt, endedAt?, outcome?, report?`

`ApprovalView`：`id, ticketId, title, question, options[], fields[], risk?, requestedBySessionId, createdAt, decidedAt?, decision?{kind,index,label,note,fields,transport}`

作废的审批不出现在任何响应里。

### 9.3 刷新策略

面板可见时每 2s 拉 `/snapshot`；提交决定后立即刷新；面板不可见时停止轮询；失败退避到 10s 并在 UI 顶部显示连接状态。MVP 不上 SSE。

### 9.4 错误语义

服务端返回稳定错误码（`already-decided`、`not-found`、`worker-archived`、`delivery-failed`、`not-blocked`），客户端按码显示对应文案，不吞错、不只显示通用文案。

---

## 10. UI

### 10.1 入口

| 入口 | 实现 |
|---|---|
| 右侧栏 tab 类型 | `ctx.sidebarRightTabs.register({ id:'dsh-personal-agent/console', kind:'personal-agent-console', title, guide })` |
| 面板内容 | `ctx.slots.register({ name:'sidebar.right.pane.tab', key:'dsh-personal-agent/console' })` |
| 会话头部按钮 | 展开/收起面板；审批待决数徽标 |
| 指南卡片 | 右侧栏 guide 中的"总控台"卡片，点击打开 |

### 10.2 布局

```
Tabs: 概览(暂未开放) | 审批 [徽标] | 工单 | 事件(暂未开放) | 来源(暂未开放) | 设置(暂未开放)
FilterBar（固定）: [胶囊组] ……… [搜索框]
ListView（滚动，无滚动条）: 卡片列表
```

六个 Tab 全部渲染，未实现的四个显示"暂未开放"。视觉沿用宿主 `--dsw-alias-*` token，不引用内部组件包。

### 10.3 审批页

- 胶囊：**待审批 / 已通过 / 全部**（默认待审批）。
- 卡片：折叠态（发起者 · 关联工单 · 相对时间 + 一句话预览）/ 展开态（题干、选项列表、输入框、可填字段、跳过 + 提交）；同时只展开一张。
- 只读态：已通过的卡片不可再提交，显示决定内容与时间。
- 无分页器（MVP 单问题单页）。

### 10.4 工单页

- 胶囊：**待处理 / 进行中 / 已结束 / 全部**（默认待处理）。
- 卡片（仅简略信息，不可展开）：

```
[阶段徽标]  工单标题                      相对时间
#短码 · 发起者 router · worker 会话名
一句话目标（或结束时的汇报摘要）
[副标签: 阻塞中]  或  [排队中: 名额已满]
```

- 不提供详情页入口（MVP）；不做点击跳转。

### 10.5 搜索

两页共用同一搜索组件与算法：

- 对每条记录构造 haystack = 全部业务字段值的拼接（标题、目标、背景、约束、验收、汇报、审批标题/题干/选项标签与说明/备注、可填字段值、工单短码与完整 id、目录路径、会话名、绝对时间与相对时间文本）；
- 小写化后子串匹配；多关键词以空格分词，全部命中才显示（AND）；
- 搜索与胶囊过滤是交集关系；
- 空查询 = 不过滤。

### 10.6 文案

所有用户可见文字走 `src/client/i18n.ts` 词典（zh / en 同步新增），禁止组件内硬编码。

---

## 11. 竞态与故障矩阵

| 场景 | 期望行为 | 记录 |
|---|---|---|
| 双击提交审批 | 第二次得 `already-decided` | 无新事件 |
| 两个浏览器页同时决定 | 后者得 `already-decided` | 无新事件 |
| 决定后 worker 已归档 | 审批销毁 | `approval/discarded` |
| 决定送达失败 | 条目回退待审批 + 报错 | 仅日志 |
| 点击确认时崩溃 | 重启后该审批仍是待审批 | 无 decided |
| 派发时无槽位 | 工单待处理 | `task/queued{queueReason:'capacity-full'}` |
| 追加时 worker 忙 | 工单待处理 | `task/queued{queueReason:'worker-busy'}` |
| 工单结束瞬间又有入队 | 调度器尾部重跑消化新队列 | — |
| worker 回合以错误结束 | 工单结束并标 `failed` | `task/reported{status:'failed'}` + `task/closed` |
| 账本尾部半行（断电） | 跳过该行，记警告，继续启动 | 日志 |
| 审批 pending 时 worker 回合被手动停止 | resolver 失效，后续确认走 followup | 无新事件 |
| 重启后 pending 但 worker 已执行结束 | 保持待审批，等用户决定后再投递 | 无新事件 |

---

## 12. 模块边界与目录

```
src/shared/            纯契约（无运行时 import）
  events.ts            L2 事件类型与 payload
  tickets.ts           阶段与视图类型
  approvals.ts         审批类型
  api.ts               HTTP 路由与请求/响应类型

src/host/
  index.ts             插件入口（装配、Config、生命周期）
  store/               EventStore（jsonl append + 内存投影 + 重放）
  projector/           project(events) 纯函数
  trigger/             触发记录与过滤规则
  dispatcher/          planDispatch 纯函数 + 执行器
  sessions/            会话创建、装饰、投递（followup/freezeMessage）
  approvals/           审批生命周期、送达、启动自愈
  console-api/         HTTP 路由与校验
  tools/               
    infrastructure/    注册器、schema→JSON Schema、输出渲染
    pa_task_route/     入队与调度
    pa_approval_submit/ 提交并阻塞
    pa_ledger_query/   只读查询
  prompts/             router.md / worker.md + 拼装

src/client/
  entry.ts             tab 类型 + 指南卡片 + 头部按钮
  panel/               面板容器、Tab 切换
  views/               Console(审批页) / Tickets(工单页) / Placeholder(暂未开放)
  components/          FilterBar、Segmented、SearchInput、ApprovalCard、TicketCard
  hooks/               useSnapshot（轮询）、useFilters
  lib/                 http.ts（唯一网络边界）、filter.ts（haystack 搜索纯函数）
  i18n.ts / style.ts

tests/                 镜像 src（host/shared/client）+ integration
```

依赖方向：`client → shared`、`host → shared`；host 内部 `tools → 服务`，工具之间不互相调用。

---

## 13. 分期与验收

### P0 冒烟（先验证再写业务）

| 项 | 通过标准 |
|---|---|
| P0-1 | 右侧栏出现"总控台"tab，能打开、渲染、切 Tab |
| P0-2 | 同源 `GET /personal-agent/api/health` 返回 200 |
| P0-3 | 工具可长时间阻塞且不被超时策略裁剪；重启后中断收尾正常 |
| P0-4 | `pinSession` 让 router 会话出现在左栏固定区 |
| P0-5 | 建 worker 会话 + `followup` 投递 + `rename` 全部生效 |

### P1 数据层

EventStore（append/重放/幂等）+ projector + 单元测试；故障注入（半行、重复 eventId）。

### P2 工具与会话

`pa_task_route`（入队）+ dispatcher + 会话创建与投递；`pa_approval_submit`（阻塞）+ 审批三支路；启动自愈。

### P3 UI

审批页（三胶囊、卡片、提交）→ 工单页（四胶囊、简略卡片）→ 搜索 → 头部按钮与徽标 → i18n 补全。

### P4 联调

按 §1.2 的 A1–A9 逐条走查；记录通过/未通过与证据；修正后再验收一次。

---

## 14. 风险与后续

| 风险 | 影响 | 处理 |
|---|---|---|
| worker 跟随 `danger-full-access` | 无文件系统保护，只能靠审批与提示词 | MVP 显式接受；后续接决策权限矩阵 |
| 右侧栏 tab 注册细节未实测 | 面板无法显示 | P0-1 先验证，失败则降级为左栏面板（已验证方案） |
| 阻塞工具与回合生命周期耦合 | 长时间运行状态、用户手动停止 | 已由 followup 支路覆盖；P0-3 验证 |
| 迁移到 preset 的时机 | 角色能力分散在两处 | 仅当需要"用户手动新建角色会话"时迁移 |
| 单实例假设 | 双开会写坏账本 | 暂不加锁，文档标注 |

后续路线（不在 MVP）：工单详情页、时间范围筛选、事件/来源/设置 Tab、管理 worker（agent-team）、决策权限矩阵、外部 Source、定时事件、SSE、工单终止。

---

## 15. P0 复核后的修订

P0 冒烟（见 `docs/personal-agent-P0验收报告.md`）实测后，本文以下条款按实际运行时行为修订，其余条款不变。

### 15.1 §7.2 执行会话的工作目录

`sessionController.create` 不接受 `workspaceId` 与 `cwd` 同时给出，因此改为：

1. 在工作区「个人代理 · 工单」内建会话（目录默认为工作区路径）；
2. `resolveAgent` 取得活 Agent；
3. `workingDirectory.set(agent, <state>/work/<ticketId>)` 把目录收窄到本工单。

代价是会话日志里固定出现一条 `working-directory/change` 事件与一条 `working-directory` 来源的 user 消息。这是 DSH 的既定语义：目录变更本身就是一次模型可见、可回溯的变更。

### 15.2 §2.3 运行时依赖

P0 实测：插件产物可以在宿主进程内 `import('@deepseek-ai/dsh-llm')` / `dsh-tools` 成功（分别拿到 68、25 个导出）。因此：

- P2 起直接复用 `freezeMessage`、`MessageId` 等运行时工具，不再自行实现消息深冻结；
- 插件对 DSH 的依赖从"仅类型"变成"类型 + 运行时"，`engines.dsh` 与 peer 版本范围必须继续跟着运行版本锁，DSH 升级时按 `references/upgrading.md` 复核。

### 15.3 §7.1 路由会话的工作区目录

MVP 先用**状态目录本身**（`$DSH_HOME/state/personal-agent`）：路由会话不占用户既有工作区、不在用户目录留痕。方案原文写的是"用户根目录"，两种取舍的差异是"路由会话能否直接读到用户项目文件"。

**仍待定**：若你希望路由会话能直接看用户项目，改成用户根目录只需换一个 `workspaceRegistry.create(path)` 的入参，但会在用户既有工作区里多出一个会话。MVP 期间默认保持状态目录。

### 15.4 开发节奏

- Host 半区改动：`pnpm build` 后用 `plugin_manager set_plugin`（同一 entryId 关→开）触发重载，新代码即生效，无需重启。
- Client 半区改动：构建后需要**刷新页面**才会加载新产物（没有 `dev:web` 重建推送时，图更新不保证重放）。
- 每次改动后 CLI 侧可先用 `collab/scr/check-*.mjs` 的伪 ctx 冒烟，再进真实宿主。

---

## 附录 A　决策记录

| # | 决策 | 结论 |
|---|---|---|
| 1 | 工单与会话关系 | 一工单 = 一次可结束任务；追加 = 复用旧会话开新工单 |
| 2 | worker 结束判定 | 回合结束且无待审批即结束（规则派生） |
| 3 | 是否唤醒 router | MVP 不唤醒，只记账 + 总控台可见 |
| 4 | 审批"跳过"语义 | worker 自行决定或放弃；归入"已通过" |
| 5 | 右侧栏入口 | tab 类型 + 指南卡片 + 会话头部按钮 + 徽标 |
| 6 | worker 会话归属 | 独立工作区 + 每工单子目录 |
| 7 | 账本查询工具 | 包含只读 `pa_ledger_query` |
| 8 | 命名 | 包名 `dsh-personal-agent`；工具前缀 `pa_` |
| 9 | 重启后的未决审批 | 不作废；确认时按状态分支送达（inline / followup / 销毁） |
| 10 | 审批状态数 | 两态（待审批 / 已通过），不设中间态；先送达后记账 |
| 11 | 工单胶囊 | 待处理 / 进行中 / 已结束 / 全部；阻塞中为进行中副标签 |
| 12 | 工单卡片 | 仅简略信息，无折叠展开，无详情页 |
| 13 | 待处理来源 | Router 不感知并发，入队即待处理，由调度器放行 |
| 14 | 搜索范围 | 每条记录的全部业务字段 |
| 15 | 文档双语 | 开发期仅中文，后期统一补 `.en.md`；UI 文案仍双语 |

---

## 16. P2 实施修订（P2 完成后追加，不改动上文）

本节记录 P2（工具与会话）实施中与上文不同的决定与新增契约。上文条款继续有效，冲突处按本节执行。

### 16.1 提示词改为随包分发的 `prompts/*.md`（修订 §12）

`src/host/prompts/` **不再**存放提示词正文；改为仓库根 `prompts/{shared,router,worker}.md`，并在 `package.json` 的 `files` 中随包分发。加载器从模块位置向上找到包根后读取，源码运行与 `lib/` 产物运行走同一条路径（与 SuperAgent 的做法一致）。

书写约定：一句一行，便于 diff；同段各行拼接时中文不插空格、拉丁句末补空格；空行保留为段落。后续要做提示词覆盖与版本记录时，内置文本始终是基线，用户只存增量。

### 16.2 新增 `task/interrupted` 与 `task/resumed` 事件（修订 §3.1、§5.1、§11）

`turn/end` 的 `aborted`（用户停止）与 `interrupted`（重启合成收尾）现在会记账，而不是"无新事件"：

| type | payload | 语义 |
|---|---|---|
| `task/interrupted` | `{ ticketId, turn, reason: 'turn-aborted' \| 'turn-interrupted' }` | worker 回合没跑完，工单仍进行中 |
| `task/resumed` | `{ ticketId, turn }` | 下一次 `turn/start`，中断状态解除 |

投影在 `TicketView` 增加 `interrupted?: boolean`，**仅在进行中时可见**，作为副标签（与"阻塞中"同级），不新增胶囊、不改变槽位账（仍占执行槽位）。`task/dispatched`、`task/reported`、`task/closed`、`approval/decided` 均清除中断；有待审批时 `blocked` 优先，不写中断事件。

### 16.3 汇报摘要取会话日志（细化 §3.1）

`task/reported.summary` 取 worker 回合最后一条**非中断**的 `assistant/message` 文本，截断到 200 字；没有文本就不写 `task/reported`，只写 `task/closed`。不新增汇报工具。

### 16.4 `turn/end` 原因映射（细化 §5.1、§11）

| 原因 | 处理 |
|---|---|
| `completed` | `task/reported{status:'done'}`（有文本时）+ `task/closed{outcome:'completed'}` |
| `error` / `max-tokens` | `task/closed{outcome:'failed'}`（有文本时先写 failed 汇报） |
| `aborted` / `interrupted` | `task/interrupted`，工单保持进行中 |
| `blocked` / `forked` | 只记日志，不写工单事实 |

有未决审批时回合结束不关闭工单（保持阻塞，等决定）。

### 16.5 新增运行时依赖 `@deepseek-ai/dsh-system-prompt`（补充 §2.3）

角色装饰用 `ctx.systemPrompt.section()` 注册提示词；该包加入 peerDependencies（`^0.2.2-rc.1`）与 devDependencies（`0.2.2-rc.3`）。`inject` 同时声明 `systemPrompt`。

### 16.6 技术元数据落到 `kv.json`（细化 §2.2、§7.1）

新增状态文件 `<state>/kv.json`（允许改写的技术元数据侧车，原子替换、损坏降级并告警）。router 会话身份存在键 `router.session`；P1 的 `router-session.json` 在启动时迁移后删除。

### 16.7 调度器执行语义（细化 §5.4）

- 每轮只执行计划中的第一个动作，成功后再重新计算；失败即停并留待下一次触发（不在一轮里跳过失败项）。
- 触发点：`task/queued` 后、任一 worker `turn/end`、工单结束、插件启动重放后。
- 重入用"进行中标记 + 尾部重跑"，不并行开两轮。
- 追加在写 `task/dispatched` **之前**校验目标会话仍有活 Agent；没有则不写放行事实，工单留在待处理。

### 16.8 决定端点的响应与错误码（细化 §9.4）

`POST /personal-agent/api/approvals/:id/decide` 的失败码与 HTTP 状态：

| code | 状态 | 含义 |
|---|---|---|
| `not-found` | 404 | 审批不存在或已作废 |
| `already-decided` | 409 | 已处理过，不重复送达 |
| `worker-archived` | 409 | 目标会话已归档：已写 `approval/discarded`，不产生决策 |
| `delivery-failed` | 502 | 送达失败：不写 `approval/decided`，条目回退待审批 |
| `invalid-decision` | 400 | 选项下标/必填字段/结构不合法（新增码） |

成功响应 `{ ok: true, transport: 'inline' | 'followup' }`。

### 16.9 工具结果携带决定，供启动自愈使用（细化 §6.4）

`pa_approval_submit` 的 `presentationMeta` 把 `{ approvalId, decision, decidedAt }` 持久化进 `tool/result.meta`。启动自愈只读 worker 会话日志，按 `approvalId` 找到该 meta 后补写 `approval/decided{recovered:true, transport:'inline'}`；找不到或形状不合法就保持待审批，不猜。

### 16.10 仍留给 P3 的 UI 事项

`interrupted` 副标签、审批/工单卡片、三/四胶囊过滤、搜索、徽标与轮询均未在本期实现；`/snapshot` 已提供所需字段（含 `context/constraints/expectedOutput` 与 `interrupted`）。

### 16.11 装饰时序修复（P2 验收发现）

**问题**：worker agent 在 `task/dispatched` 写入之前就由 `sessionController.create` 创建并发布 `agent/created`。`agent/created` 监听器按账本判断角色时，工单还没有绑定该会话，于是 worker 的提示词 section 与 `pa_approval_submit` 都没有装上；router 因为在身份已知后显式补装饰而不受影响。

**修复**：

1. 放行事实写入之后、简报投递之前调用 `onWorkerReady(sessionId)`：解析活 agent 并补装饰，保证 worker 第一步就能看到自己的提示词与审批工具；
2. 插件重载时对仍存活的 worker agent 按账本绑定补装饰（`decorateLiveWorkerSessions`，只读 `ctx.agents.list()`，不唤醒冷会话）。

**回归证据**：`tests/integration/ticket-flow.test.ts` 模拟「create 即发布 agent/created」的真实时序并断言 worker 在简报投递前已具备工具与 section；`collab/scr/check-host.mjs` 第 18–20 项用构建产物复现同一路径。

### 16.12 同源守卫补充 Sec-Fetch-Site（P3 联调发现）

同源 GET 的 `fetch` 不带 `Origin`，宿主页面又可能因 `Referrer-Policy` 去掉 `Referer`，原守卫会误拒浏览器请求。现在 `Sec-Fetch-Site: same-origin` 作为第三种同源证据被接受（脚本不可伪造）；`cross-site` 仍拒绝。见 `src/host/console-api/guard.ts`。

### 16.13 桌面端转发请求被守卫误拒（P3 联调修复）

**问题**：Desktop 在 `dsh-app://app` 下渲染页面，非静态路径的请求由主进程转发给 Host；转发会删除 `origin`、`cookie`、`sec-fetch-site` 并注入 Host 认证 cookie。到达 `/personal-agent/api` 的请求因此没有任何同源证据，守卫按「三者缺席即拒绝」返回 403，面板显示「连接中断」。§16.12 的 Sec-Fetch-Site 证据在转发链路上已被剥离，所以补它并不能修复该问题。

**行为变化**：旧——三项证据全缺席即拒绝；新——只拒绝**明确存在且不合格**的证据，三项全缺席放行，并接受 `dsh-app://app` 作为 Referer 来源。原因见上；影响范围仅限 `guardRequest`。

**安全边界不变**：浏览器跨站请求必带 `Origin`（CORS 模式）或 `Sec-Fetch-Site`（简单请求），二者都会命中拒绝分支；自定义头仍会触发预检，而本端点不返回 CORS 头。非浏览器客户端本就能伪造 Origin，不构成新增暴露面。

**证据**：`tests/host/console-api/guard.test.ts` 16 项（新增桌面 referer、`dsh-app://app2` 前缀伪装、opaque `null` origin、桌面前缀伪装）；`collab/scr/check-host.mjs` 新增桌面转发与桌面 referer 两项（共 23 项）；真实宿主以「仅自定义头」请求 `/snapshot` 得 200，外来 Origin 与 `cross-site` 仍 403。

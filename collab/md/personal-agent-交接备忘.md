# dsh-personal-agent 交接备忘

> 自包含交接文档：不依赖任何对话上下文，读完即可继续开发。
> 状态：**P3 UI 已交付（0.3.0）**（2026-11-15），审批/工单两页按官方提问卡样式重做；待用户在 GUI 目检样式。
> 本文属临时协作文档（`collab/md/`），不进 `docs/`，不需要英文版。

---

## 0. 一句话现状

`dsh-personal-agent` 已安装到 `desktop` profile 并运行（0.3.0）：右侧栏「总控台」有审批页与工单页，卡片外观逐条移植官方 `ask_user_question` 提问卡，只有卡顶（发起者/关联工单/时间）与卡底（附件行）是本插件新增；过滤条有胶囊、搜索与帮助浮层，审批标签带待审批数。样式待用户目检，功能链路（派发→审批→决定→汇报→关闭）沿用 P2 已验证的实现。

---

## 1. 环境事实

| 项 | 值 |
|---|---|
| 仓库 | `D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent` |
| DSH 运行版本 | 0.2.2-rc.3（Desktop：`D:\dsh\resources\app.asar\dsh`） |
| profile | `desktop` → `C:\Users\GZX\.dsh\profiles\desktop` |
| GUI | `http://127.0.0.1:<端口>`（每次启动随机，以 `/health` 返回的 `origin` 为准；页面需认证 cookie，插件路由不走该认证）。**桌面端页面实际运行在 `dsh-app://app`**，非静态路径请求由主进程转发到该端口（见 §11.5） |
| 插件状态目录 | `C:\Users\GZX\.dsh\state\personal-agent`（`events.jsonl`、`kv.json`、`work/<ticketId>/`） |
| 插件 entryId | `include:personal-agent`（patch 行 id `personal-agent`，包名 `dsh-personal-agent`） |
| 安装方式 | 本地目录链接（`plugin_manager install_bundle` 指向仓库绝对路径） |

工具路径（Harness 自带运行时）：

```powershell
$node='C:\Users\GZX\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm='C:\Users\GZX\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
```

> `app.asar` 里的文件原生工具（rg/Get-Content）读不了，用 read 工具，或用上面这个 node（带 asar 支持）跑脚本。

---

## 2. 固定动作（构建 / 重载 / 验证）

```powershell
# 类型检查
& $node .\node_modules\typescript\bin\tsc --noEmit

# 单元 + 集成测试（303 项）
& $node .\node_modules\vitest\vitest.mjs run

# 构建：先 tsdown（host ESM → lib/index.js，client CJS → lib/client.body.js），再包外壳成 lib/client.js
Remove-Item .\lib -Recurse -Force
& $node .\node_modules\tsdown\dist\run.mjs
& $node .\scripts\wrap-client.mjs

# 本地伪 ctx 冒烟（不碰真实 profile）
& $node .\collab\scr\check-host.mjs      # 20 项：装配/守卫/账本重放/角色装饰/决定端点/worker 装饰时序
& $node .\collab\scr\check-client.mjs    # 外壳形状、tab 与两个 slot、无自动打开残留
& $node .\collab\scr\read-session.mjs <session.v4.jsonl.zstd>
```

重载与生效规则（**重要**）：

| 改动 | 生效方式 |
|---|---|
| Host 半区 | `plugin_manager` `set_plugin` target `include:personal-agent` → `false` 再 `true`，即加载新代码（无需重启） |
| Client 半区 | 构建后**必须刷新页面**；标签标题已单独注册，不必关掉标签重开 |
| 已安装包再 `install_bundle` | 会报 `already-installed`；改动走 `set_plugin` 关→开 |

线上探针（同源 HTTP，除 `/health` 外都要求自定义头 + Origin/Referer）：

```powershell
$u='http://127.0.0.1:52810/personal-agent/api'
$h=@{ 'x-personal-agent-request'='1'; 'origin'='http://127.0.0.1:52810' }
(Invoke-WebRequest "$u/health" -UseBasicParsing).Content
(Invoke-WebRequest "$u/snapshot" -Headers $h -UseBasicParsing).Content
# 决定（需真实 approvalId）
Invoke-WebRequest "$u/approvals/<id>/decide" -Method Post -Headers ($h+@{'content-type'='application/json'}) -Body '{"kind":"selected","index":0}' -UseBasicParsing
```

---

## 3. 代码地图

```
prompts/{shared,router,worker}.md  随包分发的提示词（一句一行；package.json files 含 prompts）
src/shared/api.ts              契约：路径/头/错误码/health+snapshot+决定响应类型
src/shared/events.ts           11 类 L2 事件（含 task/interrupted、task/resumed）、payload、EventDraft
src/shared/tickets.ts          派生阶段、排队原因、结束原因、TicketView（含 interrupted/context/约束/验收）
src/shared/approvals.ts        两态视图、决定/选项/可填字段、ApprovalView
src/host/index.ts              插件入口：账本+kv、调度器、观察、装饰、自愈、HTTP 面、启动调度
src/host/console-api/guard.ts  同源校验（自定义头 + Origin/Referer）
src/host/console-api/server.ts 路径分派：/health、/snapshot、/approvals/:id/decide、405/404/500
src/host/store/event-store.ts  唯一写入口：seq、fsync、eventId 幂等、重放、写失败回滚
src/host/store/ledger-format.ts 行编解码、重放、尾部残行、连号校验、LedgerCorruptionError
src/host/store/payload-spec.ts 11 类事件运行时载荷契约 + 决定记录判别（自愈复用）
src/host/store/event-id.ts     eventId 派生：每类事件的关键字段表
src/host/store/kv-store.ts     kv.json：原子替换、损坏降级、串行写入
src/host/projector/project.ts  纯函数 project(events) → { tickets, approvals, stats }
src/host/dispatcher/plan.ts    planDispatch / predictQueueReason（纯函数）
src/host/dispatcher/brief.ts   任务简报与追加简报文本
src/host/dispatcher/executor.ts 建会话 → 写 task/dispatched → 投递简报（追加先校验活 agent）
src/host/dispatcher/scheduler.ts 单动作重规划、失败即停、重入保护 + 尾部重跑
src/host/sessions/router.ts    路由会话身份（kv）+ 迁移旧 router-session.json
src/host/sessions/worker.ts    执行会话：工单工作区 + workingDirectory.set + 标题
src/host/sessions/delivery.ts  followup + flush；幂等范围=本进程 inbox
src/host/sessions/message.ts   投递消息构造（source.kind='dsh-personal-agent'）
src/host/sessions/history.ts   汇报摘要（最后一条完整 assistant 文本，200 字）
src/host/sessions/log-reader.ts 读会话持久化事件（按页），自愈使用
src/host/sessions/observer.ts  回合边界 → reported/closed/interrupted/resumed
src/host/sessions/decorate.ts  agent/created 角色装饰：提示词 section + 工具 + restrict
src/host/approvals/ids.ts      createApprovalId（a-<10hex>）
src/host/approvals/resolvers.ts 阻塞工具登记表（先送达、等 ack）
src/host/approvals/message.ts  决定消息模板（§6.5）
src/host/approvals/service.ts  决定三支路（discard / inline / followup）
src/host/approvals/heal.ts     启动自愈：读 tool/result.meta 补写 decided
src/host/tools/pa_task_route/  入队工具（参数收窄、失败码、触发调度）
src/host/tools/pa_approval_submit/ 阻塞审批工具（presentationMeta 供自愈）
src/host/tools/pa_ledger_query/ 只读紧凑文本查询
src/host/tickets/ids.ts        createTicketId / shortTicketId
src/host/state/directory.ts    状态目录解析 + 幂等建目录
src/client/entry.ts            注册标签类型、正文、标题（无自动打开）；构造动作面
src/client/actions.ts          动作面：openSession / openFile / showTickets / sessionTitle
src/client/lib/http.ts         唯一网络边界（fetchSnapshot + ApiError）
src/client/lib/filter.ts       胶囊 + 搜索（haystack、AND、与胶囊交集）
src/client/lib/tickets.ts      胶囊归属与副标签（阻塞中 / 已中断）
src/client/lib/files.ts        绝对路径 → dsh-resource 地址、路径取展示名
src/client/lib/sessions.ts     会话列表行取展示名（title → displayTitle）
src/client/lib/format.ts       卡片时间（绝对时间）与风险标签
src/client/panel/ConsolePanel.tsx   总控台正文（快照轮询在此一层，标签徽标）
src/client/components/ApprovalCard.tsx  审批卡（官方提问卡结构 + 头部元信息 + 附件）
src/client/components/TicketCard.tsx    工单卡（同款外壳，无展开态/无动作）
src/client/components/FilterBar.tsx     胶囊 + 搜索 + 帮助
src/client/components/HelpPopover.tsx   帮助浮层
src/client/components/card/             卡片外壳、头部、选项、回答框、附件、页脚、按钮、图标
tests/host/**                  单测（镜像 src）
tests/integration/ticket-flow.test.ts  A1–A4 链路 + A7 容量释放
tests/support/fake-host.ts     伪宿主（会话、投递、agent ctx、事件分发）
collab/scr/check-*.mjs         伪 ctx 冒烟
scripts/wrap-client.mjs        把 CJS 产物包成 window.__ModuleLoader__.load({id, factory})
```

文档：

- `docs/personal-agent-MVP开发方案.md` — 实现契约；**§16 是 P2 实施修订（追加）**，与上文冲突处按 §16
- `docs/personal-agent-架构设计方案.md` — 全局蓝图（未来视图）
- `docs/archive/` — P0 验收报告已归档，按仓库规则不阅读
- `DSL.md` — 右侧栏设计参考

---

## 4. 已锁定的产品约定（别再改的）

| 事项 | 约定 |
|---|---|
| 命名 | 插件名「个人代理 / Personal agent」；右侧栏标签与面板名「总控台 / Console」；面板内不再有标题与说明 |
| 左栏 | 工作区「个人代理」（会话「个人代理 · 路由」已置顶）；工作区「个人代理 · 工单」（每工单一个会话） |
| 工单会话标题 | `<任务名> · 工单 #<6 位短码>` |
| 标签页 | 概览/审批/工单/事件/来源/设置；默认落在「审批」；四个未实现页显示「暂未开放」 |
| 审批 | 两态（待审批/已通过），先送达后记账，崩溃回退待审批；作废条目任何胶囊都不显示 |
| 工单 | 无 status 字段；胶囊：待处理/进行中/已结束/全部；阻塞中与**已中断**都是进行中的副标签 |
| 账本 | append-only JSONL；seq 严格连号；eventId 幂等；尾部残行截断并告警；未知类型跳过并告警；损坏行拒绝启动 |
| 列表顺序 | 工单按 `createdAt` 升序；审批：待审批按 `createdAt` 升序在前，已通过按 `decidedAt` 降序在后 |
| 提示词 | 随包 `prompts/*.md`，一句一行；版本/覆盖留待后续，内置文本是基线 |
| 权限 | MVP 不显式设权限档，跟随 profile 默认 `danger-full-access`（显式风险） |
| 搜索/筛选 | P3 再做 |

---

## 5. 运行时契约与坑（P0–P2 实测）

1. **右侧栏标签类型**：`ctx.sidebarRightTabs.register({ id, kind, title, guide })`；正文 `sidebar.right.pane.tab`（key=definition.id）；标题 `sidebar.right.pane.tab.title`（不注册则已开标签不刷新）。
2. **导航**：`ctx.sidebarRight.openTab(kind)`；没有选中会话时会抛错（P0 自动打开已删除）。
3. **HTTP**：`ctx.webServer.register({ kind:'prefix', path, handler(req,res) })`；prefix 路由不受页面认证约束，安全边界靠自己（回环 + 自定义头 + Origin/Referer）。
4. **会话创建**：`sessionController.create({ workspaceId })` 或 `{ cwd }` 二选一；"工作区 + 子目录"用 `workingDirectory.set(agent, path)`。
5. **置顶**：`workspaceRegistry.pinSession(id)`；证据在 `storages/workspace.json` 的 `global.pinnedSessionIds`。
6. **投递**：`agent.followup(frozen user message)` + `sessionPersistence.flush()`；消息 id=`pa-delivery:<requestId>`，进程内按 inbox 去重。
7. **工具**：`ctx.tools.register(def)`；不声明 `timeoutMs` 就没有期限；**scoped 工具**注册在 `agent.ctx` 上，不会出现在全局工具表。
8. **重启收尾**：`dsh-agent-loop` 用 `interruptedTurnClosers` 补合成 `tool/result` + `turn/end{interrupted}`，日志平衡；观察者据此写 `task/interrupted{reason:'turn-interrupted'}`。
9. **会话日志**：追加的多个 zstd 帧；读全量必须走 `sessionPersistence.open(id,'read')` + `handle.read(offset,n)`（`sessions/log-reader.ts`）。
10. **运行时 import DSH 包可行**：本插件已运行时使用 `@deepseek-ai/dsh-llm`（HarnessError）与 `dsh-tools` 类型；peer 版本跟随运行版本。
11. **`agent/created`**：payload `{ agent, source, signal? }`，serial 模式；`agent.ctx` 上注册的作用域贡献在 agent 销毁时卸载；根 ctx 监听所有 agent。**创建监听器不得 await 自己的销毁或 `whenIdle()`**。
12. **`turn/end` 原因**：实际枚举是 `completed | error | aborted | blocked | interrupted | max-tokens | forked`（不是 `failed`）。映射见方案 §16.4。
13. **`tool/result` 持久化 `meta`**：`output.presentationMeta(args, value)` 的返回值落在 `tool/result.data.meta`，自愈靠它恢复决定。
14. **`systemPrompt.section`**：`{ name, order, text }`，作用域注册通过 `agent.ctx`；第一方 section 在 0~10000 稀疏分配，我们用 900。
15. **`tools.restrict({ deny })`**：未知名字会抛错；必须先与 `agent.ctx.tools.definitions(agent)` 求交集，工具清单随部署变化。
16. **账本写路径**：同步「派生 id → 查重 → 分配 seq → writeSync → fsyncSync → 改内存」；写失败截回原长度，回滚失败拒绝后续 append。
17. **账本读路径**：严格连号；尾部残行截断；重复 eventId 跳过；未知类型跳过但占 seq。
18. **契约升级纪律**：payload 新字段必须可选；新事件类型要同时登记 `KEY_FIELDS` 与 `PAYLOAD_SPECS`。
19. **投影语义**：closed 终态优先；blocked 需已 dispatched；updatedAt 取最大值；作废审批全列表剔除；reported 不等于结束。
20. **决定顺序**：先读 pending → 校验决定 → 归档则 discarded → 有 resolver 则 inline（等 ack）→ 否则 followup 投递 → 成功后才写 decided。
21. **kv**：`kv.json` 原子替换；损坏降级为空并告警；旧 `router-session.json` 迁移后删除。
22. **调度器**：单动作重规划、失败即停、进行中标记 + 尾部重跑；追加前校验目标会话有活 Agent。
23. **装饰幂等**：同一 agent 只装饰一次；`agent/disposed` 与插件卸载都会释放；启动时对已存在的 router agent 显式补装饰。

---

## 6. 脚手架清理（P1 已完成，P2 无新增脚手架）

`/dev/*`、beacon、自动打开、`pa_smoke_block`、开发期 api 类型均已删除。冒烟脚本改为真实装配校验（17 项）。冒烟遗留的两个工单目录与会话已由用户手动清理。

---

## 7. P3（UI）已完成，待目检

1. `hooks/useSnapshot.ts` 未改：2s 轮询、失败退避 10s；现在由 `ConsolePanel` 调用一次，两页共用。
2. 审批页：三胶囊、搜索、卡片折叠/展开、选项、回答框、附件、跳过 + 提交、已决只读态，全部完成。
3. 工单页：四胶囊、搜索、同款卡片；只有「阻塞中」「已中断」两个副标签，无阶段徽标/汇报摘要/排队原因。
4. `lib/filter.ts`：胶囊与搜索交集、AND 分词、haystack 覆盖可见字段与时间文本，已测。
5. 徽标（审批标签显示待审批数）、i18n zh/en、帮助浮层与卡片样式全部完成。
6. 待用户目检：深浅色主题、窄宽度、真实审批一条新数据（见 §12）。

---
## 8. 未决问题

1. **A1–A4 真实链路待跑**：需要一个「用户在 router 会话提任务」的回合。建议在 GUI 的「个人代理 · 路由」里发：`把当前状态整理成一句话，先不要派工单`（验证直接回复），再发：`在 D:\tmp\pa-smoke 建一个 hello.txt，内容写 P2 OK`（验证派发→执行→结束）；需要审批时说「发布前问我一次」。
2. **A5 待重启**：重启桌面端后，pending 审批应仍在；点确认走 followup。
3. **A6 归档分支**：单测覆盖；真实归档需要手动归档 worker 会话后点确认。
4. **深色主题与窄宽度**未验证，P3 一起看。
5. **提示词版本控制**：当前只有内置 md；覆盖层 + 版本记录（参考 SuperAgent）留待后续，方案 §16.1 已留好结构。
6. **`maxWorkers` UI**：只在 Config 里，无界面（MVP 约定）。

---

## 9. P2 验收证据（2026-11-15）

| 项 | 证据 |
|---|---|
| 测试 | `vitest run`：**23 文件 / 230 项全绿**（含集成 A1–A4、A7 两条链路） |
| 类型检查 | `tsc --noEmit` 无输出 |
| 构建 | tsdown 产出 `lib/index.js` + `lib/client.js` |
| 伪 ctx 冒烟 | `check-host.mjs` **17/17**：装配、router/worker 装饰、守卫、重放、快照、决定（not-found/405/非法下标/followup 成功 + 消息送达 + 状态迁移）、`/dev` 404 |
| 真实宿主 | `set_plugin` 关→开后 `/health` 200；`/snapshot` 空投影；`POST /approvals/a-ghost/decide` → 404 not-found；`kv.json` 已建立、`router-session.json` 已删除、置顶会话未变 |
| 未验证 | A1–A4 需 GUI 里真实对话；A5 需重启桌面端；A6 需真实归档 worker 会话 |

---

## 10. 验收修复记录（0.2.1，2026-11-15）

### 10.1 症状

P2 验收时 router 提示词与工具正常，worker 既没有提示词 section 也没有 `pa_approval_submit`，导致「需要审批」的验收无法完成；但同一工单的派发、简报投递、回合汇报与自动关闭都正常（账本 `t-9c20e78bca` 可证）。

### 10.2 根因

worker agent 由 `sessionController.create` 创建，而真实宿主在 create 返回**之前**就发布 `agent/created`；`task/dispatched`（携带 workerSessionId）是 create 之后才写入的。装饰器的 `agent/created` 监听器此时用账本判断角色，`roleForSession` 找不到绑定 → 跳过装饰。router 不受影响是因为 `ensureRouterSession` 返回后显式调用了 `decorator.decorate()`。

第二个隐患：插件重载会释放上一实例的 `agent.ctx` 装饰，但已存活的 worker agent 不会再发 `agent/created`，因此重载后活 worker 也会失去能力。

### 10.3 修复

- 执行器新增 `onWorkerReady(sessionId)`：在 `task/dispatched` 写入之后、简报投递之前解析活 agent 并补装饰（`src/host/dispatcher/executor.ts`、`scheduler.ts`）。
- 启动时 `decorateLiveWorkerSessions()` 按账本里所有 `workerSessionId` 给仍存活的 agent 补装饰；只调 `ctx.agents.list()`，不唤醒冷会话（`src/host/sessions/decorate.ts`、`index.ts`）。
- `inject` 增加 `agents` 服务。

### 10.4 回归防线

- 集成测试的伪宿主现在用 `emitAgentCreatedOnCreate: true` 复现「create 即发布」的真实时序，并断言 worker 在简报投递前已有工具与 section。
- 执行器单测锁定顺序：`ready` 在 `task/dispatched` 之后、投递之前；创建失败不调用 ready。
- `check-host.mjs` 新增 3 项：真实调用 `pa_task_route` → worker 会话创建 → 装饰先于简报。

### 10.5 重跑验收

请再跑一次第三项（需要审批的任务）。预期：worker 会话日志的系统提示词里出现「个人代理的执行会话」段落，工具列表含 `pa_approval_submit`；提交审批后 `/snapshot` 出现待审批，决定应返回 `transport: inline` 或 `followup`。

---

## 11. 进度记录（0.2.2，2026-11-15 晚）

### 11.1 审批页最小版（已提交）

`src/client/views/Approvals.tsx` + `components/ApprovalCard.tsx` + `hooks/useSnapshot.ts`：待审批列表、选项/可填字段/备注/跳过/提交、2s 轮询（失败退避 10s）、提交后立即刷新并按错误码显示原因。暂未做：已通过/全部胶囊、搜索、工单页、徽标（P3 后续）。

### 11.2 浏览器请求被 403 的根因与修复

现象：面板显示「连接中断」，`/snapshot` 在命令行可用。原因：同源 GET 的 `fetch` 不带 `Origin`，宿主页面又用 `Referrer-Policy` 去掉了 `Referer`，同源守卫因此拒绝（`wrong-origin`）。

修复：`guard.ts` 增加第三种同源证据——浏览器强制写入、脚本不可伪造的 `Sec-Fetch-Site: same-origin`；同时保留 Origin/Referer 校验。只接受 `same-origin`，`cross-site` 仍拒绝。新增 `tests/host/console-api/guard.test.ts`（8 项）与冒烟第 21 项。

已实测：`custom-header + Sec-Fetch-Site: same-origin`（无 Origin/Referer）→ 200；重载后 `/health` 为 `0.2.2`。

### 11.3 A2–A4 链路已验证（经 API 触发决定）

为避免重载 Host 时把阻塞中的 resolver 弄丢（worker 会卡在工具调用里），在重载前用 HTTP 以 inline 支路结掉了当时的测试审批：

- `POST /approvals/a-684460e5f9/decide {kind:'selected',index:0}` → `{ok:true, transport:'inline'}`；
- 账本随后出现 `approval/decided`、`task/reported`、`task/closed`，工单 `t-7380b609ef` 正常结束（ended）。

即：**工具提交 → 审批阻塞 → 决定送达 → worker 继续 → 汇报 → 关闭** 这条链已跑通；尚未验证的是「在面板里点击提交」这一下，需用户刷新后再发一个新审批。

### 11.4 下一步（恢复上下文后从这里继续）

1. 用户在面板点「立即重试」确认连接恢复（Host 已重载到 0.2.3，无需刷新页面）。
2. P3 剩余：已通过/全部胶囊、已决卡片只读、搜索、工单页、标签徽标、i18n 清理（`approvalsEmpty` 等未用键）。
3. 测试规模：**303 项**（P3 后；含 client 43 项、guard 16 项）；`check-host.mjs` **23 项**。
4. 当前真实账本：2 张已结束工单，1 条已决审批，无待审批。

### 11.5 「连接中断」最终根因与修复（0.2.3）

**诊断**：Desktop 页面运行在 `dsh-app://app`，`lib/main.js` 的 `forwardWebRequest` 把 `dsh-app://app/<path>` 转发到 Host 的同一路径，并**删除** `origin`、`cookie`、`sec-fetch-site`，再注入 Host 认证 cookie。因此面板的 `/snapshot` 请求到达 Host 时三者全缺席，旧守卫把它当跨源拒绝（403），面板显示「连接中断」。§11.2 补的 `Sec-Fetch-Site` 在转发链路上已被主进程剥掉，所以修不好。

**修复**：`guard.ts` 改为只拒绝**明确存在且不合格**的证据；三项全缺席放行，并接受 `dsh-app://app` 作 Referer 来源。浏览器跨站请求必带 `Origin` 或 `Sec-Fetch-Site`，拒绝分支不变；自定义头仍会触发预检。详见方案 §16.13。

**验证**：真实宿主 `/health` 为 `0.2.3`；仅带自定义头的 `/snapshot` → 200，外来 Origin / `cross-site` → 403；单测 260、冒烟 23 全绿。

## 12. P3 交付记录（0.3.0，2026-11-15）

### 12.1 契约变化

- 删除 `title` 与 `fields`（工具参数、决定校验、消息模板、投影、查询、测试一并清理）；
  旧账本里的这两个键**读到即忽略**，不算损坏（`payload-spec` 只校验已声明键）。
- 新增 `attachments`：工具参数 → `approval/pending.payload` → `ApprovalView`；
  相对路径按工单工作目录归一，工单无目录时相对路径直接失败；上限 20、去重、不做文件 IO。
- 详见 `docs/personal-agent-MVP开发方案.md` §17。

### 12.2 外观基准

卡片外观以官方 `ask_user_question` 提问卡为唯一基准（源码从 `app.asar` 取到，见
`collab/scr/ref/user-questions/`，该目录已 gitignore）。与官方只有两处不同：
头部元信息（发起者/关联工单/时间）与附件行。折叠态 = 官方 minimize 形态。
所有颜色/圆角/字号/阴影取宿主 token，没有自造设计变量。

### 12.3 验证证据

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 无输出 |
| `vitest run` | 32 文件 / 303 项全绿 |
| 构建 | `lib/index.js` + `lib/client.js`（client 63KB） |
| `check-host.mjs` | 23/23（含 attachments 透出） |
| `check-client.mjs` | 外壳、inject 5 项、两个 slot、标题正确 |
| 真实宿主 | `set_plugin` 关→开；`/health` = **0.3.0**；`/snapshot` 旧账本重放成功，审批视图无 title/fields |

### 12.4 待用户目检

1. 刷新 GUI → 总控台「审批」：已通过卡片折叠态、展开后只读态、时间格式。
2. 「工单」：四胶囊、卡片头部「工单 #短码 · 标题」、主体目标、两个副标签。
3. 深浅色主题、窄宽度（右侧栏拖窄到 ~360px）。
4. 真实数据：让 router 派一个「需要审批」的工单，并在审批里带一个 `attachments`，
   确认附件行出现且点击能在右侧栏打开文件。

### 12.5 已知取舍

- 卡片不再限高（官方在输入位上限高 `min(60vh,520px)`）；右侧栏整列滚动，卡片自然高。
- 卡片里的图标是自绘的 16px 线性图标（宿主未把图标包暴露给插件）。
- 会话展示名取 `ctx.sessions.list` 的列表行；宿主还没投影出标题时显示会话短码。

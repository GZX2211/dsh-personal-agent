# dsh-personal-agent 交接备忘

> 自包含交接文档：不依赖任何对话上下文，读完即可继续开发。
> 状态：**P1 数据层已验收**（2026-11-15），下一步是 P2 工具与会话。
> 本文属临时协作文档（`collab/md/`），不进 `docs/`，不需要英文版。

---

## 0. 一句话现状

`dsh-personal-agent` 是一个已安装到 `desktop` profile、正在运行的 DSH 插件：右侧栏有「总控台」面板（六个标签页，四个暂未开放）。宿主侧打通同源 HTTP、路由会话置顶、工单执行会话与投递、阻塞工具四条通道（P0 已验证）。P1 完成了数据层：**append-only JSONL 账本**（seq 分配 / fsync / eventId 幂等 / 启动重放 / 尾部残行截断）、**纯投影**（工单阶段、审批两态、统计）与 `GET /snapshot`；`/dev/*`、客户端 beacon 与自动打开已全部删除。业务（派发/审批/调度/工具）尚未实现。

---

## 1. 环境事实

| 项 | 值 |
|---|---|
| 仓库 | `D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent` |
| DSH 运行版本 | 0.2.2-rc.3（Desktop：`D:\dsh\resources\app.asar\dsh`） |
| profile | `desktop` → `C:\Users\GZX\.dsh\profiles\desktop` |
| GUI | `http://127.0.0.1:52810`（页面需认证 cookie；插件自己的路由不走该认证） |
| 插件状态目录 | `C:\Users\GZX\.dsh\state\personal-agent`（`events.jsonl`、`router-session.json`、`work/<ticketId>/`） |
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

# 单元测试（vitest，78 项）
& $node .\node_modules\vitest\vitest.mjs run

# 构建：先 tsdown（host ESM → lib/index.js，client CJS → lib/client.body.js），再包外壳成 lib/client.js
Remove-Item .\lib -Recurse -Force
& $node .\node_modules\tsdown\dist\run.mjs
& $node .\scripts\wrap-client.mjs

# 本地伪 ctx 冒烟（不碰真实 profile）
& $node .\collab\scr\check-host.mjs      # 13 项：装配/守卫/账本重放/快照/405/404
& $node .\collab\scr\check-client.mjs    # 外壳形状、tab 与两个 slot、无自动打开残留
& $node .\collab\scr\read-session.mjs <session.v4.jsonl.zstd>   # 读会话日志（只解首帧，见 §5.9）
```

重载与生效规则（**重要**）：

| 改动 | 生效方式 |
|---|---|
| Host 半区 | `plugin_manager` `set_plugin` target `include:personal-agent` → `false` 再 `true`，即加载新代码（无需重启） |
| Client 半区 | 构建后**必须刷新页面**（没有 `dev:web` 重建推送时不保证重放）；标签标题已单独注册，不必关掉标签重开 |
| 已安装包再 `install_bundle` | 会报 `already-installed`；改动走 `set_plugin` 关→开 |

线上探针（同源 HTTP，除 `/health` 外都要求自定义头 + Origin/Referer）：

```powershell
$u='http://127.0.0.1:52810/personal-agent/api'
$h=@{ 'x-personal-agent-request'='1'; 'origin'='http://127.0.0.1:52810' }
(Invoke-WebRequest "$u/health" -UseBasicParsing).Content                    # 免鉴权
(Invoke-WebRequest "$u/snapshot" -Headers $h -UseBasicParsing).Content      # 账本投影
(Invoke-WebRequest "$u/snapshot" -UseBasicParsing -SkipHttpErrorCheck)      # 应 403
```

---

## 3. 代码地图

```
src/shared/api.ts              契约：路径/自定义头/错误码/health 与 snapshot 响应类型（禁止运行时 import）
src/shared/events.ts           9 类 L2 事件、payload、EventDraft（seq/eventId/time 由账本补齐）
src/shared/tickets.ts          派生阶段、排队原因、结束原因、TicketView
src/shared/approvals.ts        两态视图、决定/选项/可填字段、ApprovalView
src/host/index.ts              插件入口：打开账本（异步）+ 挂 HTTP 面 + 启动时确保路由会话
src/host/context.ts            仅类型：import type 各 DSH 包，让 ctx.<service> 有类型
src/host/console-api/guard.ts  同源校验（自定义头 + Origin/Referer）
src/host/console-api/server.ts 路径分派：/health、/snapshot、405/404/500
src/host/store/event-store.ts  **唯一写入口**：seq 分配、fsync、eventId 幂等、打开时重放、写失败回滚
src/host/store/ledger-format.ts 行编解码、重放、尾部残行、序号校验、LedgerCorruptionError
src/host/store/payload-spec.ts 9 类事件的运行时载荷契约（新增字段必须可选）
src/host/store/event-id.ts     eventId 派生：每类事件的关键字段表
src/host/projector/project.ts  纯函数 project(events) → { tickets, approvals, stats }
src/host/sessions/message.ts   投递消息构造（source.kind='dsh-personal-agent'，深冻结，幂等 id）
src/host/sessions/delivery.ts  followup + sessionPersistence.flush，幂等范围=本进程 inbox
src/host/sessions/router.ts    路由会话：工作区 + 会话 + rename + pinSession，身份落 router-session.json
src/host/sessions/worker.ts    执行会话：工作区「个人代理 · 工单」+ workingDirectory.set(工单目录) + 标题
src/host/tickets/ids.ts        createTicketId（t-<10hex>）/ shortTicketId（前 6 位）
src/host/state/directory.ts    状态目录解析（DSH_HOME 或 ~/.dsh）+ 幂等建目录
src/client/entry.ts            注册标签类型、正文、标题（P1 已删自动打开）
src/client/context.ts          仅类型：slots / locale / sidebarRightTabs
src/client/definition.ts       标签类型声明（id/kind/title/guide）
src/client/panel/ConsolePanel.tsx   总控台正文：标签条 + 六页（审批/工单仍为空态）
src/client/components/ConsoleTabStrip.tsx  标签条（role=tablist/tab + aria-selected）
src/client/components/ConsoleTabTitle.tsx  标签条上的标题（sidebar.right.pane.tab.title）
src/client/views/Placeholder.tsx     「暂未开放」占位
src/client/views/Manager.tsx         能力管理页占位（非 MVP 范围，暂未接线）
src/client/lib/http.ts               唯一网络边界（fetchSnapshot + ApiError）
src/client/i18n.ts                   双语文案 + Text/Translate/detectLanguage
src/client/style.ts                  面板 CSS（宿主 token，字符串注入）
tests/host/store/*                   账本：eventId、重放故障注入、EventStore 文件语义
tests/host/projector/project.test.ts 投影：24 项
tests/host/console-api/server.test.ts 协议层：9 项
collab/scr/check-*.mjs               伪 ctx 冒烟脚本
scripts/wrap-client.mjs              把 CJS 产物包成 window.__ModuleLoader__.load({id, factory})
tsdown.config.ts                     两段构建（host esm / client cjs，产物后缀统一 .js）
cordis.patch.yml                     insert 一行：id personal-agent → 包名
locale/{zh,en}.json                  Plugin Manager 展示（meta.title/description/detail）
docs/DETAIL.md                       插件详情页文档
```

文档：

- `docs/personal-agent-MVP开发方案.md` — **实现契约**（§1 验收 A1–A9、§3 数据模型、§5 调度、§6 审批、§7 会话、§8 工具、§9 HTTP、§10 UI、§12 目录、§15 P0 修订、附录 A 决策 15 条）
- `docs/personal-agent-架构设计方案.md` — 全局蓝图（未来视图）
- `docs/archive/` — P0 验收报告已归档，按仓库规则不阅读
- `DSL.md` — 右侧栏设计参考（容器分区与卡片结构）

---

## 4. 已锁定的产品约定（别再改的）

| 事项 | 约定 |
|---|---|
| 命名 | 插件名「个人代理 / Personal agent」；右侧栏标签与面板名「总控台 / Console」；面板内**不再有标题与说明** |
| 左栏 | 工作区「个人代理」（内含会话「个人代理 · 路由」，已置顶）；工作区「个人代理 · 工单」（内含每个工单一个会话） |
| 工单会话标题 | `<任务名> · 工单 #<6 位短码>`（名称在前，左栏截断后仍能认出任务） |
| 标签页 | 概览/审批/工单/事件/来源/设置；默认落在「审批」；四个未实现页显示「暂未开放」 |
| 标签条样式 | 与宿主会话视图标签一致：13px/500、间距 32px、行高 38px、左内边距 16px、底线 `--dsw-alias-border-l3` 0.5px、选中项 `--dsw-alias-state-business-primary` + 2px 圆角下划线；徽标为上标 |
| 审批 | 两态（待审批/已通过），先送达后记账，崩溃回退待审批；作废条目任何胶囊都不显示 |
| 工单 | 无 status 字段，阶段派生（待处理/进行中/阻塞中/已结束）；路由不感知并发，入队由调度器放行 |
| 账本 | append-only JSONL；seq 严格连号；eventId 幂等；尾部残行截断并告警；未知事件类型跳过并告警；完整行损坏拒绝启动 |
| 列表顺序 | 工单按 `createdAt` 升序（入队序）；审批：待审批按 `createdAt` 升序在前，已通过按 `decidedAt` 降序在后 |
| 权限 | MVP 不显式设权限档，跟随 profile 默认 `danger-full-access`（记为显式风险） |
| 搜索/筛选 | P3 再做 |

---

## 5. 运行时契约与坑（P0+P1 实测）

1. **右侧栏标签类型**：`ctx.sidebarRightTabs.register({ id, kind, title, guide })`；正文注册在 `sidebar.right.pane.tab`，key = `definition.id`；标题注册在 `sidebar.right.pane.tab.title`。
   - **坑**：宿主对已打开的标签使用「打开那一刻捕获的文本」，只改 `title()` 不会刷新已开标签——必须注册标题 slot。
2. **导航**：`ctx.sidebarRight.openTab(kind)`；页面上没有选中会话时会抛错（P0 的自动打开曾带重试，P1 已删除该脚手架）。
3. **HTTP**：`ctx.webServer.register({ kind:'prefix', path:'/personal-agent/api', handler(req,res) })`，Node 原生 `req/res`。`getOrigin()` 给出 `http://127.0.0.1:52810`。
   - 页面本身要认证 cookie，但 prefix 路由不受该认证约束：安全边界靠自己（回环 + 自定义头 + Origin/Referer）。
4. **会话创建**：`ctx.sessionController.create({ workspaceId })` 或 `{ cwd }`，**两者不能同时给**（会报 "accepts workspaceId or cwd, not both"）。要「工作区 + 子目录」就用 `ctx.workingDirectory.set(agent, path)`，它会在会话里留一条 `working-directory/change` 与一条 `working-directory` 来源的 user 消息。
5. **置顶**：`ctx.workspaceRegistry.pinSession(sessionId)`；读回证据在 `C:\Users\GZX\.dsh\storages\workspace.json` 的 `global.pinnedSessionIds`。
6. **投递**：`agent.followup(freeze 后的 user 消息)` + `ctx.sessionPersistence.flush()`；幂等靠消息 id（本插件 `pa-delivery:<requestId>`）。跨进程幂等需扫持久化历史（P2 做）。
7. **工具**：`ctx.tools.register({ name, description, parameters, output: { schema, render }, execute })`；**不声明 `timeoutMs` 就没有期限**（超时策略包无全局配置，逐工具生效）。实测 65 秒阻塞不被裁剪。
8. **重启收尾**：`dsh-agent-loop` 恢复会话时用 `interruptedTurnClosers` 补合成 `tool/result`（`TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED`）+ `step/end` + `turn/end{interrupted}`，日志始终平衡。
9. **会话日志**：`%DSH_HOME%\sessions\<转义后的 cwd>\<session-id>\session.v4.jsonl.zstd`，是**追加的多个 zstd 帧**，`zstdDecompressSync` 只解出第一帧（= 只有 header）。要读全量用 `ctx.sessionPersistence.open(id,'read')` + `handle.read(offset,n)`。
10. **运行时能 import DSH 包**：链接安装的插件在宿主里 `await import('@deepseek-ai/dsh-llm')` 成功（探针 68 个导出）。P2 可直接用 `freezeMessage`/`MessageId`，退役自写深冻结。
11. **平台版本**：`@deepseek-ai/cordis` 4.1.0，其余 `0.2.2-rc.3`；peer 范围 `^0.2.2-rc.1`，`engines.dsh` 同锁。
12. **HMR**：`hmr` 行已启用；链接包的构建产物变化会在下一次重组（`set_plugin` 关→开）时被替换加载。
13. **账本写路径**：`EventStore.append` 同步执行「派生 eventId → 查重 → 分配 seq → `writeSync` 单行 → `fsyncSync` → 改内存」。同步 fsync 会阻塞事件循环（毫秒级），MVP 接受；写失败会把文件截回写入前长度，回滚也失败时后续 append 一律拒绝（只允许重启修复）。
14. **账本读路径**：`replayLedger` 是纯函数（输入 Buffer），严格连号：断号/重复 seq → `LedgerCorruptionError`（带行号）；尾部无换行的残行 → 告警并截断到最后一条完整行；重复 eventId → 告警跳过；未知事件类型 → 告警跳过但**仍占用 seq**（下次 append 从最大 seq 续号）。
15. **契约升级纪律**：`payload-spec` 的必填字段不能后加——旧账本行不会重写；新增字段必须可选，否则升级后历史账本会判为损坏。新增事件类型要同时登记 `KEY_FIELDS`（event-id.ts）与 `PAYLOAD_SPECS`。
16. **投影语义**：阶段由事件序列派生（`task/closed` 终态优先；`blocked` 需已 dispatched 且有未决审批）；`updatedAt` 取最大值（时钟回拨不回退）；作废审批从所有列表与统计剔除；`task/reported` 只是汇报，结束必须由 `task/closed` 表达。
17. **快照与错误**：`/snapshot` 直接返回投影（无 `ok` 包装）；账本打不开时返回 500 `internal`（带原因），**不会**返回空快照冒充正常。

---

## 6. P0 脚手架清理（P1 已完成）

| 已删除 | 内容 |
|---|---|
| `src/host/dev/smoke.ts`（整份） | `/dev/p0`、`/dev/state`、`/dev/beacon`、`pa_smoke_block`、请求观测、`summarizeSession` |
| `src/client/lib/dev-beacon.ts`（整份） | 面板上报通道 |
| `src/client/entry.ts` 自动打开 effect | 首次挂载自动 `openTab`（含 `OPEN_RETRY_DELAYS`） |
| `src/shared/api.ts` 开发期契约 | `BeaconRecord`/`ObservedRequest`/`SmokeStep`/`SmokeReport` 与 `ROUTES.dev*` |
| 客户端服务依赖 | `entry.inject` 与 `package.json` 的 `dsh.client.inject` 去掉 `sidebarRight` |

冒烟脚本已改写：`check-host.mjs` 改为 13 项 P1 校验（含真实账本重放 → `/snapshot`），`check-client.mjs` 断言无自动打开残留。

**遗留（尚未清理，待你点头）**：`state/personal-agent/work/t-*` 两个冒烟目录 + 两个「冒烟：通道验证 · 工单 #…」会话。

---

## 7. 下一步 P2（工具与会话）

1. `src/host/dispatcher/`：纯函数 `planDispatch(queue, workers, capacity) → Action[]`（先 append 后 dispatch，FIFO，`maxWorkers: 5`）+ 执行器（建会话 → 写 `task/dispatched` → 投递简报）。
2. `src/host/tools/pa_task_route/`：入队（写 `task/queued`）后触发调度；失败码 `invalid-append-target` / `invalid-directory`。
3. `src/host/tools/pa_approval_submit/`：提交审批（写 `approval/pending`）并阻塞等待；失败码 `no-active-ticket` / `invalid-options` / `approval-cancelled`。
4. `src/host/approvals/`：决定三支路（inline resolve / followup 投递 / worker 已归档则 discarded）、`POST /approvals/:id/decide`、送达消息模板、启动自愈（读 worker 会话日志找 `tool/result`）。
5. `src/host/prompts/` + `agent/created` 装饰：router/worker 提示词 section、工具装配与 `tools.restrict()`；`pa_ledger_query` 只读查询。
6. 技术元数据 `kv`：router 身份从 `router-session.json` 迁入账本 kv（可改写），删除旧文件与 `readRecord/writeRecord`。
7. 用真实账本走 A1–A4；A5 需要重启桌面端。

---

## 8. 未决问题

1. **路由会话的工作区目录**：现在是状态目录（自包含）。方案原文写「用户根目录」（好处：路由会话能直接读用户项目；代价：在用户既有工作区里多一个会话）。MVP 期间保持状态目录，改只需换 `ensureRouterSession` 的入参。
2. **冒烟产生的两个工单目录与两个会话**是否清理（见 §6 遗留）。
3. **审批/工单列表排序**：P1 固定为「工单入队序升序；审批待审在前升序、已通过按决定时间降序」。P3 做 UI 时可再按风险或时间调整。
4. **深色主题与窄宽度**下的面板观感未验证（无浏览器控制），P3 用宿主 token 细化时一起看。
5. **重启后中断收尾**未实测（需要重启桌面端）；P2/A5 会自然覆盖。

---

## 9. P1 验收证据（2026-11-15）

| 项 | 证据 |
|---|---|
| 单元测试 | `vitest run`：5 个文件、**78 项全绿**（store 45、projector 24、console-api 9） |
| 类型检查 | `tsc --noEmit` 无输出 |
| 构建 | `tsdown` 产出 `lib/index.js`（32.2 kB）+ `lib/client.js`（8.6 kB 外壳） |
| 伪 ctx 冒烟 | `check-host.mjs` **13/13**（装配、守卫、账本重放、快照、405、404）；`check-client.mjs` 通过（1 tab + 2 slot，无自动打开） |
| 真实宿主 | `set_plugin` 关→开后：`/health` 200；`/snapshot` 200 空投影；无自定义头 403 `missing-request-header`；`/dev/state` 404；`state/personal-agent/events.jsonl` 已创建（0 字节）；`workspace.json` 仍只有 1 个置顶会话、`router-session.json` 未变（未重复建会话） |
| 待用户动作 | Client 半区有改动（删 beacon/自动打开），需**刷新页面**加载新 bundle；之后面板不再自动弹出，从指南卡片或标签栏打开 |

# dsh-personal-agent 交接备忘

> 自包含交接文档：不依赖任何对话上下文，读完即可继续开发。
> 状态：**P0 冒烟已验收**（2026-11-15），下一步是 P1 数据层。
> 本文属临时协作文档（`collab/md/`），不进 `docs/`，不需要英文版。

---

## 0. 一句话现状

`dsh-personal-agent` 是一个已安装到 `desktop` profile、正在运行的 DSH 插件：右侧栏有「总控台」面板（六个标签页，四个暂未开放），宿主侧打通了同源 HTTP、路由会话置顶、工单执行会话与投递、阻塞工具四条通道。业务（派发/审批/调度）尚未实现。

---

## 1. 环境事实

| 项 | 值 |
|---|---|
| 仓库 | `D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent` |
| DSH 运行版本 | 0.2.2-rc.3（Desktop：`D:\dsh\resources\app.asar\dsh`） |
| profile | `desktop` → `C:\Users\GZX\.dsh\profiles\desktop` |
| GUI | `http://127.0.0.1:52810`（页面需认证 cookie；插件自己的路由不走该认证） |
| 插件状态目录 | `C:\Users\GZX\.dsh\state\personal-agent`（`router-session.json`、`work/<ticketId>/`） |
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

# 构建：先 tsdown（host ESM → lib/index.js，client CJS → lib/client.body.js），再包外壳成 lib/client.js
Remove-Item .\lib -Recurse -Force
& $node .\node_modules\tsdown\dist\run.mjs
& $node .\scripts\wrap-client.mjs

# 本地伪 ctx 冒烟（不碰真实 profile）
& $node .\collab\scr\check-host.mjs      # 15 项：装配/路由/守卫/P0 全链路/阻塞工具/工单标题
& $node .\collab\scr\check-client.mjs    # 外壳形状、apply 注册、标签标题文案
& $node .\collab\scr\read-session.mjs <session.v4.jsonl.zstd>   # 读会话日志（只解首帧，见 §5.9）
```

重载与生效规则（**重要**）：

| 改动 | 生效方式 |
|---|---|
| Host 半区 | `plugin_manager` `set_plugin` target `include:personal-agent` → `false` 再 `true`，即加载新代码（无需重启） |
| Client 半区 | 构建后**必须刷新页面**（没有 `dev:web` 重建推送时不保证重放）；标签标题已单独注册，不必关掉标签重开 |
| 已安装包再 `install_bundle` | 会报 `already-installed`；改动走 `set_plugin` 关→开 |

线上探针（同源 HTTP，全都要求自定义头 + Origin）：

```powershell
$u='http://127.0.0.1:52810/personal-agent/api'
$h=@{ 'x-personal-agent-request'='1'; 'origin'='http://127.0.0.1:52810' }
(Invoke-WebRequest "$u/health" -UseBasicParsing).Content                      # 免鉴权
(Invoke-WebRequest "$u/dev/state" -Headers $h -UseBasicParsing).Content        # beacons + 请求观测 + 上次报告
(Invoke-WebRequest "$u/dev/p0" -Method Post -Headers ($h+@{'content-type'='application/json'}) -Body '{}' -UseBasicParsing).Content
```

---

## 3. 代码地图

```
src/shared/api.ts            契约：路径/自定义头/错误码/health 与冒烟响应类型（禁止运行时 import）
src/host/index.ts            插件入口：装配 HTTP 面 + 阻塞工具 + 启动时确保路由会话
src/host/context.ts          仅类型：import type 各 DSH 包，让 ctx.<service> 有类型
src/host/console-api/guard.ts   同源校验（自定义头 + Origin/Referer）
src/host/console-api/server.ts  路径分派、JSON 响应、请求观测（环形缓冲）
src/host/sessions/message.ts    投递消息构造（source.kind='dsh-personal-agent'，深冻结，幂等 id）
src/host/sessions/delivery.ts   followup + sessionPersistence.flush，幂等范围=本进程 inbox
src/host/sessions/router.ts     路由会话：工作区 + 会话 + rename + pinSession，身份落 router-session.json
src/host/sessions/worker.ts     执行会话：工作区「个人代理 · 工单」+ workingDirectory.set(工单目录) + 标题
src/host/tickets/ids.ts         createTicketId（t-<10hex>）/ shortTicketId（前 6 位）
src/host/state/directory.ts     状态目录解析（DSH_HOME 或 ~/.dsh）+ 幂等建目录
src/host/dev/smoke.ts           **开发脚手架**：/dev/p0、/dev/state、/dev/beacon、pa_smoke_block、会话摘要
src/client/entry.ts             Client 入口：注册标签类型、正文、标题、自动打开（脚手架）
src/client/context.ts           仅类型：slots / locale / sidebarRight / sidebarRightTabs
src/client/definition.ts        标签类型声明（id/kind/title/guide）
src/client/panel/ConsolePanel.tsx   总控台正文：标签条 + 六页（概览/审批/工单/事件/来源/设置）
src/client/components/ConsoleTabStrip.tsx  标签条（role=tablist/tab + aria-selected）
src/client/components/ConsoleTabTitle.tsx  标签条上的标题（sidebar.right.pane.tab.title）
src/client/views/Placeholder.tsx     「暂未开放」占位
src/client/views/Manager.tsx         能力管理页占位（非 MVP 范围，暂未接线）
src/client/lib/http.ts               唯一网络边界（自定义头、JSON、ApiError）
src/client/lib/dev-beacon.ts         开发期上报（失败静默）
src/client/i18n.ts                   双语文案 + Text/Translate/detectLanguage
src/client/style.ts                  面板 CSS（宿主 token，字符串注入）
collab/scr/check-*.mjs               伪 ctx 冒烟脚本
collab/scr/read-session.mjs          会话日志读取探针
scripts/wrap-client.mjs              把 CJS 产物包成 window.__ModuleLoader__.load({id, factory})
tsdown.config.ts                     两段构建（host esm / client cjs，产物后缀统一 .js）
cordis.patch.yml                     insert 一行：id personal-agent → 包名
locale/{zh,en}.json                  Plugin Manager 展示（meta.title/description/detail）
docs/DETAIL.md                       插件详情页文档
```

文档：

- `docs/personal-agent-MVP开发方案.md` — **实现契约**（§1 验收 A1–A9、§3 事件、§5 调度、§6 审批、§7 会话、§8 工具、§9 HTTP、§10 UI、§12 目录、§15 P0 修订、附录 A 决策 15 条）
- `docs/personal-agent-P0验收报告.md` — P0 逐项证据、未验证项、方案修订
- `docs/personal-agent-架构设计方案.md` — 全局蓝图（未来视图）
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
| 权限 | MVP 不显式设权限档，跟随 profile 默认 `danger-full-access`（记为显式风险） |
| 搜索/筛选 | P3 再做 |

---

## 5. 运行时契约与坑（P0 实测）

1. **右侧栏标签类型**：`ctx.sidebarRightTabs.register({ id, kind, title, guide })`；正文注册在 `sidebar.right.pane.tab`，key = `definition.id`；标题注册在 `sidebar.right.pane.tab.title`。
   - **坑**：宿主对已打开的标签使用「打开那一刻捕获的文本」，只改 `title()` 不会刷新已开标签——必须注册标题 slot。
2. **导航**：`ctx.sidebarRight.openTab(kind)`；页面上没有选中会话时会抛错（所以自动打开带了重试）。
3. **HTTP**：`ctx.webServer.register({ kind:'prefix', path:'/personal-agent/api', handler(req,res) })`，Node 原生 `req/res`。`getOrigin()` 给出 `http://127.0.0.1:52810`。
   - 页面本身要认证 cookie，但 prefix 路由不受该认证约束：安全边界靠自己（回环 + 自定义头 + Origin/Referer）。
4. **会话创建**：`ctx.sessionController.create({ workspaceId })` 或 `{ cwd }`，**两者不能同时给**（会报 "accepts workspaceId or cwd, not both"）。要「工作区 + 子目录」就用 `ctx.workingDirectory.set(agent, path)`，它会在会话里留一条 `working-directory/change` 与一条 `working-directory` 来源的 user 消息。
5. **置顶**：`ctx.workspaceRegistry.pinSession(sessionId)`；读回证据在 `C:\Users\GZX\.dsh\storages\workspace.json` 的 `global.pinnedSessionIds`。
6. **投递**：`agent.followup(freeze 后的 user 消息)` + `ctx.sessionPersistence.flush()`；幂等靠消息 id（本插件 `pa-delivery:<requestId>`）。跨进程幂等需扫持久化历史（P2 做）。
7. **工具**：`ctx.tools.register({ name, description, parameters, output: { schema, render }, execute })`；**不声明 `timeoutMs` 就没有期限**（超时策略包无全局配置，逐工具生效）。实测 65 秒阻塞不被裁剪。
8. **重启收尾**：`dsh-agent-loop` 恢复会话时用 `interruptedTurnClosers` 补合成 `tool/result`（`TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED`）+ `step/end` + `turn/end{interrupted}`，日志始终平衡。
9. **会话日志**：`%DSH_HOME%\sessions\<转义后的 cwd>\<session-id>\session.v4.jsonl.zstd`，是**追加的多个 zstd 帧**，`zstdDecompressSync` 只解出第一帧（= 只有 header）。要读全量用 `ctx.sessionPersistence.open(id,'read')` + `handle.read(offset,n)`，或看 §5.9 的探针限制。
10. **运行时能 import DSH 包**：链接安装的插件在宿主里 `await import('@deepseek-ai/dsh-llm')` 成功（探针 68 个导出）。P2 可直接用 `freezeMessage`/`MessageId`，退役自写深冻结。
11. **平台版本**：`@deepseek-ai/cordis` 4.1.0，其余 `0.2.2-rc.3`；peer 范围 `^0.2.2-rc.1`，`engines.dsh` 同锁。
12. **HMR**：`hmr` 行已启用；链接包的构建产物变化会在下一次重组（`set_plugin` 关→开）时被替换加载。

---

## 6. 脚手架清理清单（P1 一起做）

| 位置 | 内容 |
|---|---|
| `src/host/dev/smoke.ts` | `/dev/p0`、`/dev/state`、`/dev/beacon`、`pa_smoke_block`、请求观测、`summarizeSession`（可上移为 `sessions/history.ts` 供审批自愈用） |
| `src/client/lib/dev-beacon.ts` + `entry.ts` 里的 `reportBeacon(...)` | 面板上报点 |
| `src/client/entry.ts` 的自动打开 effect | 首次挂载自动 `openTab`（`OPEN_RETRY_DELAYS`） |
| `src/shared/api.ts` | `BeaconRecord`/`ObservedRequest`/`SmokeStep`/`SmokeReport` 与 `ROUTES.dev*` |
| 冒烟产生的真实产物 | `state/personal-agent/work/t-*` 两个目录 + 两个「冒烟：通道验证 · 工单 #…」会话（**待用户点头后清理**） |

---

## 7. 下一步 P1（数据层）

1. `src/host/store/`：`EventStore`——append-only JSONL（`<state>/events.jsonl`）、seq 分配、`fsync`、启动重放（尾部半行跳过并记警告）、按 eventId 幂等。
2. `src/host/projector/`：纯函数 `project(events) → { tickets, approvals, stats }`，输入即全部事实。
3. `src/shared/{events,tickets,approvals}.ts`：L2 事件与视图类型（方案 §3）。
4. `tests/host`：故障注入（半行、重复 eventId、乱序重放）+ 投影单测；`vitest` 已装但还没有测试。
5. 逐步把 `/dev/*` 换成 `/snapshot` 与 `/approvals/:id/decide`（方案 §9），并接 P2 的 `pa_task_route` / `pa_approval_submit`。

P2 关注点：审批两态与三支路（inline / followup / 销毁）、`planDispatch` 纯函数 + 槽位 `maxWorkers: 5`、`agent/created` 装饰（提示词 section + 工具 + `tools.restrict`）。

---

## 8. 未决问题

1. **路由会话的工作区目录**：现在是状态目录（自包含）。方案原文写「用户根目录」（好处：路由会话能直接读用户项目；代价：在用户既有工作区里多一个会话）。MVP 期间保持状态目录，改只需换 `ensureRouterSession` 的入参。
2. **冒烟会话与工单目录**是否清理（见 §6）。
3. **深色主题与窄宽度**下的面板观感未验证（无浏览器控制），P3 用宿主 token 细化时一起看。
4. **重启后中断收尾**未实测（需要重启桌面端）；P2/A5 会自然覆盖。

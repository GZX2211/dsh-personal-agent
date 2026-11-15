# Personal Agent — P0 冒烟验收报告

> **版本** v1.0　|　**日期** 2026-11-15　|　**结论** 4 项通过、1 项部分通过（重启收尾未实测）
>
> 验收对象：`dsh-personal-agent@0.1.0`（本地目录安装到 `desktop` profile，`application: applied`）。
> 方案依据：`docs/personal-agent-MVP开发方案.md` §13 P0 表。

---

## 1. 结论

| # | 验收项 | 结论 | 关键证据 |
|---|---|---|---|
| P0-1 | 右侧栏出现「总控台」tab，能打开、渲染、切 Tab | **通过** | 面板在浏览器内真实注册并被用户看到；六个标签页渲染 |
| P0-2 | 同源 `GET /personal-agent/api/health` 返回 200 | **通过** | 命令行 200 + 浏览器侧同源 GET 成功（面板底部「已连通」） |
| P0-3 | 工具可长时间阻塞且不被超时策略裁剪；重启后中断收尾正常 | **部分通过** | 65 s 真实阻塞未被裁剪；重启收尾只有源码级证据，未实测 |
| P0-4 | `pinSession` 让 router 会话出现在左栏固定区 | **通过（数据层）** | `storages/workspace.json` 的 `pinnedSessionIds` 含该会话；固定区视觉呈现属宿主既有能力，未单独取证 |
| P0-5 | 建 worker 会话 + `followup` 投递 + `rename` 全部生效 | **通过** | 会话日志：标题事件、工作目录变更、投递消息（含 source kind）、随后进入第一步 |

P0 的实质结论：**「右侧栏入口 + 同源通道 + 会话与投递 + 阻塞工具」这四条集成通道全部打通**，MVP 可以按方案进入 P1（数据层）。

---

## 2. 验证环境

| 项 | 值 |
|---|---|
| DSH 运行版本 | 0.2.2-rc.3（Desktop，`D:\dsh\resources\app.asar\dsh`） |
| profile | `desktop`（`C:\Users\GZX\.dsh\profiles\desktop`） |
| GUI | `http://127.0.0.1:52810`（页面需认证 cookie；插件路由不走该认证，自己在回环之上做同源校验） |
| 插件安装 | `plugin_manager install_bundle` → `application: applied`，包以目录链接方式装入 |
| 状态目录 | `C:\Users\GZX\.dsh\state\personal-agent` |
| 证据来源 | ① Client `Slots` 实时检查　② 同源 HTTP（命令行与浏览器各一路）　③ 会话持久化读句柄（`sessionPersistence.open`）　④ `storages/workspace.json`　⑤ 用户视觉确认 |

安装记录中的唯一告警与本次交付无关（`llm-deepseek-account` 的 `models` 配置项已被该版本废弃，属 profile 现有配置遗留）。

---

## 3. 逐项证据

### P0-1 右侧栏标签页

- 标签页类型注册（stage one）：`id = dsh-personal-agent/console`、`kind = personal-agent-console`、指南条目 `console`（order 10，中英双语标题与描述）。
- 面板正文注册（stage two）：`sidebar.right.pane.tab` 的 key = 同一个 `id`。
- 实时检查 `Slots.listSubTree('sidebar.right.pane.tab')` 的占用者列表末位出现：

  ```json
  { "registrant": "dsh-personal-agent", "key": "dsh-personal-agent/console", "active": true }
  ```

- 页面渲染：用户确认右侧栏出现「总控台」面板，六个标签页（概览/审批/工单/事件/来源/设置）齐全，其中四个未开放页显示「暂未开放」。
- 导航控制器：插件挂载后调用 `ctx.sidebarRight.openTab('personal-agent-console')` 成功（面板被真实打开，而非仅注册）。
- P0 复核后的界面修订（用户提出）：标签名定为「总控台」（插件名仍是「个人代理」）；面板内不再有标题与说明；六个标签改用宿主会话视图标签的度量与颜色（13px/500、32px 间距、选中项业务蓝 + 2px 底线、行高 38px、与宿主页头同一条 0.5px 分隔线）。标题额外注册到 `sidebar.right.pane.tab.title`，否则宿主沿用打开时捕获的文本，改名不会反映到已开标签。

### P0-2 同源 HTTP

- 命令行（无任何头）：

  ```json
  GET /personal-agent/api/health → 200
  {"ok":true,"plugin":"dsh-personal-agent","version":"0.1.0",
   "origin":"http://127.0.0.1:52810",
   "stateDir":"C:\\Users\\GZX\\.dsh\\state\\personal-agent","uptimeMs":4014}
  ```

- 守卫三条分支（同一进程内实测）：

  | 请求 | 结果 |
  |---|---|
  | 无自定义头 | `403 {"code":"missing-request-header"}` |
  | 带头 + `Origin: http://evil.example` | `403 {"code":"wrong-origin"}` |
  | 带头 + 同源 `Origin` 或同源 `Referer` | `200` |

- 浏览器侧：面板挂载后 `GET /personal-agent/api/health` 成功，底部状态行显示「面板通道已连通」——这是从真实页面、经真实同源策略发出的一路，比命令行更强。

### P0-3 阻塞工具

- 工具 `pa_smoke_block` **不声明 `timeoutMs`**。超时策略包 `@deepseek-ai/dsh-tool-call-timeout-policy` 自述：无配置项、每个工具自带期限、"every other tool is untouched"。
- 实测：模型侧调用 `pa_smoke_block{ms:65000}`，在宿主进程内阻塞 **65 秒** 后正常返回文本「阻塞 65000 ms 后返回」，`segment 17:07:20 → 17:08:31`。没有任何超时、中止或回合异常。
- 取消路径也已覆盖（单元级）：`AbortSignal` 触发时工具立即以错误结束，未留下悬挂 Promise。
- 重启收尾（未实测，代码级证据）：`dsh-agent-loop` 恢复会话时先 `interruptedTurnClosers(persisted)`，把缺失的工具结果补成合成 `tool/result`（`TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED`），再补 `step/end` 与 `turn/end{reason:{kind:'interrupted'}}`，通过同一写句柄追加。因此：
  - 会话日志在重启后依旧平衡（每条 tool call 都有结果）；
  - 阻塞中的 `pa_approval_submit` 不会留下"永远悬空"的调用记录。
- 为什么没实测：验证重启需要重启桌面端，本轮运行中的宿主进程无法自我重启。真正需要付出这次代价的场景（审批跨越重启）在 P2/A5，届时可以一次性验证。

### P0-4 路由会话置顶

- 激活时创建（或复用）路由会话：工作区「个人代理」→ 会话标题「个人代理 · 路由」→ `pinSession`。
- 会话身份落盘在 `state/personal-agent/router-session.json`，插件重载/进程重启后复用同一个会话，不在左栏堆出第二个置顶会话（本轮重载 3 次验证：先后两次 P0 调用得到同一个 `session-9c362864-…`）。
- `storages/workspace.json` 实测：

  ```json
  "global": { "pinnedSessionIds": ["session-9c362864-7019-408c-868c-2cf3e560408e"] }
  ```

  该 id 即路由会话（其会话目录为 `sessions/--C-Users-GZX-.dsh-state-personal-agent--/session-9c362864-…`，说明工作目录就是状态目录）。
- 左栏固定区的**视觉**呈现是宿主既有能力（我们只调用 `pinSession`），未单独截图取证。

### P0-5 执行会话 + 投递 + 重命名

第二次 P0 运行的一次调用内完成（`POST /dev/p0`）：

| 步子 | 结果 |
|---|---|
| `router-session` | 复用 `session-9c362864-…`（再次 pin 成功） |
| `worker-session` | 新建 `session-15f238a8-…`，工单 `t-d6e32ce95a`，目录 `state\personal-agent\work\t-d6e32ce95a` |
| `worker-delivery` | `delivered` |
| `worker-trace` | 19 条事件；标题 `工单 #d6e32c · 冒烟：通道验证`；`working-directory/change` 1 条；`user/message` 含 `id=pa-delivery:p0-delivery:t-d6e32ce95a, kind=dsh-personal-agent`；随后出现 `turn/start`、`step/start`、`request/header` |

即：**建会话、设工作目录、改名、投递、唤醒执行**五件事全部生效，且投递消息带稳定 id 与自己的 source kind（幂等与来源可辨的机制已就位）。

---

## 4. 未验证项

| 项 | 原因 | 何时补 |
|---|---|---|
| 重启后中断回合的收尾 | 需要重启宿主进程 | P2/A5（审批跨越重启的场景会自然覆盖） |
| 左栏固定区的视觉呈现 | 宿主既有能力，未截图 | 你下次看左栏时顺手确认 |
| 深色主题下的面板观感 | 无浏览器控制，无法切主题 | P3 UI 阶段用宿主 token 细化时一并看 |
| 面板在窄宽度下的排版 | 同上 | P3 |

---

## 5. P0 暴露的方案修订（已记入方案 §15）

1. **会话创建不接受「工作区 + 目录」同时给**（`session.create` 二选一）。因此执行会话的正确做法是：先在工作区里建会话，再用 `workingDirectory.set(agent, 工单目录)` 收窄目录。代价是会话日志里多一条 `working-directory/change` 与一条 `working-directory` 来源的消息——这是 DSH 的既定语义，不是副作用。
2. **插件产物可以在宿主里解析 DSH 运行时包**（实测 `@deepseek-ai/dsh-llm` 68 个导出、`dsh-tools` 25 个导出均可 `import`）。因此 P2 直接复用 `freezeMessage`/`MessageId`，P0 手写的深冻结实现退役；同时这也意味着运行时依赖 DSH 版本，`engines.dsh` 与 peer 版本必须跟着锁。
3. **路由会话的工作区目录**目前取状态目录（自包含、不占用户工作区）。方案原写"用户根目录"，需你确认取哪一个：取用户根目录能让路由会话读到用户项目，但会在用户的既有工作区里多一个会话。
4. **客户端半区改动需要刷新页面才生效**（无 `dev:web` 时没有重建推送）；Host 半区改动可用 `plugin_manager` 关→开触发重载并加载新代码。P1 起按这个节奏开发。
5. **`/health` 不设鉴权**（只回环、只暴露状态目录与版本）。状态与决定类端点一律要求自定义头 + 同源。P2 复核这条边界。

---

## 6. 遗留脚手架（P1 删除）

| 位置 | 内容 | 何时删 |
|---|---|---|
| `src/host/dev/smoke.ts` | `/dev/p0`、`/dev/state`、`/dev/beacon`、`pa_smoke_block` 工具、请求观测环形缓冲 | P1 建立账本与真实端点时 |
| `src/client/lib/dev-beacon.ts`、`src/client/entry.ts` 里的上报点 | 面板向上报事实的通道 | P3 真实数据源接入时 |
| `src/client/entry.ts` 的自动打开效果 | 首次挂载自动 `openTab` | P1 |
| `src/shared/api.ts` 的 `SmokeStep/SmokeReport/ObservedRequest/BeaconRecord` | 开发期契约 | 同上 |
| `state/personal-agent/work/t-*`、两个冒烟会话 | 冒烟产生的真实会话与目录 | 由我清理或保留作样本（待你定） |

---

## 7. 下一步

P1（数据层）：`EventStore`（append/重放/幂等 + 半行与重复 eventId 故障注入）、`project` 纯函数、`vitest` 单测；随后 P2 把 `pa_task_route` / `pa_approval_submit` 接到账本上。P1 结束时 `/dev/*` 全部退场，替换为 `/snapshot` 与 `/approvals/:id/decide`。

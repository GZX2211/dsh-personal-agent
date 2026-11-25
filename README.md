<p align="center">
  <!-- 配图占位：主界面总览，建议截取右侧栏「总控台」的「概览」页，能看到状态脉搏、注意力条、进行中列表与今日统计 -->
  <img src="" width="100%" />
</p>

<h1 align="center">dsh-gzx-agent</h1>

<p align="center">
  基于 <a href="https://github.com/deepseek-ai">DeepSeek Harness（DSH）</a> 打造的私人代理插件<br>
  路由会话派发工单，执行会话独立运转，审批不经转述直接呈现在你面前
</p>

<p align="center">
  <a href="README.en.md">English</a> · <b>简体中文</b>
</p>

<p align="center">
  <!-- 徽章口径：version 取 package.json 的 0.1.0；license 取 package.json 的 MIT；runtime 取 engines.node -->
  <a href="README.en.md"><img alt="语言" src="https://img.shields.io/badge/语言-简体中文-blue"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-lightgrey"></a>
  <a href="package.json"><img alt="version" src="https://img.shields.io/badge/version-0.1.0-0891b2"></a>
  <a href="package.json"><img alt="runtime" src="https://img.shields.io/badge/node-%5E22.19%20%7C%20%3E%3D24-green"></a>
</p>

---

## 项目定位

一个人同时盯多个执行会话、逐窗口点审批、追着问进度，注意力很快被切碎。DSH 本体把每个会话做成独立的事件日志，会话之间没有共享状态通道，跨会话的状态与审批因此无处安放。

**dsh-gzx-agent** 把任务状态与审批从概率层（模型）上提到一个独立的**确定性事件层**：左栏固定一个 **Router 会话**承接对话并派单，每件任务落到一个独立的 **Worker 会话**，需要人介入时由右侧栏的**总控台**呈现审批。状态与审批由总控台直接投影给用户，不经过 Router 转述，也不占用它的上下文预算。

```text
用户 ──对话──▶ Router 会话 ──派单──▶ L2 账本(append-only)
                                      │ 投影
                                      ▼
                              总控台 ◀──── 人（看状态 / 点审批）
                                      │ 派发 / 简报
                                      ▼
                              Worker 会话 ──提交审批──▶ L2 账本
```

开箱即用：无需额外服务，账本落在本地状态目录；Router 会话在首次启动时自动创建并复用。默认并行 5 个工单，模型继承 DSH 当前默认。

> 设计立场：账本是唯一事实来源，状态是事件的投影；配置是真源，执行是投影。

---

## 核心亮点

✦ **工单与审批没有 status 字段**
  - 阶段完全由账本事件序列派生，状态永远不会与账本冲突，可按序重放
  - 阶段由事件顺序而非墙钟决定，天然抗时钟回拨；写入按内容派生幂等键

✦ **审批门禁不经 Router 转述**
  - Worker 提交审批时阻塞等待，决定由总控台直接送达执行会话；会话已归档、仍阻塞、已停止三条路径分别处理
  - 「先送达、后记账」，重启时从会话日志自愈已送达但未记账的决定

✦ **感知来源把外部变化变成信号**
  - 支持内部事件、本地文件、脚本三种渠道，在对话中说一句「盯着……有变化就告诉我」即可创建
  - 过滤、去重、节流在账本落定前完成；来源可在面板里开关、测试、重启、删除

<!-- 每 2-3 个亮点后插一组配图 -->
<table>
  <tr>
    <td width="50%" valign="top"><!-- 配图占位：总控台「概览」页，展示注意力条与进行中列表 --><img src="" width="100%" /></td>
    <td width="50%" valign="top"><!-- 配图占位：总控台「审批」页，展示待审批卡片与选项 --><img src="" width="100%" /></td>
  </tr>
</table>

> 左侧是被动汇总的状态视图，右侧是唯一需要人动手的门禁——两者都不在 Router 的对话里呈现。

✦ **角色能力边界清晰**
  - Router 只拿派单与查询类工具，无法直接读写文件或执行命令；Worker 只拿审批提交工具
  - 所有技术工作隔离到工单会话，Router 的上下文预算留给意图理解与按需查账

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Router 会话** | 左栏固定置顶的对话入口，负责理解意图、派单与按需查询账本；身份持久化，重载时复用而非新建 |
| **Worker 会话** | 每个工单对应一个独立会话与工作目录；只在放行时创建，排队工单在左栏不留痕迹 |
| **Ticket（工单）** | 一次委派任务；无 status 字段，阶段 `queued / running / blocked / ended` 由事件序列派生，`blocked` 是 `running` 的副标签 |
| **Approval（审批）** | 需要人放行的动作门禁；决定为 `selected / answered / skipped`，送达方式为 `inline / followup`，附件由 Worker 提交、人只读 |
| **Signal（信号）** | 一次到达 Router 的输入，来源为 `user-message / timer / perception`；结局由同 id 的决定事件给出 |
| **L2 账本（Event）** | append-only 领域事件日志，唯一事实来源；事件携带 `seq / eventId / actor / correlationId / causationId / payload` |
| **Source（感知来源）** | 一个渠道加若干线程；渠道分 `host-event / fs-watch / script`，定义入账、运行时状态不落账 |
| **Dispatcher / Scheduler** | 把纯函数派单计划接到真实副作用；每轮只执行第一个动作，失败即停 |
| **Runtime（概览读模型）** | 只读账本与会话内存，派生 Worker 状态、上下文占用与近 7 天活动；不写账本 |
| **策略（Policy）** | 派单规则与决策权限；规则只进 Router 提示词，权限只进 Worker 提示词，共用同一版本号 |

---

## 工具与接口

Agent 可见工具按角色分配，Router 与 Worker 拿到的工具集不同：

| 工具 | 调用方 | 用途 |
|---|---|---|
| `pa_ticket_dispatch` | Router | 派单：新建执行会话或追加到已有 Worker |
| `pa_ticket_supplement` | Router | 向执行中工单补充一条事实 |
| `pa_ledger_query` | Router | 只读查询工单与审批进度 |
| `pa_source_create` / `pa_source_update` / `pa_source_toggle` / `pa_source_remove` | Router | 创建、修改、开关、删除感知来源 |
| `pa_approval_submit` | Worker | 提交审批并阻塞等待人的决定 |

总控台通过同源 HTTP 面（前缀 `/personal-agent/api`）读写状态，主要端点：`/snapshot`（一次刷新所需全部状态）、`/signals`（全量历史检索）、`/settings` 与 `/prompts`（设置与提示词版本）、`/tickets/:id`（工单调用链）、`/approvals/:id/decide`（提交决定）、`/sources/:id/*`（开关、测试、删除）。除 `/health` 外均做同源校验。详见 [架构文档](docs/architecture.md)。

---

## 📦 安装

> **版本适配**：本插件适配 **DeepSeek Harness `0.2.2-rc.5`及以上版本**。请先安装或升级宿主（升级前先在外部终端**完全停止 dsh 进程**）：
>
> tips：可直接将以下段落复制给 Claude Codex 等 AI 助手安装该插件。使用 web profile 时，把下文命令中的 `desktop` 换成 `web`。

> **包名说明**：本插件发布在 npm 上的包名是 `dsh-gzx-agent`（`dsh-personal-agent` 已被他人占用）；GitHub 仓库名仍为 `dsh-personal-agent`。

### 方式一：一键安装全部（推荐）

我们提供了一个聚合包，包含以下所有功能：
- `dsh-capability-manager`（能力管理器）
- `dsh-gzx-agent`（个人助手）
- `dsh-run-python`（Python 工作台）

在终端执行以下命令，即可一次性安装并配置所有插件：

**桌面端**（推荐点击插件页面直接输入包名安装）：

```
dsh-gzx-plugin
```
或
```bash
dsh plugin --profile desktop add dsh-gzx-plugin
```

---

### 方式二：按需单独安装

[能力管理器](https://github.com/GZX2211/dsh-capability-manager "如果你需要 meta_search 的 tool 按需召回功能，不妨了解一下")
```bash
dsh plugin add dsh-capability-manager
```

[个人助手](https://github.com/GZX2211/dsh-personal-agent "如果你需要一个能自己“主动”干活的助手，不妨了解一下（通常与另两个插件搭配使用，否则会缺失部分能力）")
```bash
dsh plugin add dsh-gzx-agent
```

[python 工作台](https://github.com/GZX2211/dsh-run-python "如果你需要一个能直接执行 Python 代码并逐 cell 维持内核状态的工具，不妨了解一下")
```bash
dsh plugin add dsh-run-python
```

### 卸载

```bash
dsh plugin --profile desktop remove dsh-gzx-agent
```

> 卸载只移除插件挂载，状态目录（账本、设置、工单工作目录）会保留，便于日后重装恢复；如需彻底清理，请手动删除该状态目录。

---

## 快速开始

- 了解项目架构？请看 [架构文档](docs/architecture.md)
- 参与贡献？请看 [贡献](docs/CONTRIBUTING.md)
- 了解如何使用？请看 [用户使用手册](docs/USER_GUIDE.md)
- 二次开发？请看 [项目开发规范](AGENTS.md)
- 安装与概览？本文件 [README.md](README.md)

---

## 数据存储

状态目录默认 `<DSH_HOME>/state/personal-agent`（无 `DSH_HOME` 时为 `~/.dsh/state/personal-agent`），可用 bundle 的 `stateDir` 配置覆盖。

```text
<state>/personal-agent/
├── events.jsonl          # append-only L2 账本，唯一事实来源（幂等、重放、fsync）
├── kv.json               # 技术元数据：Router 会话身份、感知去重状态
├── settings.json         # 执行器配置、派单规则、决策权限（revision 乐观锁）
├── prompt-history.jsonl  # 提示词版本，只追加不可变
├── work/<ticketId>/      # 每个工单隔离的工作目录
└── perception/<sourceId>/# script 渠道的脚本正文
```

> 会话的 L1 事件日志由 DSH 本体管理，不在此目录、也不双写。信号与回合的配对关系、阻塞中的审批 resolver、来源运行时状态只在内存中，重启后由账本重建或如实显示未结算，不落盘。

---

## 本地开发

```bash
git clone https://github.com/GZX2211/dsh-personal-agent.git
cd dsh-personal-agent
pnpm install
pnpm build
pnpm check
```

常用命令：

```bash
pnpm build       # tsdown 打包并包裹客户端产物
pnpm typecheck   # TypeScript 类型检查
pnpm test        # 运行 vitest 测试
pnpm check       # 依次执行 typecheck、test、build
```

> 改动 `src/` 后需重新 `pnpm build` 更新 `lib/` 产物再重载插件；HMR 热的是配置，不是源码。界面文案改动需同步 `zh` / `en` 两份词典。

---

## 已知限制

| 项 | 说明 |
|---|---|
| 投递幂等仅本进程 | 重启后 inbox 为空，同一请求可能重复投递一次；跨进程去重未实现 |
| 信号配对重启即丢 | 已投递未结算的信号停在待处理，事件页如实显示，不做自动收口 |
| 信号快照上限 | 快照最多带最近 200 条信号，更早历史走 `/signals` 查询（单次 1–500） |
| 工单详情读取上限 | 单次最多读 8 个会话、每会话 3000 条日志，超出取尾部并标记不完整 |
| 定时来源只读 | 定时任务由宿主自动化页拥有，本插件只翻译投递，不创建也不修改 |
| 面板内不能派单 | 派单与补充是 Agent-facing 工具，总控台工单页只读；不能编辑审批题干、选项或附件 |
| 提示词恢复需再保存 | 历史版本「载入编辑器」不会立即生效，仍需点「保存」 |
| 能力管理页未实现 | 工具 / skill / MCP 的管理页为占位，非 MVP 范围 |

后续规划见项目 Issue。

---

## 许可

[MIT](LICENSE) © HHH。欢迎提 Issue / PR。

# 感知来源（perception-source）

当用户说「盯着某个东西」「有变化就告诉我」「监控一下」「自动关注」时，用这套工具为他建立一个**感知来源**：它会在你不在场时把外部发生的事实时推给你，不消耗模型调用。

## 先判断该用哪种渠道

| 盯什么 | 渠道 | 说明 |
|---|---|---|
| 内部状态：工单、审批、其它账本事件 | `host-event` | 订阅账本事件，零开销 |
| 本地文件或目录变化 | `fs-watch` | 系统原生文件监听 |
| 外部服务 / 任意协议（HTTP、进程、socket） | `script` | 你写一个常驻脚本，它按行输出 JSON |

拿不准时先问用户：他关心的是本机文件、还是某个外部系统？

## 线程：一个来源可以有多条线程

线程是**分类与过滤的粒度**。例如「线上日志」来源可以有两个线程：`errors`（只报错误）与 `deploys`（只报发布）。线程关掉就彻底安静，连记录都不留。

每条线程包含：

- `id`、`name`：给人看的名字。
- `enabled`：建的时候一般给 `true`。
- `match`（可选）：确定性筛选，见下。
- `dedupe`：`externalId`（默认，按渠道给的去重键）/ `statement` / `none`。
- `minGapSec`：同一线程两条投递之间的最小间隔，默认 0。
- `mode`：`level`（默认，每次都报）或 `edge`（只在状态变化时报）。
- `interrupt`：`true` 时插到当前回合的下一步，而不是排队。

## match 语法

```json
{ "path": "payload.outcome", "op": "eq", "value": "failed" }
```

- `path` 用点路径取值，可用渠道提供的字段（如 fs-watch 的 `event`、`name`、`path`、`size`，host-event 的 `type`、`payload.*`）。
- `op`：`eq` `neq` `contains` `startsWith` `endsWith` `regex` `in` `gt` `lt`。
- 组合：`{ "all": [...] }` / `{ "any": [...] }` / `{ "not": {...} }`。

**match 只做确定性筛选**。不要试图用它表达「这条重要吗」——那由你在收到事件后判断。

## statement：事实而已

`statement` 是投递给你的那句话，会被填进主题模板。要求：

- 一句话陈述事实：`配置文件 app.yml 被修改`
- 可用占位符：host-event 用 `{type}`、`{payload.xxx}`；fs-watch 用 `{event}`、`{path}`、`{name}`、`{dir}`。
- **不要写行动指令**：不要写「请立刻处理」「需要你决定」。你收到事实后自己判断要不要动。

## script 渠道的协议

脚本由 Host 写入状态目录，`args` 里的 `{script}` 会被替换成脚本绝对路径。

- 每行输出一条 JSON：`{"thread":"errors","statement":"服务返回 500","externalId":"2026-11-19T12:00","state":"down"}`
- 必填 `thread`（必须是来源里已有的线程 id）与 `statement`；`externalId` 缺省用陈述的哈希。
- 只往 **stdout** 写事实；诊断信息写 stderr（会进日志）。
- 每秒最多 100 行，单行最长 16 KiB。
- 非零退出会按 `on-failure` 指数退避重启，连续 10 次失败停手。

Node 最小模板：

```js
setInterval(async () => {
  try {
    const response = await fetch('https://example.com/health')
    console.log(JSON.stringify({
      thread: 'errors',
      statement: `健康检查返回 ${response.status}`,
      externalId: `status:${response.status}`,
      state: String(response.status),
    }))
  } catch (error) {
    console.log(JSON.stringify({ thread: 'errors', statement: `请求失败：${error.message}` }))
  }
}, 60_000)
```

pwsh 最小模板：

```powershell
while ($true) {
  $item = Get-Content 'D:\proj\build\result.json' -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
  if ($item) {
    @{ thread = 'build'; statement = "构建结果：$($item.status)"; externalId = "$($item.id)"; state = "$($item.status)" } |
      ConvertTo-Json -Compress
  }
  Start-Sleep -Seconds 30
}
```

## 噪音控制

- 优先用 `externalId` 去重与 `minGapSec` 节流，不要靠宽泛的 match 硬筛。
- 变化不频繁、只关心状态翻转的，用 `edge`。
- 一条 fs-watch 事件会为**每个线程**各产一条候选，所以线程之间的 match 要写清楚，否则一条变化会触发多条。

## 建完要告诉用户

- 来源名称与它在盯什么。
- 什么情况下会触发。
- 怎么关：在「来源」页关掉，或者直接跟你说。

## 反例

- 把任务指令写进 `statement`（例如「请检查并修复」）——事实层不该有指令。
- 把 `match` 写得过宽（例如只写 `{ "path": "text", "op": "contains", "value": "" }`）。
- 在脚本里做长时间的阻塞判断或重活：脚本只负责**发现事实**，动手是你的工单。
- 一条线程覆盖所有情况：想办法按类别拆开，用户才能只关掉吵人的那一条。

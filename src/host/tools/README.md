# Tools Module Rules

## 范围与职责

适用于 `src/host/tools/`。

负责将 Host 能力暴露为 Agent-facing Tools，并维护 Tool 基础设施：Tool 定义、参数与输出 Schema、调用方校验、Host 能力调用、输出渲染、可见性。

## 目录与分类

- 按工具能力组织，文件夹按工具名命名：如：`pa_approval_submit/`。
- `infrastructure/` 放 Tool 基础设施。

## Tool 文件职责

标准入口为 `tool.ts`，负责：注册、参数 Schema、description、调用方身份校验、调用 Host capability、输出结果。

不要把大型业务算法堆进 `tool.ts`。复杂 Tool 应拆分：

```text
tool.ts       Tool-facing adapter
apply.ts      纯变换 / 应用逻辑
types.ts      类型与契约
service.ts    业务服务
driver.ts     外部资源驱动
policy.ts     安全 / 规则策略
```

## Tool 之间解耦

一个 Tool 不得通过另一个 Tool 的注册函数或执行函数完成业务。

错误：`runNodeTool.execute(...)`

正确：

```text
Tool A → Host capability / service ← Tool B
```

多个 Tool 共享逻辑时，应将逻辑提升到合适的 Host 模块。

## Tool 契约

- 模型可见输出应稳定、紧凑、可预测；输出序列化只有一处实现，业务 Tool 不得重复实现渲染；
- Tool description 须回答：何时调用？调用前需要什么？失败时会发生什么？是否产生副作用？描述应简短、简洁、无歧义。

## description 写作规范（中文）

写作顺序（与官方 `packages/fs/tool-fs` 一致）：

1. **第一句 = 何时调用**（触发条件 + 做什么），不超过一句、直陈式。
2. **前置条件**：调用前必须满足的对象/状态。
3. **失败语义**：超时 / 拒绝 / 护栏错误 / 未找到等失败时的结果。
4. **副作用**（如适用）：阻塞 / 插队 / 持久化 / 覆盖等。

## 错误处理

稳定错误使用项目已有错误体系和稳定错误码。错误信息应帮助 Agent 修正调用，明确：什么失败、哪个参数 / 状态导致失败、是否可修正后重试。不得吞掉业务错误并返回成功。
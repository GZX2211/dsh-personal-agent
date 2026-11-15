// src/host/approvals/resolvers.ts
//
// 正在阻塞的审批工具登记表。它把「服务端决定」和「工具侧确认已返回」接起来：
// 决定先送达工具，等工具 acknowledge 之后，调用方才写 approval/decided
// （方案 §6.2 的三支路之一：inline）。

import type { ApprovalDecision } from '../../shared/approvals.ts'

/** 一次送达：决定内容与落账时间。 */
export interface ApprovalDelivery {
  decision: ApprovalDecision
  decidedAt: number
}

/** 工具侧收到的决定因回合中止而失效。 */
export class ApprovalCancelledError extends Error {
  constructor() {
    super('approval wait was cancelled')
    this.name = 'ApprovalCancelledError'
  }
}

export interface PendingResolver {
  readonly approvalId: string
  /** 工具侧等待的决定；被取消时 reject `ApprovalCancelledError`。 */
  readonly decision: Promise<ApprovalDelivery>
  /**
   * 服务侧送达决定，并等到工具确认已收到。
   * @returns `false` 表示工具已中止、这一条不能走 inline（调用方应改走 followup）。
   */
  deliver(delivery: ApprovalDelivery): Promise<boolean>
  /** 工具侧确认已收到决定（随后可以离开阻塞）。 */
  acknowledge(): void
  /** 回合中止：让等待方立刻失败，并移出登记表。 */
  cancel(): void
}

interface ResolverState {
  delivered: boolean
  cancelled: boolean
  settled: boolean
  decision: Promise<ApprovalDelivery>
  acknowledgement: Promise<void>
  resolveDecision: (delivery: ApprovalDelivery) => void
  rejectDecision: (error: Error) => void
  resolveAcknowledgement: () => void
}

export class ResolverRegistry {
  readonly #entries = new Map<string, PendingResolver>()

  /** 登记一个正在阻塞的审批；同一 approvalId 重复登记是编程错误。 */
  create(approvalId: string): PendingResolver {
    if (this.#entries.has(approvalId)) {
      throw new Error(`approval ${approvalId} already has a pending resolver`)
    }
    const state = createState()

    const resolver: PendingResolver = {
      approvalId,
      decision: state.decision,
      deliver: async delivery => {
        if (state.cancelled) return false
        if (!state.delivered) {
          state.delivered = true
          state.resolveDecision(delivery)
        }
        await state.acknowledgement
        // 工具确认后，这一条不再可能被 inline 送达。
        this.#entries.delete(approvalId)
        return true
      },
      acknowledge: () => {
        if (state.settled) return
        state.settled = true
        state.resolveAcknowledgement()
      },
      cancel: () => {
        if (state.delivered || state.settled) return
        state.cancelled = true
        state.settled = true
        state.rejectDecision(new ApprovalCancelledError())
        state.resolveAcknowledgement()
        this.#entries.delete(approvalId)
      },
    }

    this.#entries.set(approvalId, resolver)
    return resolver
  }

  find(approvalId: string): PendingResolver | undefined {
    return this.#entries.get(approvalId)
  }

  remove(approvalId: string): void {
    this.#entries.delete(approvalId)
  }
}

function createState(): ResolverState {
  let resolveDecision!: (delivery: ApprovalDelivery) => void
  let rejectDecision!: (error: Error) => void
  let resolveAcknowledgement!: () => void
  const decision = new Promise<ApprovalDelivery>((resolve, reject) => {
    resolveDecision = resolve
    rejectDecision = reject
  })
  const acknowledgement = new Promise<void>(resolve => {
    resolveAcknowledgement = resolve
  })
  // 取消时 acknowledgement 也会兑现，避免 deliver 的等待悬挂。
  return {
    delivered: false,
    cancelled: false,
    settled: false,
    decision,
    acknowledgement,
    resolveDecision,
    rejectDecision,
    resolveAcknowledgement,
  }
}

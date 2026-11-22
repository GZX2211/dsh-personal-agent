// tests/client/lib/http.test.ts
//
// 网络边界：详情请求走共享路径契约，404 以稳定错误码交给页面处理。

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ERROR_CODES } from '../../../src/shared/api.ts'
import type { TicketDetailResponse } from '../../../src/shared/ticket-detail.ts'
import { fetchTicketDetail } from '../../../src/client/lib/http.ts'

const DETAIL = { ticket: { id: 't-1' } } as unknown as TicketDetailResponse

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchTicketDetail', () => {
  it('reads the shared detail path with the request header', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(DETAIL), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const detail = await fetchTicketDetail('t-1')

    expect(detail).toEqual(DETAIL)
    expect(fetchMock).toHaveBeenCalledWith(
      '/personal-agent/api/tickets/t-1',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    )
  })

  it('turns a missing ticket into the stable error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, code: ERROR_CODES.ticketNotFound, message: 'gone' }), {
          status: 404,
        }),
      ),
    )

    await expect(fetchTicketDetail('t-missing')).rejects.toMatchObject({
      name: 'ApiError',
      code: ERROR_CODES.ticketNotFound,
      status: 404,
    })
  })
})

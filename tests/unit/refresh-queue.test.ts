// @ts-ignore - ESM Jest globals are available at runtime in the test environment.
import { jest } from '@jest/globals'
import type { AccountCredentials } from '../../src/types.js'

const esmJest = jest as typeof jest & {
  unstable_mockModule: (moduleName: string, factory: () => Record<string, unknown>) => void
}

const refreshRateLimitsForAccount = jest.fn()
const updateAccount = jest.fn()
const logInfo = jest.fn()
const logWarn = jest.fn()

esmJest.unstable_mockModule('../../src/limits-refresh.js', () => ({
  refreshRateLimitsForAccount
}))

esmJest.unstable_mockModule('../../src/store.js', () => ({
  updateAccount
}))

esmJest.unstable_mockModule('../../src/logger.js', () => ({
  logInfo,
  logWarn
}))

let startRefreshQueue: typeof import('../../src/refresh-queue.js').startRefreshQueue
let getRefreshQueueState: typeof import('../../src/refresh-queue.js').getRefreshQueueState

const accounts: AccountCredentials[] = Array.from({ length: 5 }, (_, index) => ({
  alias: `acc-${index + 1}`,
  accessToken: `access-${index + 1}`,
  refreshToken: `refresh-${index + 1}`,
  expiresAt: Date.now() + 60_000,
  usageCount: 0
}))

async function waitForQueueToFinish(): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (getRefreshQueueState()?.running === false) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Queue did not finish in time')
}

beforeAll(async () => {
  ;({ startRefreshQueue, getRefreshQueueState } = await import('../../src/refresh-queue.js'))
})

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.OPENCODE_MULTI_AUTH_REFRESH_QUEUE_CONCURRENCY
})

describe('refresh queue concurrency', () => {
  it('runs limit refreshes in parallel with a bounded concurrency cap', async () => {
    process.env.OPENCODE_MULTI_AUTH_REFRESH_QUEUE_CONCURRENCY = '2'

    let running = 0
    let maxRunning = 0
    refreshRateLimitsForAccount.mockImplementation(async (account: AccountCredentials) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 30))
      running -= 1
      return { alias: account.alias, updated: true }
    })

    const queue = startRefreshQueue(accounts)
    expect(queue.concurrency).toBe(2)

    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(getRefreshQueueState()?.currentAliases.length).toBe(2)

    await waitForQueueToFinish()

    const finalQueue = getRefreshQueueState()
    expect(maxRunning).toBe(2)
    expect(finalQueue).toEqual(
      expect.objectContaining({
        running: false,
        total: 5,
        completed: 5,
        errors: 0,
        active: 0,
        currentAliases: []
      })
    )
    expect(refreshRateLimitsForAccount).toHaveBeenCalledTimes(5)
  })

  it('caps requested concurrency at 20 workers', async () => {
    process.env.OPENCODE_MULTI_AUTH_REFRESH_QUEUE_CONCURRENCY = '99'
    refreshRateLimitsForAccount.mockResolvedValue({ alias: 'acc-1', updated: true })
    const manyAccounts: AccountCredentials[] = Array.from({ length: 30 }, (_, index) => ({
      alias: `bulk-${index + 1}`,
      accessToken: `access-bulk-${index + 1}`,
      refreshToken: `refresh-bulk-${index + 1}`,
      expiresAt: Date.now() + 60_000,
      usageCount: 0
    }))

    const queue = startRefreshQueue(manyAccounts)
    await waitForQueueToFinish()

    expect(queue.concurrency).toBe(20)
  })
})

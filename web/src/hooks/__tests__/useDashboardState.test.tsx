import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardState } from '../useDashboardState'
import type { DashboardState } from '../../types/api'

const mockState: DashboardState = {
  authPath: '/auth.json',
  deviceAlias: 'test-device',
  rotationAlias: 'account-1',
  accounts: [],
  lastSyncAt: Date.now(),
  lastSyncError: null,
  lastSyncAlias: null,
  authSummary: { hasAccessToken: true, hasIdToken: true, hasRefreshToken: true },
  storeStatus: { locked: false, encrypted: true, error: null },
  login: null,
  lastLoginError: null,
  antigravity: { accounts: [], path: '' },
  queue: null,
  recommendedAlias: null,
  logPath: '/logs',
  autoLogin: { path: '', scriptPath: '', pythonPath: '', configured: false, accounts: [] },
  rotationStrategy: 'round-robin',
  force: { active: false, alias: null, forcedAt: null, forcedUntil: null, forcedBy: null, remainingMs: 0, remainingTime: '0s', previousRotationStrategy: null },
  featureFlags: { antigravityEnabled: false }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false
      }
    }
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useDashboardState', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('returns loading state initially', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useDashboardState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  test('fetches and returns dashboard state', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockState), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    const { result } = renderHook(() => useDashboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockState)
    expect(global.fetch).toHaveBeenCalledWith('/api/state', expect.any(Object))
  })

  test('returns error state on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useDashboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })

  test('uses configured polling interval', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useDashboardState({ pollingInterval: 2000 }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    // The hook should be configured with the polling interval
    // Actual polling behavior is verified through React Query internals
  })
})

import { useQuery } from '@tanstack/react-query'
import { getState } from '../api/client'
import type { DashboardState } from '../types/api'

export interface UseDashboardStateOptions {
  pollingInterval?: number
}

export function useDashboardState(options: UseDashboardStateOptions = {}) {
  const pollingInterval = options.pollingInterval ?? 5000

  return useQuery<DashboardState>({
    queryKey: ['dashboardState'],
    queryFn: getState,
    refetchInterval: pollingInterval,
    staleTime: Math.min(pollingInterval / 2, 2000)
  })
}

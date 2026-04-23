import MultiAuthPlugin from '../../src/index.js'

describe('notifications', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('keeps idle notification handling non-blocking', async () => {
    process.env.OPENCODE_MULTI_AUTH_NOTIFY = '1'

    let sessionGetCalls = 0
    const sessionGet = () => {
      sessionGetCalls++
      return new Promise(() => {})
    }
    const hooks = await MultiAuthPlugin({
      client: {
        session: {
          get: sessionGet
        }
      },
      $: (() => ({ nothrow: () => ({ catch: () => undefined }) })) as any,
      serverUrl: new URL('http://localhost:3000'),
      project: { id: 'test' },
      directory: '/tmp'
    } as any)

    await hooks.event?.({
      event: {
        type: 'session.status',
        properties: {
          sessionID: 'ses_test',
          status: { type: 'busy' }
        }
      } as any
    })

    const started = Date.now()
    await hooks.event?.({
      event: {
        type: 'session.idle',
        properties: {
          sessionID: 'ses_test'
        }
      } as any
    })

    expect(Date.now() - started).toBeLessThan(100)
    expect(sessionGetCalls).toBe(0)
  })
})

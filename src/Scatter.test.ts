import { Chain, RpcEndpoint, UALErrorType } from 'universal-authenticator-library'
import ScatterJS from 'scatterjs-core'
import { Name } from './interfaces'
import { Scatter } from './Scatter'
import { UALScatterError } from './UALScatterError'

declare var window: any

jest.mock('scatterjs-core')

const endpoint: RpcEndpoint = {
  protocol: 'https',
  host: 'example.com',
  port: 443,
}

const chain: Chain = {
  chainId: '1234567890',
  rpcEndpoints: [endpoint]
}

const chains = [chain]

const account: any = {
  publicKey: 'EOS11111',
  name: 'test.account',
}

// Make userAgent mutable for testing
Object.defineProperty(window.navigator, 'userAgent', ((_value) => {
  return {
    get: () => _value,
    set: (v) => {
      _value = v
    }
  }
})(window.navigator.userAgent))

describe('Scatter', () => {
  let api: any
  let scatter: any

  beforeEach(() => {
    api = {}
    scatter = {
      eos: jest.fn().mockImplementation(() => api),
      connect: jest.fn().mockImplementation(() => true),
      getIdentity: null,
    }
  })

  describe('shouldRender', () => {
    it('returns true in tests (because its not mobile)', async () => {
      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })

      expect(scatterAuth.shouldRender()).toBe(true)
    })

    it('returns false if it is on mobile', async () => {
      ScatterJS.scatter = scatter

      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })
      scatterAuth.isMobile = () => true

      expect(scatterAuth.shouldRender()).toBe(false)
    })

    it('returns false if it is within an embedded browser', () => {
      ScatterJS.scatter = scatter

      window.navigator.userAgent = 'EOSLynx Ios'
      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })

      expect(scatterAuth.shouldRender()).toBe(false)
    })
  })

  describe('logout', () => {
    it('throws an error on failure', async () => {
      const identity = { accounts: [account] }
      scatter.getIdentity = jest.fn().mockImplementation(async () => identity)
      scatter.logout = jest.fn().mockImplementation(() => { throw new Error('Error in logout') })
      ScatterJS.scatter = scatter

      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })
      await scatterAuth.init()

      let didThrow = true

      try {
        await scatterAuth.logout()
        didThrow = false
      } catch (e) {
        const ex = e as UALScatterError
        expect(scatter.connect).toBeCalled()
        expect(ex.source).toEqual(Name)
        expect(ex.type).toEqual(UALErrorType.Logout)
        expect(ex.cause).toEqual(new Error('Error in logout'))
      }

      expect(didThrow).toBe(true)
    })
  })

  describe('login', () => {
    it('should return a user per chain', async () => {
      const identity = { accounts: [account] }
      scatter.getIdentity = jest.fn().mockImplementation(async () => identity)
      ScatterJS.scatter = scatter

      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })
      await scatterAuth.init()

      const users = await scatterAuth.login()
      expect(users.length).toEqual(chains.length)
      await expect(users[0].getAccountName()).resolves.toEqual(account.name)
    })

    it('clears user array on every login attempt', async () => {
      const identity = { accounts: [account] }
      scatter.getIdentity = jest.fn().mockImplementation(async () => identity)
      ScatterJS.scatter = scatter

      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })
      await scatterAuth.init()

      await scatterAuth.login()
      const users = await scatterAuth.login()
      // Ensure we're not pushing duplicates
      expect(users.length).toEqual(chains.length)
    })

    it('throws an error on failure', async () => {
      scatter.getIdentity = jest.fn().mockImplementation(async () => { throw new Error('Error in getIdentity') })
      ScatterJS.scatter = scatter

      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      let didThrow = true

      try {
        await scatterAuth.login()
        didThrow = false
      } catch (e) {
        const ex = e as UALScatterError
        expect(scatter.getIdentity).toBeCalled()
        expect(ex.source).toEqual(Name)
        expect(ex.type).toEqual(UALErrorType.Login)
        expect(ex.cause!.message).toEqual('Unable load user\'s identity')
      }

      expect(didThrow).toBe(true)
    })
  })

  describe('isLoading', () => {
    it('is false when authenticator is not initialized', () => {
      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter(chains, { appName: 'testdapp' })

      expect(scatterAuth.isLoading()).toBe(false)
    })

    it('is true while authenticator is initializing, and transitions when done', () => {
      scatter.connect = () => {
        return new Promise(() => { return })
      }

      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      scatterAuth.init()

      expect(scatterAuth.isLoading()).toBe(true)
    })

    it('is false when authenticator is initialized', async () => {
      ScatterJS.scatter = scatter

      ScatterJS.scatter.connect = jest.fn().mockImplementation()
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      expect(scatterAuth.isLoading()).toBe(false)
    })
  })

  describe('init errored', () => {
    it('not when no error is set', async () => {
      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      expect(scatterAuth.isErrored()).toBe(false)
    })

    it('errored when scatter init fails', async () => {
      scatter.connect = () => {
        return Promise.resolve(false)
      }

      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      expect(scatterAuth.isErrored()).toBe(true)
    })

    it('sets error', async () => {
      scatter.connect = () => {
        return Promise.resolve(false)
      }

      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      expect(scatterAuth.getError()).not.toBe(null)
    })

    it('does not set when none exists', async () => {
      ScatterJS.scatter = scatter
      const scatterAuth = new Scatter([chain], { appName: 'testdapp' })
      await scatterAuth.init()

      expect(scatterAuth.getError()).toBe(null)
    })
  })
})

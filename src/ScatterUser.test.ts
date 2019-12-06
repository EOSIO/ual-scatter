import { Chain, RpcEndpoint, UALError, UALErrorType } from 'universal-authenticator-library'
import { ScatterUser } from './ScatterUser'

const endpoint: RpcEndpoint = {
  protocol: 'https',
  host: 'example.com',
  port: 443,
}

const chain: Chain = {
  chainId: '1234567890',
  rpcEndpoints: [endpoint]
}

const api: any = {}
const scatter: any = {
  eos: jest.fn().mockImplementation(() => api),
  authenticate: jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
      resolve(signatureValue)
    })
  })
}

const challenges = ['12345678', '87654321']
const signatureValue = 'SIG_K1_HKkqi3zray76i63ZQwAHWMjoLk3wTa1ajZWPcUnrhgmSWQYEHDJsxkny6VDTWEmVdfktxpGoTA81qe6QuCrDmazeQndmxh'
const publicKeys = ['PUB_K1_6WX7Zxez6WRAWkr8YW5tVKfYyMF2yb8D5tPKPDLKChNYNs3HSq', 'PUB_K1_8aBcRwL2xrEGQNShB6SyUszUxATXZFDyEza4vGypUJtHBdNeDa']

describe('ScatterUser', () => {
  let user

  beforeEach(() => {
    user = new ScatterUser(chain, scatter)
  })

  describe('getAccountName', () => {
    it('throws an error on getIdentity failure', async () => {
      scatter.getIdentity = jest.fn().mockImplementation(() => { throw new Error('Error in getIdentity')})
      let didThrow = true

      try {
        await user.getAccountName()
        didThrow = false
      } catch (e) {
        const ex = e as UALError
        expect(scatter.getIdentity).toBeCalled()
        expect(ex.message).toEqual('Unable load user\'s identity')
        expect(ex.source).toEqual('Scatter')
        expect(ex.type).toEqual(UALErrorType.DataRequest)
        expect(ex.cause).toEqual(new Error('Error in getIdentity'))
      }

      expect(didThrow).toBe(true)
    })
  })

  describe('signTransaction', () => {
    it('performs the transaction', async () => {
      api.transact = jest.fn().mockImplementation((transaction) => transaction)
      const actualTransaction = {
        transaction_id: '123456789',
        processed: {
          receipt: {
            status: 'OK'
          }
        }
      }
      const expectedResponse = {
        wasBroadcast: true,
        transactionId: actualTransaction.transaction_id,
        status: actualTransaction.processed.receipt.status,
        transaction: actualTransaction,
      }

      const response = await user.signTransaction(actualTransaction, {})
      expect(response).toEqual(expectedResponse)
    })

    it('throws an error on failed transaction', async () => {
      api.transact = jest.fn().mockImplementation(() => { throw new Error('Unable to transact') })
      try {
        await user.signTransaction({}, {})
      } catch (e) {
        const ex = e as UALError
        expect(ex.source).toEqual('Scatter')
        expect(ex.type).toEqual(UALErrorType.Signing)
        expect(ex.cause).not.toBeNull()
      }
    })
  })

  describe('verifyKeyOwnership', () => {
    it('should reject promise with an error if timeout is reached', async () => {
      user.authenticate = jest.fn().mockImplementation((challenge, resolve) => {
        jest.runOnlyPendingTimers();
        setTimeout(() => {
          resolve(challenge)
        })
      })
      jest.useFakeTimers();

      await expect(user.verifyKeyOwnership(challenges[0])).rejects.toThrow()

      expect(user.authenticate).toHaveBeenCalledTimes(1)
    })

    it('should execute properly without an error if timeout is not reached', async () => {
      user.authenticate = jest.fn().mockImplementation((challenge, resolve) => {
        resolve(challenge)
      })

      const result = await user.verifyKeyOwnership(challenges[0])

      expect(result).toBe(challenges[0])
      expect(user.authenticate).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPublicKey', () => {
    it('should be able to get public key from challenge and signature passed in', () => {
      const result = user.getPublicKey(challenges[0], signatureValue)

      expect(result).toBe(publicKeys[0])
    })

    it('should be able to get public key from a different challenge and signature passed in', () => {
      const result = user.getPublicKey(challenges[1], signatureValue)

      expect(result).toBe(publicKeys[1])
    })
  })

  describe('authenticate', () => {
    it('should resolve promise unsuccessfully when no keys associated with user', () => {
      user.getPublicKey = jest.fn().mockImplementation(() => {
        return publicKeys[0]
      })
      user.getKeys = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            resolve([])
        })
      })
      const callback = function(resolvedValue) {
        expect(resolvedValue).toBeFalsy()
      }

      user.authenticate(challenges[0], callback)
    })

    it('should resolve promise unsuccessfully when publicKey is not in list of keys', () => {
      user.getPublicKey = jest.fn().mockImplementation(() => {
        return publicKeys[0]
      })
      user.getKeys = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            resolve([publicKeys[1]])
        })
      })
      const callback = function(resolvedValue) {
        expect(resolvedValue).toBeFalsy()
      }

      user.authenticate(challenges[0], callback)
    })

    it('should resolve promise successfully when publicKey is in list of keys', () => {
      user.getPublicKey = jest.fn().mockImplementation(() => {
        return publicKeys[0]
      })
      user.getKeys = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            resolve([publicKeys[0]])
        })
      })
      const callback = function(resolvedValue) {
        expect(resolvedValue).toBeTruthy()
      }

      user.authenticate(challenges[0], callback)
    })
  })
})

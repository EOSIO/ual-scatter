import { ec as EC } from 'elliptic'
import { Chain, RpcEndpoint, UALError, UALErrorType } from 'universal-authenticator-library'
import { ScatterUser } from './ScatterUser'
import { Signature, PrivateKey } from 'eosjs/dist/eosjs-jssig'
import { KeyType } from 'eosjs/dist/eosjs-numeric'

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
const privateKeys = [
  '5Juww5SS6aLWxopXBAWzwqrwadiZKz7XpKAiktXTKcfBGi1DWg8',
  '5JnHjSFwe4r7xyqAUAaVs51G7HmzE86DWGa3VAA5VvQriGYnSUr',
  '5K4XZH5XR2By7Q5KTcZnPAmUMU5yjUNBdoKzzXyrLfmiEZJqoKE'
]
const signatureValue = 'SIG_K1_HKkqi3zray76i63ZQwAHWMjoLk3wTa1ajZWPcUnrhgmSWQYEHDJsxkny6VDTWEmVdfktxpGoTA81qe6QuCrDmazeQndmxh'
const publicKeys = ['PUB_K1_7tgwU6E7pAUQJgqEJt66Yi8cWvanTUW8ZfBjeXeJBQvhYTBFvY', 'PUB_K1_8aBcRwL2xrEGQNShB6SyUszUxATXZFDyEza4vGypUJtHBdNeDa']

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
        jest.runOnlyPendingTimers()
        setTimeout(() => {
          resolve(challenge)
        })
      })
      jest.useFakeTimers()

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
    it('should be able to get public key from signature', () => {
      const ec = new EC('secp256k1')
      const KPriv = privateKeys[0]
      const KPrivElliptic = PrivateKey.fromString(KPriv).toElliptic()

      const dataAsString = 'some string'
      const ellipticHashedString = ec.hash().update(dataAsString).digest()

      const ellipticSig = KPrivElliptic.sign(ellipticHashedString)
      const ellipticSigString = Signature.fromElliptic(ellipticSig, KeyType.k1).toString()

      const eosioPubKey = user.getPublicKey(dataAsString, ellipticSigString)
      expect(eosioPubKey.toString()).toEqual(publicKeys[0])
    })

    it('should fail to get public key from signature using invalid elliptic hash ', () => {
      const ec = new EC('secp256k1')
      const KPriv = privateKeys[0]
      const KPrivElliptic = PrivateKey.fromString(KPriv).toElliptic()

      const dataAsString = 'some string'
      const ellipticHashedString = ec.hash().update(dataAsString).digest()

      const ellipticSig = KPrivElliptic.sign(ellipticHashedString)
      const ellipticSigString = Signature.fromElliptic(ellipticSig, KeyType.k1).toString()

      const eosioPubKey = user.getPublicKey('other string', ellipticSigString)
      expect(eosioPubKey.toString()).not.toEqual(publicKeys[0])
    })

    it('verify invalid signature string results in invalid public key from signature', () => {
      const dataAsString = 'some string'
      const eosioPubKey = user.getPublicKey(dataAsString, signatureValue)
      expect(eosioPubKey.toString()).not.toEqual(publicKeys[0])
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
      const callback = (resolvedValue) => {
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
      const callback = (resolvedValue) => {
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
      const callback = (resolvedValue) => {
        expect(resolvedValue).toBeTruthy()
      }

      user.authenticate(challenges[0], callback)
    })
  })
})

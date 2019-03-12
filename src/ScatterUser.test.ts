import { Chain, RpcEndpoint, UALError, UALErrorType } from '@blockone/universal-authenticator-library'
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

describe('ScatterUser', () => {
  const api: any = {}
  const scatter: any = {
    eos: jest.fn().mockImplementation(() => api)
  }
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
})

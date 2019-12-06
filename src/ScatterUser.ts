import { Api, JsonRpc } from 'eosjs'
import { ec } from 'elliptic'
import { Signature, PublicKey } from 'eosjs/dist/eosjs-jssig'
import { Chain, SignTransactionResponse, UALErrorType, User } from 'universal-authenticator-library'
import { UALScatterError } from './UALScatterError'

const ellipticEc = new ec('secp256k1')

export class ScatterUser extends User {
  private api: Api
  private rpc: JsonRpc

  private keys: string[] = []
  private accountName: string = ''

  constructor(
    private chain: Chain,
    private scatter: any,
  ) {
    super()
    const rpcEndpoint = this.chain.rpcEndpoints[0]
    const rpcEndpointString = this.buildRpcEndpoint(rpcEndpoint)
    this.rpc = new JsonRpc(rpcEndpointString)
    const network = {
      blockchain: 'eos',
      chainId: this.chain.chainId,
      protocol: rpcEndpoint.protocol,
      host: rpcEndpoint.host,
      port: rpcEndpoint.port,
    }
    const rpc = this.rpc
    this.api = this.scatter.eos(network, Api, { rpc, beta3: true })
  }

  public async signTransaction(
    transaction: any,
    { broadcast = true, blocksBehind = 3, expireSeconds = 30 }
  ): Promise<SignTransactionResponse> {
    try {
      const completedTransaction = await this.api.transact(
        transaction,
        { broadcast, blocksBehind, expireSeconds }
      )

      return this.returnEosjsTransaction(broadcast, completedTransaction)
    } catch (e) {
      throw new UALScatterError(
        'Unable to sign the given transaction',
        UALErrorType.Signing,
        e)
    }
  }

  public async verifyKeyOwnership(challenge: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('verifyKeyOwnership failed'))
      }, 1000)

      this.authenticate(challenge, resolve)
    })
  }

  public async signArbitrary(publicKey: string, data: string, _: string): Promise<string> {
    return this.scatter.getArbitrarySignature(publicKey, data)
  }

  public async getAccountName(): Promise<string> {
    if (!this.accountName) {
      await this.refreshIdentity()
    }

    return this.accountName
  }

  public async getChainId(): Promise<string> {
    return this.chain.chainId
  }

  public async getKeys(): Promise<string[]> {
    if (!this.keys || this.keys.length === 0) {
      await this.refreshIdentity()
    }

    return this.keys
  }

  private async refreshIdentity() {
    const rpcEndpoint = this.chain.rpcEndpoints[0]
    try {
      const identity = await this.scatter.getIdentity({
        accounts: [{
          blockchain: 'eos',
          host: rpcEndpoint.host,
          port: rpcEndpoint.port,
          chainId: this.chain.chainId
        }]
      })

      this.keys = [identity.accounts[0].publicKey]
      this.accountName = identity.accounts[0].name
    } catch (e) {
      throw new UALScatterError(
        'Unable load user\'s identity',
        UALErrorType.DataRequest,
        e)
    }
  }

  private authenticate(challenge: string, resolve): void {
    this.scatter.authenticate(challenge).then(async (signature) => {
      const publicKey = this.getPublicKey(challenge, signature)
      const myKeys = await this.getKeys()
      let resolvedValue = false
      for (const key of myKeys) {
        if (key === publicKey) {
          resolvedValue = true
        }
      }
      resolve(resolvedValue)
    })
  }

  private getPublicKey(challenge: string, signature: string): string {
    const ellipticSignature = Signature.fromString(signature).toElliptic()
    const ellipticHashedStringAsBuffer = Buffer.from(ellipticEc.hash().update(challenge).digest(), 'hex')
    const ellipticRecoveredPublicKey =
      ellipticEc.recoverPubKey(ellipticHashedStringAsBuffer, ellipticSignature, ellipticSignature.recoveryParam, 'hex')
    const ellipticPublicKey = ellipticEc.keyFromPublic(ellipticRecoveredPublicKey)
    return PublicKey.fromElliptic(ellipticPublicKey).toString()
  }
}

import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, parseEther, encodeFunctionData,
  type Address, type Hex, type PublicClient
} from 'viem'
import { mainnet } from 'viem/chains'

export const runtime = 'nodejs' // fine for Vercel; code stays Bun-friendly

const RPC_URL = process.env.ETHEREUM_MAINNET_API!


const bad = (status: number, msg: string) =>
  NextResponse.json({ error: msg }, { status })

// ——— tiny, Bun-friendly helpers ———
const toU8 = (x: any): Uint8Array | undefined => {
  if (x == null) return undefined
  if (x instanceof Uint8Array) return x
  if (Array.isArray(x)) return new Uint8Array(x)
  if (typeof x === 'object') return Uint8Array.from(Object.values(x))
  return undefined
}
const toBig = (x: any) => (typeof x === 'string' ? BigInt(x) : x)

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const

type HasGetCode = Pick<PublicClient, 'getCode'>
async function isContract(client: HasGetCode, addr: Address) {
  const code = await client.getCode({ address: addr })
  return !!code && code !== '0x'
}

export async function POST(req: NextRequest) {
  if (!RPC_URL) return bad(500, 'Server not configured')

  const body = await req.json().catch(() => null) as { tx?: any } | null
  if (!body?.tx) return bad(400, 'Missing { tx }')

  const tx = body.tx
  if (tx.senderAddressNetwork !== 'Ethereum') {
    return bad(400, 'Only Ethereum/EVM supported in this endpoint')
  }

  // rehydrate just what we need
  tx.amount = toBig(tx.amount)
  if (tx.recvSignature) tx.recvSignature = toU8(tx.recvSignature)
  if (tx.signedCallPayload) tx.signedCallPayload = toU8(tx.signedCallPayload)
  if (tx.callPayload) tx.callPayload = [toU8(tx.callPayload[0]), toU8(tx.callPayload[1])]

  const client = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  })

  const sender = tx.senderAddress as Address
  const receiver = tx.receiverAddress as Address

  // build call data
  const isNative = 'Ethereum' in tx.token && tx.token.Ethereum === 'ETH'
  let to: Address
  let value: bigint
  let data: Hex

  if (isNative) {
    value = parseEther(String(tx.amount))
    to = receiver
    data = '0x'
  } else {
    const erc = tx.token?.Ethereum?.ERC20
    if (!erc?.address) return bad(400, 'Missing ERC20 token address')
    const tokenAddr = erc.address as Address
    if (!(await isContract(client, tokenAddr))) return bad(400, 'Invalid ERC20 address (no code)')

    const decimals = Number(erc.decimals ?? 18)
    const base = BigInt(10) ** BigInt(decimals)
    const amountWei = BigInt(String(tx.amount)) * base

    to = tokenAddr
    value = 0n
    data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [receiver, amountWei],
    })
  }

  const [nonce, gas, fees] = await Promise.all([
    client.getTransactionCount({ address: sender }),
    client.estimateGas({ account: sender, to, value, data }),
    client.estimateFeesPerGas().catch(async () => {
      const gasPrice = await client.getGasPrice()
      return { maxFeePerGas: gasPrice, maxPriorityFeePerGas: gasPrice }
    }),
  ])

  return NextResponse.json({
    prepared: {
      nonce,
      gas,
      maxFeePerGas: fees!.maxFeePerGas!,
      maxPriorityFeePerGas: fees!.maxPriorityFeePerGas!,
      tokenAddress: isNative ? null : (to as string),
    },
  })
}

// app/api/prepare-bsc/route.ts

import { PreparedBSCParams } from '@/lib/vane_lib/pkg/host_functions/networking'
import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, parseEther, parseUnits, encodeFunctionData,
  erc20Abi, type Address, type Hex, type PublicClient
} from 'viem'
import { bsc } from 'viem/chains'
import type { TxStateMachine } from '@/lib/vane_lib/primitives'

export const runtime = 'nodejs'

const RPC_URL = process.env.BSC_RPC_URL!

// tiny helpers
const bad = (status: number, msg: string) =>
  NextResponse.json({ error: msg }, { status })

const toU8 = (x: any): Uint8Array | undefined =>
  x == null ? undefined
  : x instanceof Uint8Array ? x
  : Array.isArray(x) ? new Uint8Array(x)
  : typeof x === 'object' ? Uint8Array.from(Object.values(x))
  : undefined

const toBig = (x: any) => (typeof x === 'string' ? BigInt(x) : x)

// check if address has code (token contract)
type HasGetCode = Pick<PublicClient, 'getCode'>
const isContract = async (client: HasGetCode, addr: Address) =>
  (await client.getCode({ address: addr })) !== '0x'


export async function POST(req: NextRequest) {
  if (!RPC_URL) return bad(500, 'Server not configured')

  const body = await req.json().catch(() => null) as { tx?: any } | null
  if (!body?.tx) return bad(400, 'Missing { tx }')

  const tx = body.tx as TxStateMachine
  if (tx.senderAddressNetwork !== 'Bnb') {
    return bad(400, 'Only BSC supported in this endpoint')
  }

  // minimal rehydrate
  tx.amount = toBig(tx.amount)
  if (tx.recvSignature) tx.recvSignature = toU8(tx.recvSignature)
  if (tx.signedCallPayload) tx.signedCallPayload = toU8(tx.signedCallPayload)
  if (tx.callPayload) tx.callPayload = [toU8(tx.callPayload[0]), toU8(tx.callPayload[1])] as any

  const client = createPublicClient({ chain: bsc, transport: http(RPC_URL) })

  const sender   = tx.senderAddress as Address
  const receiver = tx.receiverAddress as Address

  // native BNB if token.Bnb === 'BNB'
  const isNative = ("Bnb" in tx.token && tx.token.Bnb === "BNB")

  let to: Address
  let value: bigint
  let data: Hex = '0x'
  let tokenAddress: string | null = null
  let tokenDecimals: number | null = null

  if (isNative) {
    // BNB transfer
    value = parseEther(String(tx.amount))
    to = receiver
  } else {
    // BEP-20 transfer
    const bep20 = ("Bnb" in tx.token && typeof tx.token.Bnb === "object" && "BEP20" in tx.token.Bnb) ?
      tx.token.Bnb.BEP20.address : null;
    if (!bep20) return bad(400, 'Missing BEP20 token address');
    if (!(await isContract(client, bep20 as Address))) return bad(400, 'Invalid BEP20 address (no code)');

    // fetch decimals
    tokenDecimals = await client.readContract({
      address: bep20 as Address,
      abi: erc20Abi,
      functionName: 'decimals',
    })

    // encode transfer(to, amount)
    const amountWei = parseUnits(String(tx.amount), tokenDecimals)
    data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [receiver, amountWei],
    })

    to = bep20 as Address
    value = 0n
    tokenAddress = bep20
  }

  // nonce, gas, gasPrice (BSC = legacy pricing)
  const [nonce, gas, gasPrice] = await Promise.all([
    client.getTransactionCount({ address: sender }),
    client.estimateGas({ account: sender, to, value, data }),
    client.getGasPrice(),
  ])

  const prepared: PreparedBSCParams = {
    nonce,
    gas,
    gasPrice,
    tokenAddress: isNative ? null : tokenAddress,
    tokenDecimals: isNative ? null : tokenDecimals,
  }

  return NextResponse.json({ prepared })
}

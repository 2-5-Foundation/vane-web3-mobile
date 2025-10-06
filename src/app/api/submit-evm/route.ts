import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, serializeTransaction, hexToSignature, parseTransaction,
} from 'viem'
import { mainnet } from 'viem/chains'

export const runtime = 'nodejs' // deploys fine on Vercel; code is Bun-safe

const RPC_URL = process.env.ETHEREUM_MAINNET_API!


const bad = (status: number, msg: string) =>
  NextResponse.json({ error: msg }, { status })

// ——— Bun-friendly helpers ———
const toU8 = (x: any): Uint8Array => {
  if (x instanceof Uint8Array) return x
  if (Array.isArray(x)) return new Uint8Array(x)
  if (x && typeof x === 'object') return Uint8Array.from(Object.values(x))
  throw new Error('Invalid byte array')
}

const bytesToHex = (u8: Uint8Array): `0x${string}` => {
  let s = '0x'
  for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, '0')
  return s as `0x${string}`
}

function reconstructSigned(unsignedBytes: Uint8Array, signatureBytes: Uint8Array): `0x${string}` {
  const unsignedHex = bytesToHex(unsignedBytes)
  const sigHex = bytesToHex(signatureBytes)
  const { r, s, v } = hexToSignature(sigHex)
  const parsed = parseTransaction(unsignedHex)
  const signed = { ...parsed, r, s, v }
  return serializeTransaction(signed)
}

export async function POST(req: NextRequest) {
  if (!RPC_URL) return bad(500, 'Server not configured')

  const body = await req.json().catch(() => null) as
    | { signedSerializedTx?: `0x${string}` }
    | { tx?: any }
    | null
  if (!body) return bad(400, 'Invalid JSON')

  let serialized: `0x${string}` | null = null

  if ('signedSerializedTx' in body && body.signedSerializedTx) {
    serialized = body.signedSerializedTx
  } else if ('tx' in body && body.tx) {
    const tx = body.tx
    if (tx.senderAddressNetwork !== 'Ethereum') {
      return bad(400, 'Only Ethereum/EVM supported in this endpoint')
    }
    if (!tx.callPayload || !tx.signedCallPayload) {
      return bad(400, 'Missing callPayload or signedCallPayload')
    }

    const [, unsignedRaw] = tx.callPayload
    const unsignedBytes = toU8(unsignedRaw)
    const signatureBytes = toU8(tx.signedCallPayload)

    serialized = reconstructSigned(unsignedBytes, signatureBytes)
  }

  if (!serialized) return bad(400, 'No signed tx provided')

  const client = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  })

  try {
    const hash = await client.sendRawTransaction({ serializedTransaction: serialized })
    return NextResponse.json({ hash })
  } catch (e: any) {
    return bad(400, String(e?.shortMessage ?? e?.message ?? 'Broadcast failed'))
  }
}

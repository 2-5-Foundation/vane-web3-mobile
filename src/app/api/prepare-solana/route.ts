// app/api/prepare-solana/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Connection as SolanaConnection } from '@solana/web3.js'

export const runtime = 'nodejs'

const RPC_URL = process.env.SOLANA_RPC_URL!

const bad = (status: number, msg: string) =>
  NextResponse.json({ error: msg }, { status })

export async function POST(_req: NextRequest) {
  if (!RPC_URL) return bad(500, 'Server not configured')

  const connection = new SolanaConnection(RPC_URL, 'confirmed')

  // Fetch latest blockhash window
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized')

  return NextResponse.json({
    prepared: { blockhash, lastValidBlockHeight },
  })
}

// app/api/submit-solana/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  Connection as SolanaConnection,
  PublicKey,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import type { TxStateMachine } from '@/lib/vane_lib/primitives';
import { fromWire } from '@/lib/vane_lib/pkg/host_functions/networking';

export const runtime = 'nodejs';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;

const errorJson = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });


export async function POST(request: NextRequest) {
  if (!SOLANA_RPC_URL) return errorJson(500, 'Solana RPC URL not configured');

  const stateMachine = fromWire(await request.json().catch(() => null))
  if (!stateMachine) return errorJson(400, 'Invalid JSON');

  if (stateMachine.senderAddressNetwork !== 'Solana') {
    return errorJson(400, 'Only Solana supported in this endpoint');
  }
  if (
    !stateMachine.callPayload ||
    !('solana' in stateMachine.callPayload) ||
    !stateMachine.callPayload.solana.callPayload
  ) {
    return errorJson(400, 'Missing Solana callPayload (versioned message bytes)');
  }
  if (!stateMachine.signedCallPayload) {
    return errorJson(400, 'Missing signedCallPayload (ed25519 signature)');
  }

  const connection = new SolanaConnection(SOLANA_RPC_URL, 'confirmed');

  const messageBytes = stateMachine.callPayload.solana.callPayload;
  const versionedMessage = VersionedMessage.deserialize(Uint8Array.from(messageBytes));

  const signatureBytes = stateMachine.signedCallPayload;
  if (signatureBytes.length !== 64) {
    return errorJson(400, 'ed25519 signature must be 64 bytes');
  }

  const versionedTx = new VersionedTransaction(versionedMessage);
  versionedTx.addSignature(new PublicKey(stateMachine.senderAddress), Uint8Array.from(signatureBytes));

  try {
    const txHash = await connection.sendRawTransaction(versionedTx.serialize(), {maxRetries: 10});
    const lastValidBlockHeight = stateMachine.callPayload.solana.latestBlockHeight;

    const confirmation = await connection.confirmTransaction(
      {
        signature: txHash,
        blockhash: versionedMessage.recentBlockhash,
        lastValidBlockHeight,
      },
      'finalized'
    );

    if (!confirmation.value) {
      return errorJson(400, 'Transaction failed during confirmation');
    }

    return NextResponse.json({ hash: txHash });
  } catch (err: any) {
    return errorJson(400, String(err?.message ?? 'Broadcast failed'));
  }
}

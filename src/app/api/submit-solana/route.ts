// app/api/submit-solana/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  Connection as SolanaConnection,
  PublicKey,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import type { TxStateMachine } from '@/lib/vane_lib/primitives';

export const runtime = 'nodejs';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;

const errorJson = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

const toUint8Array = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value && typeof value === 'object') return Uint8Array.from(Object.values(value as Record<string, number>));
  throw new Error('Invalid byte array format');
};

export async function POST(request: NextRequest) {
  if (!SOLANA_RPC_URL) return errorJson(500, 'Solana RPC URL not configured');

  const stateMachine = (await request.json().catch(() => null)) as TxStateMachine | null;
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

  const messageBytes = toUint8Array(stateMachine.callPayload.solana.callPayload);
  const versionedMessage = VersionedMessage.deserialize(messageBytes);

  const signatureBytes = toUint8Array(stateMachine.signedCallPayload);
  if (signatureBytes.length !== 64) {
    return errorJson(400, 'ed25519 signature must be 64 bytes');
  }

  const versionedTx = new VersionedTransaction(versionedMessage);
  versionedTx.addSignature(new PublicKey(stateMachine.senderAddress), signatureBytes);

  try {
    const txHash = await connection.sendRawTransaction(versionedTx.serialize());
    const lastValidBlockHeight = stateMachine.callPayload.solana.latestBlockHeight;

    const confirmation = await connection.confirmTransaction(
      {
        signature: txHash,
        blockhash: versionedMessage.recentBlockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    if (!confirmation.value) {
      return errorJson(400, 'Transaction failed during confirmation');
    }

    return NextResponse.json({ hash: txHash });
  } catch (err: any) {
    return errorJson(400, String(err?.message ?? 'Broadcast failed'));
  }
}

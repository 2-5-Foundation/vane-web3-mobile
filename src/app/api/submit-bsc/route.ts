// app/api/submit-bsc/route.ts
import { fromWire, reconstructSignedTransaction } from '@/lib/vane_lib/pkg/host_functions/networking';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import type { TxStateMachine } from '@/lib/vane_lib/primitives';

export const runtime = 'nodejs';

const BSC_RPC_URL = process.env.BSC_RPC_URL!;

const errorJson = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  if (!BSC_RPC_URL) return errorJson(500, 'BSC RPC URL not configured');

  const stateMachine = fromWire(await request.json().catch(() => null))
  if (!stateMachine) return errorJson(400, 'Invalid JSON');

  if (stateMachine.senderAddressNetwork !== 'Bnb') {
    return errorJson(400, 'Only BSC supported in this endpoint');
  }
  if (!stateMachine.signedCallPayload) {
    return errorJson(400, 'Missing signedCallPayload (signature)');
  }
  if (
    !stateMachine.callPayload ||
    !('bnb' in stateMachine.callPayload) ||
    !stateMachine.callPayload.bnb.callPayload?.[1]
  ) {
    return errorJson(400, 'Missing BSC callPayload (unsigned raw tx bytes)');
  }

  const unsignedTxBytes = stateMachine.callPayload.bnb.callPayload[1];
  const signatureBytes = stateMachine.signedCallPayload;

  const serializedSignedTx = reconstructSignedTransaction(Uint8Array.from(unsignedTxBytes), Uint8Array.from(signatureBytes));

  const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });
  try {
    const txHash = await publicClient.sendRawTransaction({ serializedTransaction: serializedSignedTx });
    return NextResponse.json({ hash: txHash });
  } catch (err: any) {
    return errorJson(400, String(err?.shortMessage ?? err?.message ?? 'Broadcast failed'));
  }
}

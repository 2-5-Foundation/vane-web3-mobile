import { fromWire, reconstructSignedTransaction } from '@/lib/vane_lib/pkg/host_functions/networking';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { ChainSupported, type TxStateMachine } from '@/lib/vane_lib/primitives';

export const runtime = 'nodejs';

const ETHEREUM_RPC_URL = process.env.ETHEREUM_MAINNET_API!;

const errorJson = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  if (!ETHEREUM_RPC_URL) return errorJson(500, 'Ethereum RPC URL not configured');

  const stateMachine = fromWire(await request.json().catch(() => null))
  if (!stateMachine) return errorJson(400, 'Invalid JSON');

  if (stateMachine.senderAddressNetwork !== ChainSupported.Ethereum) {
    return errorJson(400, 'Only Ethereum/EVM supported in this endpoint');
  }
  if (!stateMachine.signedCallPayload) {
    return errorJson(400, 'Missing signedCallPayload (signature)');
  }
  if (
    !stateMachine.callPayload ||
    !('ethereum' in stateMachine.callPayload) ||
    !stateMachine.callPayload.ethereum.callPayload?.[1]
  ) {
    return errorJson(400, 'Missing Ethereum callPayload (unsigned raw tx bytes)');
  }

  const unsignedTxBytes = stateMachine.callPayload.ethereum.callPayload[1];
  const signatureBytes = stateMachine.signedCallPayload;

  // Rebuild signed serialized tx (viem-compatible)
  const serializedSignedTx = reconstructSignedTransaction(Uint8Array.from(unsignedTxBytes), Uint8Array.from(signatureBytes));

  const publicClient = createPublicClient({ chain: mainnet, transport: http(ETHEREUM_RPC_URL) });
  try {
    const txHash = await publicClient.sendRawTransaction({ serializedTransaction: serializedSignedTx });
    return NextResponse.json({ hash: txHash });
  } catch (err: any) {
    return errorJson(400, String(err?.shortMessage ?? err?.message ?? 'Broadcast failed'));
  }
}

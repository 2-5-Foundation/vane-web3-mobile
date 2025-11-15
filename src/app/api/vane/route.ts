import { NextRequest, NextResponse } from 'next/server';
import { ChainSupported, type Token, type TxStateMachine } from '@/lib/vane_lib/primitives';

export const runtime = 'nodejs';

type RpcRequest =
  | {
      method: 'initializeNode';
      params: {
        relayMultiAddr: string;
        account: string;
        network: string;
        live?: boolean;
      };
    }
  | {
      method: 'initiateTransaction';
      params: {
        sender: string;
        receiver: string;
        amount: string; // or bigint serialized
        token: Token;
        codeWord: string;
        sender_network: ChainSupported;
        receiver_network: ChainSupported;
      };
    }
  | {
      method: 'senderConfirm';
      params: { tx: TxStateMachine };
    }
  | {
      method: 'receiverConfirm';
      params: { tx: TxStateMachine };
    }
  | {
      method: 'revertTransaction';
      params: { tx: TxStateMachine; reason?: string | null };
    }
  | {
      method: 'fetchPendingTxUpdates';
    }
  | {
      method: 'watchP2pNotifications';
    };

const errorJson = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const VANE_BACKEND = process.env.VANE_BACKEND;
  
  if (!VANE_BACKEND) {
    return errorJson(500, 'VANE_BACKEND URL not configured');
  }

  let rpcRequest: RpcRequest;
  
  try {
    rpcRequest = await request.json();
  } catch {
    return errorJson(400, 'Invalid JSON');
  }

  if (!rpcRequest || typeof rpcRequest !== 'object' || !('method' in rpcRequest)) {
    return errorJson(400, 'Invalid RPC request: missing method');
  }

  // Only require params for methods that need them
  const methodsRequiringParams = ['initializeNode', 'initiateTransaction', 'senderConfirm', 'receiverConfirm', 'revertTransaction'];
  if (methodsRequiringParams.includes(rpcRequest.method) && !('params' in rpcRequest)) {
    return errorJson(400, 'Invalid RPC request: missing params');
  }

  try {
    const response = await fetch(VANE_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return errorJson(response.status, errorText || `Backend returned ${response.status}`);
    }

    const data = await response.json().catch(() => null);
    return NextResponse.json(data);
  } catch (err: any) {
    return errorJson(500, String(err?.message ?? 'Failed to forward request to backend'));
  }
}


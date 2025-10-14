import { PreparedEthParams } from '@/lib/vane_lib/pkg/host_functions/networking'
import { TxStateMachine } from '@/lib/vane_lib/primitives'
import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, parseEther, encodeFunctionData,
  type Address, type Hex, type PublicClient, erc20Abi,
  parseUnits
} from 'viem'
import { mainnet } from 'viem/chains'

export const runtime = 'nodejs' 

const RPC_URL = process.env.ETHEREUM_MAINNET_API!

const bad = (status: number, msg: string) =>
    NextResponse.json({ error: msg }, { status });
  
export async function POST(req: NextRequest) {
    if (!RPC_URL) return bad(500, 'Server not configured');
  
    const body = await req.json().catch(() => null) as { tx?: any } | null;
    if (!body?.tx) return bad(400, 'Missing { tx }');
  
    const tx = body.tx as TxStateMachine;
    if (tx.senderAddressNetwork !== 'Ethereum') {
      return bad(400, 'Only Ethereum/EVM supported in this endpoint');
    }
  
    // rehydrate minimal
    const toU8 = (x: any) =>
      x == null ? undefined
      : x instanceof Uint8Array ? x
      : Array.isArray(x) ? new Uint8Array(x)
      : typeof x === 'object' ? Uint8Array.from(Object.values(x))
      : undefined;
    const toBig = (x: any) => (typeof x === 'string' ? BigInt(x) : x);
  
    tx.amount = toBig(tx.amount);
    if (tx.recvSignature) tx.recvSignature = toU8(tx.recvSignature);
    if (tx.signedCallPayload) tx.signedCallPayload = toU8(tx.signedCallPayload);
    if (tx.callPayload) tx.callPayload = [toU8(tx.callPayload[0]), toU8(tx.callPayload[1])] as any;
  
    const client = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
  
    const sender   = tx.senderAddress as Address;
    const receiver = tx.receiverAddress as Address;
  
    const isNative = ("Ethereum" in tx.token && tx.token.Ethereum === "ETH");
  
    // Build calldata just for gas estimation (not returned)
    let to: Address;
    let value: bigint;
    let data: Hex = '0x';
    let tokenAddress: string | null = null;
    let tokenDecimals: number | null = null;
  
    if (isNative) {
      value = parseEther(String(tx.amount));
      to = receiver;
    } else {
      tokenAddress = ("Ethereum" in tx.token && typeof tx.token.Ethereum === "object" && "ERC20" in tx.token.Ethereum) ?
        tx.token.Ethereum.ERC20.address : null;
      if (!tokenAddress) return bad(400, 'Missing ERC20 token address');
  
      // read decimals
      tokenDecimals = await client.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'decimals',
      });
  
      // encode transfer (amount scaling is irrelevant for PreparedEthParams, but needed for gas estimate)
      const amountWei = parseUnits(String(tx.amount), tokenDecimals);
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [receiver, amountWei],
      });
  
      to = tokenAddress as Address;
      value = 0n;
    }
  
    const [nonce, gas, fees] = await Promise.all([
      client.getTransactionCount({ address: sender }),
      client.estimateGas({ account: sender, to, value, data }),
      client.estimateFeesPerGas().catch(async () => {
        const gasPrice = await client.getGasPrice();
        return { maxFeePerGas: gasPrice, maxPriorityFeePerGas: gasPrice };
      }),
    ]);
  
    const prepared: PreparedEthParams = {
      nonce,
      gas,
      maxFeePerGas:        fees!.maxFeePerGas!,
      maxPriorityFeePerGas:fees!.maxPriorityFeePerGas!,
      tokenAddress: isNative ? null : tokenAddress,
      tokenDecimals: isNative ? null : tokenDecimals,
    };
  
    return NextResponse.json({ prepared });
  }
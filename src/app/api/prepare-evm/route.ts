import { fromWire, toWire, UnsignedEip1559 } from '@/lib/vane_lib/pkg/host_functions/networking'
import { TxStateMachine } from '@/lib/vane_lib/primitives'
import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, encodeFunctionData,
  type Address, type Hex, erc20Abi,
  formatEther,
  serializeTransaction,
  keccak256,
  TransactionSerializableEIP1559,
  hexToBytes
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
  
    const tx = fromWire(body.tx)
    if (tx.senderAddressNetwork !== 'Ethereum') {
      return bad(400, 'Only Ethereum/EVM supported in this endpoint');
    }
  
    const client = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
  
    const sender   = tx.senderAddress as Address;
    const receiver = tx.receiverAddress as Address;
  
    const isNative = ("Ethereum" in tx.token && tx.token.Ethereum === "ETH");
  
    // Build calldata just for gas estimation (not returned)
    let to: Address;
    let value: bigint;
    let data: Hex = '0x';
    let tokenAddress: string | null = null;
  
    if (isNative) {
      value = tx.amount;
      to = receiver;
    } else {
      tokenAddress = ("Ethereum" in tx.token && typeof tx.token.Ethereum === "object" && "ERC20" in tx.token.Ethereum) ?
        tx.token.Ethereum.ERC20.address : null;
      if (!tokenAddress) return bad(400, 'Missing ERC20 token address');
  
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [receiver, tx.amount],
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
  

    const fields: UnsignedEip1559 = {
      to: to,
      value: value,
      chainId: mainnet.id,
      nonce: nonce,
      gas: gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      data: data,
      accessList: [],
      type: 'eip1559',
    };
  
    const feesInEth = formatEther(gas * fees.maxFeePerGas);
  
    const signingPayload = serializeTransaction(fields as TransactionSerializableEIP1559) as Hex;
    if (!signingPayload.startsWith('0x02')) throw new Error('Expected 0x02 typed payload');
    const digest = keccak256(signingPayload) as Hex;
  
    const updated: TxStateMachine = {
      ...tx,
      feesAmount: Number(feesInEth),
      callPayload: {
        ethereum: {
          ethUnsignedTxFields: fields,
          callPayload: [
            Array.from(hexToBytes(digest)),
            Array.from(hexToBytes(signingPayload)),
          ]
        }
      }
    };  
  
    return NextResponse.json({ prepared: toWire(updated) });
  }
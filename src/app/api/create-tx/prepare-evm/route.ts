import { fromWire, toWire, UnsignedEip1559 } from '@/lib/vane_lib/pkg/host_functions/networking'
import { ChainSupported, Token, TxStateMachine } from '@/lib/vane_lib/primitives'
import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, http, encodeFunctionData,
  type Address, type Hex, erc20Abi,
  formatEther,
  serializeTransaction,
  keccak256,
  TransactionSerializableEIP1559,
  hexToBytes,
  Chain
} from 'viem'
import { mainnet,polygon,optimism,arbitrum,base } from 'viem/chains'

export const runtime = 'nodejs' 

const ETH_RPC_URL = process.env.ETHEREUM_MAINNET_API!
const BASE_RPC_URL = process.env.BASE_MAINNET_API!
const POLYGON_RPC_URL = process.env.POLYGON_MAINNET_API!
const OPTIMISM_RPC_URL = process.env.OPTIMISM_MAINNET_API!
const ARBITRUM_RPC_URL = process.env.ARBITRUM_MAINNET_API!

const bad = (status: number, msg: string) =>
    NextResponse.json({ error: msg }, { status });
 
const EVM_NETWORKS = [ChainSupported.Ethereum, ChainSupported.Base, ChainSupported.Polygon, ChainSupported.Optimism, ChainSupported.Arbitrum, ChainSupported.Bnb] as const;

const isNative = (token: Token) => {
  return ("Ethereum" in token && token.Ethereum === "ETH") ||
         ("Base" in token && token.Base === "ETH") ||
         ("Polygon" in token && token.Polygon === "POL") ||
         ("Optimism" in token && token.Optimism === "ETH") ||
         ("Arbitrum" in token && token.Arbitrum === "ETH")  
}

const isRpcAvailable = (network: ChainSupported):{rpcUrl: string, chain: Chain} | null => {
  switch (network) {
    case ChainSupported.Ethereum:
      return {rpcUrl: ETH_RPC_URL, chain: mainnet};
    case ChainSupported.Base:
      return {rpcUrl: BASE_RPC_URL, chain: base};
    case ChainSupported.Polygon:
      return {rpcUrl: POLYGON_RPC_URL, chain: polygon};
    case ChainSupported.Optimism:
      return {rpcUrl: OPTIMISM_RPC_URL, chain: optimism};
    case ChainSupported.Arbitrum:
      return {rpcUrl: ARBITRUM_RPC_URL, chain: arbitrum};
    default:
      return null;
  }
}


const getTokenAddress = (token: Token, network: ChainSupported): string | null => {
  switch (network) {
    case ChainSupported.Ethereum:
      if ("Ethereum" in token && typeof token.Ethereum === "object" && "ERC20" in token.Ethereum) {
        return token.Ethereum.ERC20.address;
      }
      return null;
    case ChainSupported.Base:
      if ("Base" in token && typeof token.Base === "object" && "ERC20" in token.Base) {
        return token.Base.ERC20.address;
      }
      return null;
    case ChainSupported.Polygon:
      if ("Polygon" in token && typeof token.Polygon === "object" && "ERC20" in token.Polygon) {
        return token.Polygon.ERC20.address;
      }
      return null;
    case ChainSupported.Optimism:
      if ("Optimism" in token && typeof token.Optimism === "object" && "ERC20" in token.Optimism) {
        return token.Optimism.ERC20.address;
      }
      return null;
    case ChainSupported.Arbitrum:
      if ("Arbitrum" in token && typeof token.Arbitrum === "object" && "ERC20" in token.Arbitrum) {
        return token.Arbitrum.ERC20.address;
      }
      return null;
  }
}


export async function POST(req: NextRequest) {
  
    const body = await req.json().catch(() => null) as { tx?: any } | null;
    if (!body?.tx) return bad(400, 'Missing { tx }');

    const tx = fromWire(body.tx);

    // Ensure senderAddressNetwork is a supported EVM network, with precise type check
    if (!EVM_NETWORKS.some(network => network === tx.senderAddressNetwork)) {
      return bad(400, 'Unsupported EVM network');
    }
    if (!isRpcAvailable(tx.senderAddressNetwork)) return bad(500, 'Server not configured');

    // Setup the client for EVM chains
    const client = createPublicClient({
      chain: isRpcAvailable(tx.senderAddressNetwork)?.chain,
      transport: http(isRpcAvailable(tx.senderAddressNetwork)?.rpcUrl),
    });

  
    const sender   = tx.senderAddress as Address;
    const receiver = tx.receiverAddress as Address;
    
    // Build calldata just for gas estimation (not returned)
    let to: Address;
    let value: bigint;
    let data: Hex = '0x';
    let tokenAddress: string | null = null;
  
    if (isNative(tx.token)) {
      value = tx.amount;
      to = receiver;
    } else {
      tokenAddress = getTokenAddress(tx.token, tx.senderAddressNetwork);
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
      chainId: isRpcAvailable(tx.senderAddressNetwork)?.chain.id,
      nonce: nonce,
      gas: gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      data: data,
      accessList: [],
      type: 'eip1559',
    };
  
    const feesInEth = formatEther(gas * fees.maxFeePerGas); // this takes care of polygon too
  
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
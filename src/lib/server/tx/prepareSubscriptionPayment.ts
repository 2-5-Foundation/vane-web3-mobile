"use server";

import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
  erc20Abi,
  type Chain,
} from "viem";
import { mainnet, polygon, optimism, arbitrum, base, bsc } from "viem/chains";

// Payment addresses by chain type
const PAYMENT_ADDRESSES = {
  EVM: "0x3B7EE252b277641F8dB4F231609278750e50E0c5" as Address,
  SOLANA: "Ga432eFUBVwnyF9tdVFqwaTwd79FKwCGNWeEXub8UPZw",
  TRON: "TE2uovkPi3gdsf8PWxXREDv3NaiUoLuUAQ",
  BITCOIN: "bc1qnupchcc9qsva3uz5zv2cswmc4tael3838tudz6",
} as const;

// Get RPC URL and chain config based on network ID
const getRpcConfig = (networkId: number): { rpcUrl: string; chain: Chain } | null => {
  const ETH_RPC_URL = process.env.ETHEREUM_MAINNET_API;
  const BASE_RPC_URL = process.env.BASE_MAINNET_API;
  const POLYGON_RPC_URL = process.env.POLYGON_MAINNET_API;
  const OPTIMISM_RPC_URL = process.env.OPTIMISM_MAINNET_API;
  const ARBITRUM_RPC_URL = process.env.ARBITRUM_MAINNET_API;
  const BSC_RPC_URL = process.env.BSC_RPC_URL;

  switch (networkId) {
    case 1:
      if (!ETH_RPC_URL) return null;
      return { rpcUrl: ETH_RPC_URL.trim(), chain: mainnet };
    case 8453:
      if (!BASE_RPC_URL) return null;
      return { rpcUrl: BASE_RPC_URL.trim(), chain: base };
    case 137:
      if (!POLYGON_RPC_URL) return null;
      return { rpcUrl: POLYGON_RPC_URL.trim(), chain: polygon };
    case 10:
      if (!OPTIMISM_RPC_URL) return null;
      return { rpcUrl: OPTIMISM_RPC_URL.trim(), chain: optimism };
    case 42161:
      if (!ARBITRUM_RPC_URL) return null;
      return { rpcUrl: ARBITRUM_RPC_URL.trim(), chain: arbitrum };
    case 56:
      if (!BSC_RPC_URL) return null;
      return { rpcUrl: BSC_RPC_URL.trim(), chain: bsc };
    default:
      return null;
  }
};

export interface EvmTxFields {
  to: Address;
  value: bigint;
  chainId: number;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  data: Hex;
  type: "eip1559";
}

export interface PrepareSubscriptionPaymentParams {
  senderAddress: string;
  networkId: number;
  tokenAddress: string | null; // null for native token
  amount: bigint;
  decimals: number;
}

export interface PrepareSubscriptionPaymentResult {
  success: boolean;
  txFields?: EvmTxFields;
  error?: string;
}

/**
 * Prepare an EVM subscription payment transaction
 * Returns the transaction fields ready to be signed and submitted
 */
export async function prepareEvmSubscriptionPayment(
  params: PrepareSubscriptionPaymentParams
): Promise<PrepareSubscriptionPaymentResult> {
  const { senderAddress, networkId, tokenAddress, amount } = params;

  try {
    const rpcConfig = getRpcConfig(networkId);
    if (!rpcConfig) {
      return { success: false, error: `RPC not configured for network ${networkId}` };
    }

    const client = createPublicClient({
      chain: rpcConfig.chain,
      transport: http(rpcConfig.rpcUrl),
    });

    const sender = senderAddress as Address;
    const receiver = PAYMENT_ADDRESSES.EVM;

    let to: Address;
    let value: bigint;
    let data: Hex = "0x";

    if (!tokenAddress) {
      // Native token transfer
      value = amount;
      to = receiver;
    } else {
      // ERC20 token transfer
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [receiver, amount],
      });
      to = tokenAddress as Address;
      value = 0n;
    }

    // Get nonce, gas estimate, and fee data
    const [nonce, gas, fees] = await Promise.all([
      client.getTransactionCount({ address: sender }),
      client.estimateGas({ account: sender, to, value, data }),
      client.estimateFeesPerGas().catch(async () => {
        const gasPrice = await client.getGasPrice();
        return { maxFeePerGas: gasPrice, maxPriorityFeePerGas: gasPrice };
      }),
    ]);

    const txFields: EvmTxFields = {
      to,
      value,
      chainId: rpcConfig.chain.id,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas!,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas!,
      data,
      type: "eip1559",
    };

    return { success: true, txFields };
  } catch (error: unknown) {
    const rawMsg = error instanceof Error ? error.message.toLowerCase() : "";
    let errorMsg = "Failed to prepare transaction";
    
    if (rawMsg.includes("insufficient") || rawMsg.includes("exceeds balance")) {
      errorMsg = "Insufficient balance";
    } else if (rawMsg.includes("gas")) {
      errorMsg = "Not enough gas";
    }
    
    return { success: false, error: errorMsg };
  }
}

export async function getSolanaPaymentAddress(): Promise<string> {
  return PAYMENT_ADDRESSES.SOLANA;
}

export async function getEvmPaymentAddress(): Promise<Address> {
  return PAYMENT_ADDRESSES.EVM;
}

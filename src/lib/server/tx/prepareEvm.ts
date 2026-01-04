import { UnsignedEip1559 } from "@/lib/vane_lib/pkg/host_functions/networking";
import {
  ChainSupported,
  Token,
  TxStateMachine,
} from "@/lib/vane_lib/primitives";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
  erc20Abi,
  formatEther,
  serializeTransaction,
  keccak256,
  TransactionSerializableEIP1559,
  hexToBytes,
  Chain,
} from "viem";
import { mainnet, polygon, optimism, arbitrum, base } from "viem/chains";

const EVM_NETWORKS = [
  ChainSupported.Ethereum,
  ChainSupported.Base,
  ChainSupported.Polygon,
  ChainSupported.Optimism,
  ChainSupported.Arbitrum,
  ChainSupported.Bnb,
] as const;

const isNative = (token: Token) => {
  return (
    ("Ethereum" in token && token.Ethereum === "ETH") ||
    ("Base" in token && token.Base === "ETH") ||
    ("Polygon" in token && token.Polygon === "POL") ||
    ("Optimism" in token && token.Optimism === "ETH") ||
    ("Arbitrum" in token && token.Arbitrum === "ETH")
  );
};

// Get RPC URL at runtime to ensure env vars are available
const getRpcConfig = (
  network: ChainSupported,
): { rpcUrl: string; chain: Chain } | null => {
  // Read env vars at runtime, not module load time
  const ETH_RPC_URL = process.env.ETHEREUM_MAINNET_API;
  const BASE_RPC_URL = process.env.BASE_MAINNET_API;
  const POLYGON_RPC_URL = process.env.POLYGON_MAINNET_API;
  const OPTIMISM_RPC_URL = process.env.OPTIMISM_MAINNET_API;
  const ARBITRUM_RPC_URL = process.env.ARBITRUM_MAINNET_API;

  switch (network) {
    case ChainSupported.Ethereum:
      if (!ETH_RPC_URL) {
        console.error("ETHEREUM_MAINNET_API is not set");
        return null;
      }
      return { rpcUrl: ETH_RPC_URL.trim(), chain: mainnet };
    case ChainSupported.Base:
      if (!BASE_RPC_URL) {
        console.error("BASE_MAINNET_API is not set");
        return null;
      }
      return { rpcUrl: BASE_RPC_URL.trim(), chain: base };
    case ChainSupported.Polygon:
      if (!POLYGON_RPC_URL) {
        console.error("POLYGON_MAINNET_API is not set");
        return null;
      }
      return { rpcUrl: POLYGON_RPC_URL.trim(), chain: polygon };
    case ChainSupported.Optimism:
      if (!OPTIMISM_RPC_URL) {
        console.error("OPTIMISM_MAINNET_API is not set");
        return null;
      }
      return { rpcUrl: OPTIMISM_RPC_URL.trim(), chain: optimism };
    case ChainSupported.Arbitrum:
      if (!ARBITRUM_RPC_URL) {
        console.error("ARBITRUM_MAINNET_API is not set");
        return null;
      }
      return { rpcUrl: ARBITRUM_RPC_URL.trim(), chain: arbitrum };
    default:
      return null;
  }
};

const getTokenAddress = (
  token: Token,
  network: ChainSupported,
): string | null => {
  switch (network) {
    case ChainSupported.Ethereum:
      if (
        "Ethereum" in token &&
        typeof token.Ethereum === "object" &&
        "ERC20" in token.Ethereum
      ) {
        return token.Ethereum.ERC20.address;
      }
      return null;
    case ChainSupported.Base:
      if (
        "Base" in token &&
        typeof token.Base === "object" &&
        "ERC20" in token.Base
      ) {
        return token.Base.ERC20.address;
      }
      return null;
    case ChainSupported.Polygon:
      if (
        "Polygon" in token &&
        typeof token.Polygon === "object" &&
        "ERC20" in token.Polygon
      ) {
        return token.Polygon.ERC20.address;
      }
      return null;
    case ChainSupported.Optimism:
      if (
        "Optimism" in token &&
        typeof token.Optimism === "object" &&
        "ERC20" in token.Optimism
      ) {
        return token.Optimism.ERC20.address;
      }
      return null;
    case ChainSupported.Arbitrum:
      if (
        "Arbitrum" in token &&
        typeof token.Arbitrum === "object" &&
        "ERC20" in token.Arbitrum
      ) {
        return token.Arbitrum.ERC20.address;
      }
      return null;
  }
};

export async function prepareEvmTransaction(
  tx: TxStateMachine,
): Promise<TxStateMachine> {
  // Ensure senderAddressNetwork is a supported EVM network
  if (!EVM_NETWORKS.some((network) => network === tx.senderAddressNetwork)) {
    throw new Error("Unsupported EVM network");
  }

  // Get RPC config at runtime
  const rpcConfig = getRpcConfig(tx.senderAddressNetwork);
  if (!rpcConfig) {
    console.error("RPC not configured for network:", tx.senderAddressNetwork);
    throw new Error("Server not configured: RPC URL missing for network");
  }

  // Setup the client for EVM chains
  const client = createPublicClient({
    chain: rpcConfig.chain,
    transport: http(rpcConfig.rpcUrl),
  });

  const sender = tx.senderAddress as Address;
  const receiver = tx.receiverAddress as Address;

  // Build calldata just for gas estimation (not returned)
  let to: Address;
  let value: bigint;
  let data: Hex = "0x";
  let tokenAddress: string | null = null;

  if (isNative(tx.token)) {
    value = tx.amount;
    to = receiver;
  } else {
    tokenAddress = getTokenAddress(tx.token, tx.senderAddressNetwork);
    if (!tokenAddress) throw new Error("Missing ERC20 token address");

    data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [receiver, tx.amount],
    });

    to = tokenAddress as Address;
    value = 0n;
  }

  // Wrap RPC calls in try-catch to handle failures gracefully
  let nonce, gas, fees;
  try {
    [nonce, gas, fees] = await Promise.all([
      client.getTransactionCount({ address: sender }),
      client.estimateGas({ account: sender, to, value, data }),
      client.estimateFeesPerGas().catch(async () => {
        const gasPrice = await client.getGasPrice();
        return { maxFeePerGas: gasPrice, maxPriorityFeePerGas: gasPrice };
      }),
    ]);
  } catch (rpcError: any) {
    console.error("RPC call failed:", {
      network: tx.senderAddressNetwork,
      error: rpcError?.message || String(rpcError),
      cause: rpcError?.cause?.message || rpcError?.cause,
      url: rpcConfig.rpcUrl.substring(0, 50) + "...",
      sender,
      receiver,
    });

    // Provide more helpful error message
    const errorMessage =
      rpcError?.message || rpcError?.cause?.message || "Unknown RPC error";
    throw new Error(`RPC call failed: ${errorMessage}`);
  }

  const fields: UnsignedEip1559 = {
    to: to,
    value: value,
    chainId: rpcConfig.chain.id,
    nonce: nonce,
    gas: gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    data: data,
    accessList: [],
    type: "eip1559",
  };

  const feesInEth = formatEther(BigInt(gas) * BigInt(fees.maxFeePerGas));

  const signingPayload = serializeTransaction(
    fields as TransactionSerializableEIP1559,
  ) as Hex;
  if (!signingPayload.startsWith("0x02")) {
    console.error(
      "Invalid transaction payload format:",
      signingPayload.substring(0, 10),
    );
    throw new Error("Invalid transaction payload format");
  }
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
        ],
      },
    },
  };

  return updated;
}

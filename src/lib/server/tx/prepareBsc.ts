import { UnsignedLegacy } from "@/lib/vane_lib/pkg/host_functions/networking";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  type Address,
  type Hex,
  type PublicClient,
  formatEther,
  serializeTransaction,
  keccak256,
  TransactionSerializableLegacy,
  hexToBytes,
} from "viem";
import { bsc } from "viem/chains";
import type { TxStateMachine } from "@/lib/vane_lib/primitives";

const RPC_URL = process.env.BSC_RPC_URL!;

// check if address has code (token contract)
type HasGetCode = Pick<PublicClient, "getCode">;
const isContract = async (client: HasGetCode, addr: Address) =>
  (await client.getCode({ address: addr })) !== "0x";

export async function prepareBscTransaction(
  tx: TxStateMachine,
): Promise<TxStateMachine> {
  if (!RPC_URL) throw new Error("Server not configured");

  if (tx.senderAddressNetwork !== "Bnb") {
    throw new Error("Only BSC supported in this endpoint");
  }

  const client = createPublicClient({ chain: bsc, transport: http(RPC_URL) });

  const sender = tx.senderAddress as Address;
  const receiver = tx.receiverAddress as Address;

  // native BNB if token.Bnb === 'BNB'
  const isNative = "Bnb" in tx.token && tx.token.Bnb === "BNB";

  let to: Address;
  let value: bigint;
  let data: Hex = "0x";
  let tokenAddress: string | null = null;

  if (isNative) {
    // BNB transfer
    value = tx.amount;
    to = receiver;
  } else {
    // BEP-20 transfer
    const bep20 =
      "Bnb" in tx.token &&
      typeof tx.token.Bnb === "object" &&
      "BEP20" in tx.token.Bnb
        ? tx.token.Bnb.BEP20.address
        : null;
    if (!bep20) throw new Error("Missing BEP20 token address");
    if (!(await isContract(client, bep20 as Address)))
      throw new Error("Invalid BEP20 address (no code)");

    // encode transfer(to, amount)
    data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [receiver, tx.amount],
    });

    to = bep20 as Address;
    value = 0n;
    tokenAddress = bep20;
  }

  // nonce, gas, gasPrice (BSC = legacy pricing)
  const [nonce, gas, gasPrice] = await Promise.all([
    client.getTransactionCount({ address: sender }),
    client.estimateGas({ account: sender, to, value, data }),
    client.getGasPrice(),
  ]);
  const fields: UnsignedLegacy = {
    to: to,
    value: value,
    chainId: bsc.id,
    nonce: nonce,
    gas: gas,
    gasPrice: gasPrice,
    data: data,
    type: "legacy",
  };

  const feesInBNB = formatEther(gas * gasPrice);

  const signingPayload = serializeTransaction(
    fields as TransactionSerializableLegacy,
  ) as Hex;

  const digest = keccak256(signingPayload) as Hex;
  const updated: TxStateMachine = {
    ...tx,
    feesAmount: Number(feesInBNB),
    callPayload: {
      bnb: {
        bnbLegacyTxFields: fields,
        callPayload: [
          // digest as bytes (32)
          Array.from(hexToBytes(digest)),
          // unsigned payload bytes (what you hashed)
          Array.from(hexToBytes(signingPayload)),
        ],
      },
    },
  };

  return updated;
}

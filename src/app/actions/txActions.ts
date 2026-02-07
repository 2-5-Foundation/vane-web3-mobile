"use server";

import { fromWire, toWire } from "@/lib/vane_lib/pkg/host_functions/networking";
import { prepareEvmTransaction } from "@/lib/server/tx/prepareEvm";
import { prepareBscTransaction } from "@/lib/server/tx/prepareBsc";
import { prepareSolanaTransaction } from "@/lib/server/tx/prepareSolana";
import type { TxStateMachine } from "@/lib/vane_lib/primitives";

const METRICS_URL = "https://vane-metrics.vaneweb3.com";


export interface FetchTxJsonResult {
  success: boolean;
  txList: TxStateMachine[];
  error?: string;
}

export async function fetchTxJsonBySender(senderAddress: string): Promise<FetchTxJsonResult> {
  try {
    const response = await fetch(`${METRICS_URL}/tx-json-by-sender/${senderAddress}`);
    if (!response.ok) {
      return { success: false, txList: [], error: `Failed: ${response.status}` };
    }
    const data = await response.json();
    const txList: TxStateMachine[] = (data.tx_json || [])
      .map((jsonStr: string) => {
        try { return JSON.parse(jsonStr); } catch { return null; }
      })
      .filter(Boolean);
    return { success: true, txList };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch";
    return { success: false, txList: [], error: message };
  }
}

/**
 * Server Action to prepare an EVM transaction (Ethereum, Base, Polygon, Optimism, Arbitrum)
 * This replaces the direct API route call and keeps the logic server-side only
 */
export async function prepareEvmTransactionAction(
  txWireFormat: any,
): Promise<{ prepared: any }> {
  try {
    // Convert from wire format
    const tx = fromWire(txWireFormat);

    // Call the shared server function
    const prepared = await prepareEvmTransaction(tx);

    // Return in wire format
    return { prepared: toWire(prepared) };
  } catch (error: any) {
    console.error("Error in prepareEvmTransactionAction:", error);
    throw new Error(error.message || "Failed to prepare EVM transaction");
  }
}

/**
 * Server Action to prepare a BSC transaction
 */
export async function prepareBscTransactionAction(
  txWireFormat: any,
): Promise<{ prepared: any }> {
  try {
    const tx = fromWire(txWireFormat);
    const prepared = await prepareBscTransaction(tx);
    return { prepared: toWire(prepared) };
  } catch (error: any) {
    console.error("Error in prepareBscTransactionAction:", error);
    throw new Error(error.message || "Failed to prepare BSC transaction");
  }
}

/**
 * Server Action to prepare a Solana transaction
 */
export async function prepareSolanaTransactionAction(
  txWireFormat: any,
): Promise<{ prepared: any }> {
  try {
    const tx = fromWire(txWireFormat);
    const prepared = await prepareSolanaTransaction(tx);
    return { prepared: toWire(prepared) };
  } catch (error: any) {
    console.error("Error in prepareSolanaTransactionAction:", error);
    throw new Error(error.message || "Failed to prepare Solana transaction");
  }
}

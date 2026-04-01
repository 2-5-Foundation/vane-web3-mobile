"use server";

import { fromWire, toWire } from "@/lib/vane_lib/pkg/host_functions/networking";
import { prepareEvmTransaction } from "@/lib/server/tx/prepareEvm";
import { prepareBscTransaction } from "@/lib/server/tx/prepareBsc";
import { prepareSolanaTransaction } from "@/lib/server/tx/prepareSolana";
import type { TxStateMachine } from "@/lib/vane_lib/primitives";
import { jsPDF } from "jspdf";

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

export async function sendDiagnoseToTelegram(params: {
  sessionLogs: unknown;
  contact: string;
  walletAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = process.env.VANE_TG_BOT;
    const chatId = process.env.VANE_BOT_MESSAGE_ID;
    if (!token || !chatId) {
      return { success: false, error: "Telegram env vars are missing" };
    }

    const contact = (params.contact ?? "").trim();
    if (!contact) {
      return { success: false, error: "Contact is required" };
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 24;
    const lineHeight = 11;
    const maxWidth = width - margin * 2;
    const body = JSON.stringify(params.sessionLogs, null, 2) || "No session logs";
    const text = `Vane Diagnose Session Logs\n${new Date().toISOString()}\n\n${body}`;
    const lines = doc.splitTextToSize(text, maxWidth);
    let y = margin;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);

    for (const line of lines) {
      if (y > height - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    const pdfBlob = new Blob([doc.output("arraybuffer")], {
      type: "application/pdf",
    });

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", pdfBlob, "vane-diagnose-sessionlogs.pdf");
    form.append(
      "caption",
      `Vane diagnose\ncontact: ${contact}\nwallet: ${params.walletAddress ?? "unknown"}`.slice(
        0,
        1024,
      ),
    );

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    if (!res.ok) {
      return { success: false, error: `Failed: ${res.status}` };
    }
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send";
    return { success: false, error: message };
  }
}

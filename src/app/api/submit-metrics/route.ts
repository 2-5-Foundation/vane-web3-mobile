import { StorageExport } from "@/lib/vane_lib/primitives";
import { NextRequest, NextResponse } from "next/server";

export interface ClientMetricsPayload {
  peer_id: string;
  client_type: "wasm";
  timestamp: number;
  storage_export: StorageExport;
}

// it should accept the StoragExport and construct the ClientMetricsPayload

// you have to send it to this endpoint process.env.METRICS_SERVER_URL
const METRICS_SERVER_URL = process.env.METRICS_SERVER_URL;
if (!METRICS_SERVER_URL) {
  throw new Error("METRICS_SERVER_URL is not set");
}

export async function POST(request: NextRequest) {
  const storageExport = (await request.json()) as StorageExport;
  const peerId = storageExport.user_account!.multi_addr;

  const payload = {
    peer_id: peerId,
    client_type: "wasm",
    timestamp: Date.now(),
    storage_export: storageExport,
  } as ClientMetricsPayload;

  const response = await fetch(METRICS_SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to submit metrics" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Metrics received" });
}

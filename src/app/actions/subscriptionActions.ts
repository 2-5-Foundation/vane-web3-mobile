"use server";

const VANE_RPC_URL = process.env.VANE_RPC_URL || process.env.NEXT_PUBLIC_DHT_URL || "http://[::1]:8787";

// SubscriptionTier: 0 = NotActive, 1 = Weekly, 2 = Monthly

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(VANE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });

  if (!response.ok) throw new Error(`RPC failed: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.result as T;
}

export async function subscribeToVaneSafety(
  sig: number[],
  address: string,
  tier: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await rpcCall<void>("subscribeToVaneSafety", [sig, address, tier]);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to subscribe";
    return { success: false, error: message };
  }
}

export async function addAccountToSubscription(
  sig: number[],
  existingAddress: string,
  newAddress: string,
): Promise<{ success: boolean; tier?: number; error?: string }> {
  try {
    const tier = await rpcCall<number>("addAccountToSubscription", [sig, existingAddress, newAddress]);
    return { success: true, tier };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add account";
    return { success: false, error: message };
  }
}

export async function isSubscriptionActive(
  sig: number[],
  address: string,
): Promise<{ tier: number; error?: string }> {
  try {
    const tier = await rpcCall<number>("isSubscriptionActive", [sig, address]);
    return { tier };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check subscription";
    return { tier: 0, error: message };
  }
}

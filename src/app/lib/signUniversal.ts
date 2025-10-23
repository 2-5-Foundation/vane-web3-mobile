// useSignMessagePhantomRedirect.ts
"use client";
import { useEffect, useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isPhantomRedirectConnector } from "@dynamic-labs/wallet-connector-core";
import type { Wallet } from "@dynamic-labs/sdk-react-core";

type SignMessageEvent =
  | { signature: string | Uint8Array }
  | { errorCode?: string; errorMessage?: string; signature?: undefined };

interface PhantomConnector {
  on(event: "signMessage", cb: (resp: SignMessageEvent) => void): void;
  off(event: "signMessage", cb: (resp: SignMessageEvent) => void): void;
}

export function useSignMessagePhantomRedirect() {
  const { primaryWallet } = useDynamicContext();
  const [signature, setSignature] = useState<string | Uint8Array | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!primaryWallet || !isPhantomRedirectConnector(primaryWallet.connector)) return;

    const connector = primaryWallet.connector as unknown as PhantomConnector;
    const handler = (resp: SignMessageEvent) => {
      if ('signature' in resp) {
        setSignature(resp.signature);
      } else {
        setErrorCode(resp.errorCode);
        setErrorMessage(resp.errorMessage); 
      }
    };

    connector.on("signMessage", handler);
    return () => connector.off("signMessage", handler);
  }, [primaryWallet?.connector, primaryWallet]);

  // Kick off signing; for Phantom this will redirect and state will update after return.
  const execute = async (payload: string | Uint8Array) => {
    if (!primaryWallet) throw new Error("No wallet");
    // Convert Uint8Array to string if needed
    const messageToSign = payload instanceof Uint8Array ? 
      new TextDecoder().decode(payload) : 
      payload;
    await primaryWallet.signMessage(messageToSign);
  };

  console.log('signature', signature);
  console.log('errorCode', errorCode);
  console.log('errorMessage', errorMessage);
  return { execute, signature, errorCode, errorMessage };
}

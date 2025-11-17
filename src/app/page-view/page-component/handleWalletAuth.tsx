"use client";

import {
    DynamicContextProvider,
    // DynamicWidget,
  } from "@dynamic-labs/sdk-react-core";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { useTransactionStore } from "@/app/lib/useStore";

export default function DynamicWalletClientAuthProvider({ children }: { children: React.ReactNode }) {
const setUserProfile = useTransactionStore(state => state.setUserProfile);

  return (
    <DynamicContextProvider
      settings={{
        mobileExperience: 'redirect',
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_API_KEY!,
        initialAuthenticationMode:"connect-and-sign",
        walletConnectors: [BitcoinWalletConnectors, EthereumWalletConnectors, SolanaWalletConnectors],
        handlers: {
          handleConnectedWallet: async (args) => {
            try {
              setUserProfile({ account: args.address, network: args.chain });
              return true;
            } catch {
              return false;
            }
          },
        }, 
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}

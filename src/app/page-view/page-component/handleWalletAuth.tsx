"use client";

import {
    DynamicContextProvider,
    UserProfile,
    // DynamicWidget,
  } from "@dynamic-labs/sdk-react-core";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { useTransactionStore } from "@/app/lib/useStore";

export default function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const setUserProfile = useTransactionStore.getState().setUserProfile;

  const handleAuthenticatedUser = async (args: { user: UserProfile }) => {    
    let network = "";
    if(args.user.verifiedCredentials[0].chain === "eip155") {
      network = "Ethereum";
    }else{
      network = args.user.verifiedCredentials[0].chain;
    }
    // WASM initialization is now handled in page.tsx
  };

  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_API_KEY!,
        walletConnectors: [BitcoinWalletConnectors, EthereumWalletConnectors, SolanaWalletConnectors],
        handlers: {
            handleAuthenticatedUser,
            handleConnectedWallet: async (args) => {
                try{
                    setUserProfile({account: args.address, network: args.chain});
                    return true;
                }catch {
                    return false
                }
            },
        }, 
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}

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
  const { initializeWasm, startWatching, isWasmInitialized } = useTransactionStore.getState();

  const handleAuthenticatedUser = async (args: { user: UserProfile }) => {    
    let network = "";
    if(args.user.verifiedCredentials[0].chain === "eip155") {
      network = "Ethereum";
    }else{
      network = args.user.verifiedCredentials[0].chain;
    }
    
    // Initialize WASM when user authenticates
    try {
      if (!isWasmInitialized()) {
        await initializeWasm(
          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
          args.user.verifiedCredentials[0].address,
          network
        );
        await startWatching();
        console.log('WASM initialized and watching started');
      }
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
    }
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

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
  const registerUserRedis = useTransactionStore.getState().registerUserRedis;
  const setRpcurl = useTransactionStore.getState().setWsUrl;

  const handleAuthenticatedUser = async (args: { user: UserProfile }) => {    
    let network = "";
    if(args.user.verifiedCredentials[0].chain === "eip155") {
      network = "Ethereum";
    }else{
      network = args.user.verifiedCredentials[0].chain;
    }
    registerUserRedis([{address: args.user.verifiedCredentials[0].address, network: network}]);
  };

  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_API_KEY!,
        walletConnectors: [BitcoinWalletConnectors, EthereumWalletConnectors, SolanaWalletConnectors],
        handlers: {
            handleAuthenticatedUser,
            handleConnectedWallet: async (args) => {
                void args
                try{
                    setRpcurl(args.address);                  
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

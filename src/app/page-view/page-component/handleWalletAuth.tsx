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
import { keccak256, toHex } from "viem";

export default function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const registerUserAirtable = useTransactionStore.getState().registerUserAirtable;
  const setRegisterAirtable = useTransactionStore.getState().setRegisterAirtable;
  const setRpcurl = useTransactionStore.getState().setWsUrl;
  const airtable = useTransactionStore.getState().airtable;

  const handleAuthenticatedUser = async (args: { user: UserProfile }) => {
    setRegisterAirtable();
    console.log(airtable)
    const key = keccak256(toHex("airtable_user_id"));
    const keyExist = localStorage.getItem(key) !== null;
    
    console.log(keyExist)
    console.log(args.user.newUser)
    console.log(args.user.verifiedCredentials[0].chain)
    console.log(args.user.verifiedCredentials[0].refId)
    
    if (!keyExist) {
      let network = "";
      if(args.user.verifiedCredentials[0].chain === "eip155") {
        network = "Ethereum";
      }else{
        network = args.user.verifiedCredentials[0].chain;
      }
      registerUserAirtable(
        args.user.verifiedCredentials[0].address,
        network,
        args.user.email
      );
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
                void args
                try{
                    setRegisterAirtable(); 
                    setRpcurl()
                    // console.log("airtable 22")
                    // console.log(airtable)
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

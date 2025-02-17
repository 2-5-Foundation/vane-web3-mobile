"use client"

import {
    DynamicContextProvider,
    DynamicWidget,
  } from "@dynamic-labs/sdk-react-core";
  import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
  import { SolanaWalletConnectors } from "@dynamic-labs/solana";
  
  export default function DynamicWallet() {
    return (
      <DynamicContextProvider
        settings={{
          // Find your environment id at https://app.dynamic.xyz/dashboard/developer
          environmentId: "REPLACE-WITH-YOUR-ENVIRONMENT-ID",
          walletConnectors: [EthereumWalletConnectors, SolanaWalletConnectors],
        }}
      >
        <DynamicWidget />
      </DynamicContextProvider>
    );
  }
  
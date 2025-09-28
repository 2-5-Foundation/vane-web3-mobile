"use client"

import { useStore, useTransactionStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import { useEffect } from 'react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { toast } from 'sonner'
import { AppError } from './lib/errors'

// get the connected address from dynamic wallet
export default function Home() {
  const { primaryWallet } = useDynamicContext();
  const currentView = useStore(state => state.currentView)
  const { initializeWasm, startWatching, isWasmInitialized } = useTransactionStore();

  useEffect(() => {
    const initializeWasmNode = async () => {
      if (!primaryWallet?.address) return;

      try {
        if (!isWasmInitialized()) {
          await initializeWasm(
            'relay-multiaddr-here', // Replace with actual relay multiaddr
            primaryWallet.address,
            'Ethereum'
          );
          await startWatching();
          console.log('WASM initialized and watching started');
        }
      } catch (error) {
        if (error instanceof AppError) {
          console.error(error.message);
        } else if (error instanceof Error) {
          console.error(error.message);
        } else {
          toast.error('An unexpected error occurred');
        }
      }
    };

    initializeWasmNode();
  }, [primaryWallet, initializeWasm, startWatching, isWasmInitialized]);

  const renderView = () => {
    // Always show Wallets page regardless of connection state
    if (currentView === 'wallet') {
      return <Wallets />;
    }

    // If no wallet is connected, show normal pages
    if (!primaryWallet) {
      switch (currentView) {
        case 'transfers':
          return <Transfer />;
        case 'pending':
          return <Receive />;
        case 'profile':
          return <Profile />;
        default:
          return <Transfer />;
      }
    }

    // Normal flow when everything is connected
    switch (currentView) {
      case 'transfers':
        return <Transfer />;
      case 'pending':
        return <Receive />;
      case 'profile':
        return <Profile />;
      default:
        return <Transfer />;
    }
  }

  return renderView();
}

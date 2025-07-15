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
  const connectNode = useTransactionStore(state => state.setWsUrl);

  useEffect(() => {
    const connectToNode = async () => {
      if (!primaryWallet?.address) return;

      try {
        await connectNode(primaryWallet.address);
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

    connectToNode();
  }, [primaryWallet, connectNode]);

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

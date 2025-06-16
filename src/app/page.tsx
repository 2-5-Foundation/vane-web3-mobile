"use client"

import { useStore, useTransactionStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import { useEffect, useState } from 'react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { toast } from 'sonner'
import { AppError } from './lib/errors'

// get the connected address from dynamic wallet
export default function Home() {
  const { primaryWallet } = useDynamicContext();
  const currentView = useStore(state => state.currentView)
  const connectNode = useTransactionStore(state => state.setWsUrl);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const connectToNode = async () => {
      if (!primaryWallet?.address) return;

      setIsConnecting(true);
      setConnectionError(false);

      try {
        await connectNode(primaryWallet.address);
        setConnectionError(false);
      } catch (error) {
        setConnectionError(true);
        if (error instanceof AppError) {
          console.error(error.message);
        } else if (error instanceof Error) {
          console.error(error.message);
        } else {
          toast.error('An unexpected error occurred');
        }
      } finally {
        setIsConnecting(false);
      }
    };

    connectToNode();
  }, [primaryWallet, connectNode]);

  const LoadingSkeleton = () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-8 bg-[#4A5853]/20 rounded-md w-3/4"></div>
      <div className="space-y-3">
        <div className="h-20 bg-[#4A5853]/20 rounded-md"></div>
        <div className="h-20 bg-[#4A5853]/20 rounded-md"></div>
        <div className="h-20 bg-[#4A5853]/20 rounded-md"></div>
      </div>
    </div>
  );

  const ConnectionError = () => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <div className="text-[#7EDFCD] text-xl mb-2">Connecting your account</div>
      <div className="text-[#9EB2AD] text-sm">Please wait while we establish a secure connection...</div>
    </div>
  );

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

    // If wallet is connected but we're still connecting to node
    if (isConnecting) {
      return <LoadingSkeleton />;
    }

    // If there was an error connecting to node
    if (connectionError) {
      return <ConnectionError />;
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

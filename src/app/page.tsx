"use client"

import { useStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import Pending from './page-view/pending'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect } from 'react'


// get the connected address from dynamic wallet
export default function Home() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const currentView = useStore(state => state.currentView)

  
  const renderView = () => {
    // Always show Wallets page regardless of connection state
    if (currentView === 'wallet') {
      return <Wallets />;
    }

    // Normal flow when everything is connected
    switch (currentView) {
      case 'transfers':
        return <Transfer />;
      case 'pending':
        return <Pending />;
      case 'profile':
        return <Profile />;
      default:
        return <Transfer />;
    }
  }

  return renderView();
}

"use client"

import { useStore, useTransactionStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import Pending from './page-view/pending'
import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect, useRef } from 'react'
import { watchP2pNotifications, unsubscribeWatchP2pNotifications, isInitialized, BackendEvent, decodeTxStateMachine } from '@/lib/vane_lib/main'
import { toast } from 'sonner'
import { useDynamicContext, useUserWallets } from '@dynamic-labs/sdk-react-core'




// get the connected address from dynamic wallet
export default function Home() {
  const { removeWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const userWalletsRef = useRef(userWallets);
  const removeWalletRef = useRef(removeWallet);

  useEffect(() => {
    userWalletsRef.current = userWallets;
    removeWalletRef.current = removeWallet;
  }, [userWallets, removeWallet]);

  useEffect(() => {
    sdk.actions.ready();
  }, []);


  // Subscribe to P2P notifications - set up when WASM becomes initialized
  useEffect(() => {
    let isSubscribed = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const setupP2pWatch = () => {
      const wasmInitStatus = isInitialized();
      
      if (!wasmInitStatus) {
        return false;
      }

      if (isSubscribed) {
        return true;
      }

      isSubscribed = true;


      const handleBackendEvent = (event: BackendEvent) => {
        if (!event || typeof event !== 'object') {
          console.debug('Unhandled backend event', event);
          return;
        }

        if ('SenderRequestHandled' in event) {
          const txStateMachine = decodeTxStateMachine(event.SenderRequestHandled.data);
          toast.success(`Request received ${txStateMachine.receiverAddress}`);
          return;
        }

        if ('SenderConfirmed' in event) {
          const txStateMachine = decodeTxStateMachine(event.SenderConfirmed.data);
          toast.success(`You confirmed the transaction for receiver ${txStateMachine.receiverAddress}`);
          return;
        }

        if ('SenderReverted' in event) {
          const txStateMachine = decodeTxStateMachine(event.SenderReverted.data);
          toast.error(`Sender reverted for receiver ${txStateMachine.receiverAddress}`, {
            style: { background: '#fee2e2', color: '#991b1b' },
          });
          return;
        }


        if ('ReceiverResponseHandled' in event) {
          const txStateMachine = decodeTxStateMachine(event.ReceiverResponseHandled.data);
          toast.success(`Receiver responded ${txStateMachine.receiverAddress}`);
          return;
        }

        if ('PeerDisconnected' in event) {
          toast.error(`Peer disconnected: ${event.PeerDisconnected.account_id}`, {
            style: { background: '#fee2e2', color: '#991b1b' },
          });
          return;
        }

        if ('DataExpired' in event) {
          const txStateMachine = decodeTxStateMachine(event.DataExpired.data);
          toast.error(`Transaction expired for receiver ${txStateMachine.receiverAddress}`, {
            style: { background: '#fee2e2', color: '#991b1b' },
          });
          return;
        }


      if ('TxSubmitted' in event) {
        const txStateMachine = decodeTxStateMachine(event.TxSubmitted.data);
        toast.success(`Transaction submitted for receiver ${txStateMachine.receiverAddress}`);
        return;
      }

    };

      // Start watching P2P notifications
      watchP2pNotifications(handleBackendEvent)
        .then(() => {
          // Clear polling interval once subscribed
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        })
        .catch((error) => {
          isSubscribed = false;
        });
      
      return true;
    };

    // Try to set up immediately
    if (!setupP2pWatch()) {
      // If not initialized, poll every second until it is
      pollInterval = setInterval(() => {
        if (setupP2pWatch()) {
          // Successfully set up, stop polling
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }, 1000);
    }

    // Cleanup: unsubscribe on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      // Only unsubscribe if WASM is initialized and we actually subscribed
      if (isSubscribed && isInitialized()) {
        try {
          unsubscribeWatchP2pNotifications();
        } catch (error) {
          console.error('Error unsubscribing from P2P notifications:', error);
        }
      }
      isSubscribed = false;
    };
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

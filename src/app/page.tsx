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




// Helper function to normalize chain addresses for comparison
const normalizeChainAddress = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.split(':').pop()?.trim().toLowerCase() ?? '';
};

// get the connected address from dynamic wallet
export default function Home() {
  const { removeWallet, primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const userWalletsRef = useRef(userWallets);
  const removeWalletRef = useRef(removeWallet);
  const primaryWalletRef = useRef(primaryWallet);

  useEffect(() => {
    userWalletsRef.current = userWallets;
    removeWalletRef.current = removeWallet;
    primaryWalletRef.current = primaryWallet;
  }, [userWallets, removeWallet, primaryWallet]);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // One-time cleanup of all app-related localStorage items
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const hasClearedAllStorage = localStorage.getItem('vane-all-storage-cleared');
        if (!hasClearedAllStorage) {
          localStorage.removeItem('SubmissionPending');
          localStorage.removeItem('vane-storage-export');
          localStorage.removeItem('vane-storage-export-cleared');
          localStorage.setItem('vane-all-storage-cleared', 'true');
          console.log('One-time cleanup: Cleared all app-related localStorage items');
        }
      } catch (e) {
        console.warn('Unable to clear localStorage:', e);
      }
    }
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

      // Helper function to check if primary wallet is the sender
      const isPrimaryWalletSender = (txStateMachine: { senderAddress: string }): boolean => {
        const primaryWalletAddress = primaryWalletRef.current?.address;
        if (!primaryWalletAddress) {
          return false;
        }

        const normalizedPrimaryAddress = normalizeChainAddress(primaryWalletAddress);
        const normalizedSenderAddress = normalizeChainAddress(txStateMachine.senderAddress);

        return normalizedPrimaryAddress === normalizedSenderAddress;
      };

      // Helper function to check if transaction involves primary wallet (sender or receiver)
      const isPrimaryWalletInvolved = (txStateMachine: { senderAddress: string; receiverAddress: string }): boolean => {
        const primaryWalletAddress = primaryWalletRef.current?.address;
        if (!primaryWalletAddress) {
          return false;
        }

        const normalizedPrimaryAddress = normalizeChainAddress(primaryWalletAddress);
        const normalizedSenderAddress = normalizeChainAddress(txStateMachine.senderAddress);
        const normalizedReceiverAddress = normalizeChainAddress(txStateMachine.receiverAddress);

        return normalizedPrimaryAddress === normalizedSenderAddress || normalizedPrimaryAddress === normalizedReceiverAddress;
      };

      const handleBackendEvent = (event: BackendEvent) => {
        if (!event || typeof event !== 'object') {
          console.debug('Unhandled backend event', event);
          return;
        }

        if ('SenderRequestHandled' in event) {
          const txStateMachine = decodeTxStateMachine(event.SenderRequestHandled.data);
          if (isPrimaryWalletSender(txStateMachine)) {
            console.log('Request received', txStateMachine.receiverAddress);
          }
          return;
        }

      

        if ('SenderReverted' in event) {
          const txStateMachine = decodeTxStateMachine(event.SenderReverted.data);
          if (isPrimaryWalletSender(txStateMachine)) {
            toast.success(
              `You reverted successfully for receiver ${txStateMachine.receiverAddress}`,
              {
                className:
                  "bg-transparent border border-green-500/40 text-green-400",
              }
            );
          }
          return;
        }

        if ('ReceiverResponseHandled' in event) {
          const txStateMachine = decodeTxStateMachine(event.ReceiverResponseHandled.data);
          if (isPrimaryWalletInvolved(txStateMachine)) {
            toast.success(`Receiver responded for sender ${txStateMachine.senderAddress}`);
          }
          return;
        }

        if ('PeerDisconnected' in event) {
          // For PeerDisconnected, check if the account_id matches primary wallet
          const primaryWalletAddress = primaryWalletRef.current?.address;
          if (primaryWalletAddress) {
            const normalizedPrimaryAddress = normalizeChainAddress(primaryWalletAddress);
            const normalizedDisconnectedAddress = normalizeChainAddress(event.PeerDisconnected.account_id);
            if (normalizedPrimaryAddress === normalizedDisconnectedAddress) {
              toast.error(`Peer disconnected: ${event.PeerDisconnected.account_id}`, {
                style: { background: '#fee2e2', color: '#991b1b' },
              });
            }
          }
          return;
        }

        if ('DataExpired' in event) {
          const txStateMachine = decodeTxStateMachine(event.DataExpired.data);
          if (isPrimaryWalletInvolved(txStateMachine)) {
            toast.error(`Transaction expired for receiver ${txStateMachine.receiverAddress}`, {
              style: { background: '#fee2e2', color: '#991b1b' },
            });
          }
          return;
        }

        if ('TxSubmitted' in event) {
          const txStateMachine = decodeTxStateMachine(event.TxSubmitted.data);
          if (isPrimaryWalletInvolved(txStateMachine)) {
            toast.success(`Transaction submitted for receiver ${txStateMachine.receiverAddress}`);
          }
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

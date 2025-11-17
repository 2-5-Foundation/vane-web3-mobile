"use client"

import { useStore, useTransactionStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import Pending from './page-view/pending'
import { useDynamicContext, useUserWallets } from '@dynamic-labs/sdk-react-core'
import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect, useRef } from 'react'
import { watchP2pNotifications, unsubscribeWatchP2pNotifications, isInitialized, P2pEventResult } from '@/lib/vane_lib/main'
import { toast } from 'sonner'


// get the connected address from dynamic wallet
export default function Home() {
  const { removeWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const userWalletsRef = useRef(userWallets);
  const removeWalletRef = useRef(removeWallet);

  // Keep refs updated
  useEffect(() => {
    userWalletsRef.current = userWallets;
    removeWalletRef.current = removeWallet;
  }, [userWallets, removeWallet]);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(r => console.log('SW registered'))
        .catch(e => console.error(e));
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

      const updateNodeConnectionStatus = useTransactionStore.getState().updateNodeConnectionStatus;

      const handleP2pEvent = (event: P2pEventResult) => {
        // Handle string-based events
        if (typeof event === 'string') {
          switch (event) {
            case 'RelayerConnectionClosed':
            case 'PeerIsOffline':
              toast.error('App disconnected, refresh and reconnect', {
                style: {
                  background: '#fee2e2',
                  color: '#991b1b',
                },
              });
              // Update connection status
              updateNodeConnectionStatus();
              break;
              
            // case 'ReservationAccepted':
            case 'PeerIsOnline':
            case 'SenderCircuitEstablished':
              // toast.success('App connected');
              // Update connection status when peer comes online
              updateNodeConnectionStatus();
              break;
            default:
              break;
          }
          return;
        }

        // Handle object-based events
        if (typeof event === 'object' && event !== null) {
          // Dialing event
          if ('Dialing' in event) {
            const { address } = event.Dialing;
            const receiverAddress = address || 'receiver';
            toast.info(`Connecting to ${receiverAddress}`);
            return;
          }

          // ReceiverConnected event
          if ('ReceiverConnected' in event) {
            const { address } = event.ReceiverConnected;
            if (address && address !== 'unknown') {
              toast.success(`Receiver connected ${address}`);
            }
            return;
          }

          // SenderOutgoingConnectionError event
          if ('SenderOutgoingConnectionError' in event) {
            const { address } = event.SenderOutgoingConnectionError;
            const receiverAddress = address || 'receiver';
            toast.error(`Failed to connect to receiver ${receiverAddress}`, {
              style: {
                background: '#fee2e2',
                color: '#991b1b',
              },
            });
            return;
          }

          // PeerConnectionClosed event
          if ('PeerConnectionClosed' in event) {
            toast.error('Receiver disconnected', {
              style: {
                background: '#fee2e2',
                color: '#991b1b',
              },
            });
            return;
          }

          // RecvIncomingConnectionError event
          if ('RecvIncomingConnectionError' in event) {
            toast.error('Failed to process incoming request', {
              style: {
                background: '#fee2e2',
                color: '#991b1b',
              },
            });
            return;
          }

          // AccountAddedSuccessfully event
          if ('AccountAddedSuccessfully' in event) {
            const { account_id } = event.AccountAddedSuccessfully;
            toast.success(`Account linked successfully: ${account_id}`);
            return;
          }

          // AccountAdditionFailed event
          if ('AccountAdditionFailed' in event) {
            const { account_id } = event.AccountAdditionFailed;
            
            // Find wallet by address (account_id) using ref to avoid re-renders
            const wallet = userWalletsRef.current.find(w => w.address === account_id);
            const removeWalletFn = removeWalletRef.current;
            if (wallet && removeWalletFn) {
              // Unlink the wallet
              (async () => {
                try {
                  await removeWalletFn(wallet.id);
                } catch (error) {
                  console.error('Failed to unlink wallet:', error);
                }
              })();
            }
            
            toast.error('Account linking failed, try again');
            return;
          }
        }
      };

      // Start watching P2P notifications
      watchP2pNotifications(handleP2pEvent)
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
      unsubscribeWatchP2pNotifications();
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

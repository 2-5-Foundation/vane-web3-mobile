"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext, useUserWallets, IsBrowser, DynamicConnectButton, useWalletConnectorEvent } from "@dynamic-labs/sdk-react-core";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTransactionStore } from "@/app/lib/useStore";


export default function Wallets() {
  const {primaryWallet, handleLogOut } = useDynamicContext();
  const userWallets = useUserWallets();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnectingNode, setIsConnectingNode] = useState(false);
  const [connectingCountdown, setConnectingCountdown] = useState<number>(0);
  const [nodeConnectionStatus, setNodeConnectionStatus] = useState<{ relay_connected: boolean } | null>(null);
  const initializeWasm = useTransactionStore((s) => s.initializeWasm);
  const isWasmInitialized = useTransactionStore((s) => s.isWasmInitialized);
  const startWatching = useTransactionStore((s) => s.startWatching);
  const getNodeConnectionStatus = useTransactionStore((s) => s.getNodeConnectionStatus);
  const addAccount = useTransactionStore((s) => s.addAccount);
  const userProfile = useTransactionStore((s) => s.userProfile);

  
  // Pending link helpers
  const setPendingLink = (fromKeyId: string, toKeyId: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pending-link-from', fromKeyId);
    localStorage.setItem('pending-link-to', toKeyId);
  };
  const getPendingLink = (): { from: string | null; to: string | null } => {
    if (typeof window === 'undefined') return { from: null, to: null };
    return {
      from: localStorage.getItem('pending-link-from'),
      to: localStorage.getItem('pending-link-to'),
    };
  };
  const clearPendingLink = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('pending-link-from');
    localStorage.removeItem('pending-link-to');
  };


  const handleConnectNode = async () => {
    if (!primaryWallet || !userProfile.account || !userProfile.network) {
      toast.error('Please connect a wallet first');
      return;
    }

    // Helper: poll relay connection until true or timeout
    const waitForRelayConnected = async (maxSeconds = 60) => {
      for (let i = 0; i < maxSeconds; i++) {
        const status = await getNodeConnectionStatus();
        setNodeConnectionStatus(status);
        if (status.relay_connected) return true;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return false;
    };

    setIsConnectingNode(true);
    setConnectingCountdown(15);
    try {
      // Initialize node if not already initialized
      if (!isWasmInitialized()) {
        await initializeWasm(process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!, userProfile.account, userProfile.network);
        await startWatching();
        const connected = await waitForRelayConnected();
        if (connected) {
          toast.success('App connected successfully!');
        }
      } else {
        // Already initialized; keep loading animation until connected
        await waitForRelayConnected();
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to connect app`);
    } finally {
      setIsConnectingNode(false);
      setConnectingCountdown(0);
    }
  };
  // Countdown effect while connecting
  useEffect(() => {
    if (!isConnectingNode) return;
    if (connectingCountdown <= 0) return;
    const id = setInterval(() => {
      setConnectingCountdown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isConnectingNode, connectingCountdown]);

  const handleAddAccount = async () => {
    try {
      if (!primaryWallet) {
        toast.error('Connect a wallet first');
        return;
      }
      if (!selectedWallet) {
        toast.error('Select the account to add');
        return;
      }
      if (!userProfile.network) {
        toast.error('Select a network first');
        return;
      }

      // Find the wallet object for the selected address
      const target = userWallets.find((w) => w.address === selectedWallet);
      if (!target) {
        toast.error('Selected wallet not found');
        return;
      }

      // Call WASM to register account with the node
      await addAccount(selectedWallet, userProfile.network);

      toast.success('Account added successfully');
    } catch (error) {
      console.error('Add account failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add account');
    }
  };

  const handleWalletSelect = (address: string) => {
    setSelectedWallet(address);
  };

  // Automatically set selectedWallet when primaryWallet changes
  useEffect(() => {
    if (primaryWallet && !selectedWallet) {
      setSelectedWallet(primaryWallet.address);
    }
  }, [primaryWallet, selectedWallet]);

  // Check connection status on component mount
  useEffect(() => {
    const checkConnectionStatus = async () => {
      if (isWasmInitialized()) {
        try {
          const status = await getNodeConnectionStatus();
          setNodeConnectionStatus(status);
        } catch (error) {
          console.error('Error checking connection status:', error);
        }
      }
    };

    checkConnectionStatus();
  }, [isWasmInitialized, getNodeConnectionStatus]);

  // Add a ref to track previous connection status
  const prevConnectionStatus = useRef<boolean | null>(null);

  // Add this new useEffect to monitor connection status changes
  useEffect(() => {
    if (nodeConnectionStatus !== null) {
      const isCurrentlyConnected = nodeConnectionStatus.relay_connected;
      const wasPreviouslyConnected = prevConnectionStatus.current;
      
      // Check if we went from connected to disconnected
      if (wasPreviouslyConnected === true && isCurrentlyConnected === false) {
        toast.error('Node disconnected! Please check your connection and try reconnecting.', {
          duration: 10000, // Show for 10 seconds since it's important
          action: {
            label: 'Reconnect',
            onClick: () => handleConnectNode()
          }
        });
      }
      
      // Update the previous status
      prevConnectionStatus.current = isCurrentlyConnected;
    }
  }, [nodeConnectionStatus]);


  useWalletConnectorEvent(
    primaryWallet?.connector,
    'accountChange',
    ({ accounts }, connector) => {
      console.group('accountChange');
      console.log('accounts', accounts);
      console.log('connector that emitted', connector);
      console.groupEnd();
    },
  );

  // Add this filtering logic before the userWallets.map
  const filteredWallets = userWallets.filter((wallet) => {
    // Filter out Turnkey HD accounts and other embedded wallets
    const connectorName = wallet.connector?.name?.toLowerCase() || '';
    const isTurnkeyHD = connectorName.includes('turnkey') || connectorName.includes('hd');
    const isEmbeddedWallet = connectorName.includes('embedded') || connectorName.includes('managed');
    
    // Keep only the primary wallet (Phantom, Solflare, etc.) and exclude Turnkey HD
    return !isTurnkeyHD && !isEmbeddedWallet;
  });


  return (
    <IsBrowser>
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Select Wallet Section */}
      <div className="space-y-3">
        <div className="space-y-2">
          <RadioGroup value={selectedWallet || undefined} onValueChange={handleWalletSelect}>
            
            {filteredWallets.map((wallet) => (
              <Card key={wallet.address} className="bg-[#0D1B1B] border-[#4A5853]/20">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      defaultChecked
                      onClick={() => handleLogOut()}
                      value={wallet.address}
                      id={wallet.address}
                      className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-white">{wallet.connector?.name || 'Unknown'}</span>
                        <span className="text-[#4A5853] text-xs">{wallet.address.slice(0, 13)}...{wallet.address.slice(-13)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>

          {!primaryWallet && (
            <DynamicConnectButton
             buttonContainerClassName="w-full h-10 flex justify-center items-center bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 rounded-lg">
             Connect Wallet
            </DynamicConnectButton>
          )}

          {/* Connect Node Button - only show when wallet is connected */}
          {primaryWallet && (
            <Button
              onClick={handleConnectNode}
              disabled={isConnectingNode || (nodeConnectionStatus?.relay_connected === true)}
              className={`w-full h-10 ${
                nodeConnectionStatus?.relay_connected === true
                  ? 'bg-green-600/20 border-green-500/30 text-green-400 cursor-not-allowed' 
                  : 'bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90'
              } transition-all duration-200`}
            >
              {isConnectingNode ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                  {`Don't refresh the page${connectingCountdown > 0 ? ` • ${connectingCountdown}s` : '...'}`}
                </>
              ) : nodeConnectionStatus?.relay_connected === true ? (
                'App Connected'
              ) : (
                'Connect App'
              )}
            </Button>
          )}

          
{/* 
          <Button 
            onClick={handleConnectWallet}
            className="w-full h-10 bg-transparent border border-dashed border-[#7EDFCD]/20 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40"
          >
            + Add Wallet
          </Button> */}
          <Alert className="bg-blue-500/10 border-blue-400/30">
            <AlertTitle className="text-blue-400">Heads up!</AlertTitle>
            <AlertDescription className="text-blue-300">
              User experience will improve currently in open beta
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
    </IsBrowser>
  );
}


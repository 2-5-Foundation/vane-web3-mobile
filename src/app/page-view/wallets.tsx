"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext, useUserWallets, IsBrowser, DynamicConnectButton, useWalletConnectorEvent } from "@dynamic-labs/sdk-react-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { bytesToHex, hexToBytes } from "viem";
import { useTransactionStore } from "@/app/lib/useStore";
import { getKdfMessageBytes, cacheSignature, getCachedSignature, loadEnvelopeOrThrow, unlockCEKWithSignature, addWalletWrapWithSignatures } from "@/app/lib/keystore";


export default function Wallets() {
  const {primaryWallet, handleLogOut } = useDynamicContext();
  const userWallets = useUserWallets();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnectingNode, setIsConnectingNode] = useState(false);
  const [nodeConnectionStatus, setNodeConnectionStatus] = useState<{ relay_connected: boolean } | null>(null);
  const initializeWasm = useTransactionStore((s) => s.initializeWasm);
  const isWasmInitialized = useTransactionStore((s) => s.isWasmInitialized);
  const startWatching = useTransactionStore((s) => s.startWatching);
  const getNodeConnectionStatus = useTransactionStore((s) => s.getNodeConnectionStatus);
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

  const keyIdentifier = useMemo(() => {
    const normalized = (userProfile.network || '').toLowerCase();
    let prefix = 'evm';
    if (["ethereum","base","polygon","optimism","arbitrum","bnb","bsc"].includes(normalized)) prefix = 'evm';
    else if (["solana","sol"].includes(normalized)) prefix = 'sol';
    else if (["bitcoin","btc"].includes(normalized)) prefix = 'btc';
    return `${prefix}:${userProfile.account}`;
  }, [userProfile.account, userProfile.network]);

  const handleConnectNode = async () => {
    if (!primaryWallet || !userProfile.account || !userProfile.network) {
      toast.error('Please connect a wallet first');
      return;
    }

    setIsConnectingNode(true);
    try {
      // 1) Try to open existing keystore
      let env: any | null = null;
      try {
        env = await loadEnvelopeOrThrow();
      } catch {
        env = null;
      }

      // 2) Ensure we have a signature (cache first, otherwise sign now)
      let sigBytes = await getCachedSignature(keyIdentifier);
      if (!sigBytes) {
        const messageBytes = getKdfMessageBytes();
        const msgHex = bytesToHex(messageBytes) as `0x${string}`;
        const wallet = primaryWallet as unknown as { signMessage: (m: `0x${string}`) => Promise<`0x${string}`> };
        const sigHex = await wallet.signMessage(msgHex);
        sigBytes = hexToBytes(sigHex);
        await cacheSignature(keyIdentifier, sigBytes);
        toast.success('Wallet signature cached');
      }

      if (env) {
        const activeKeyId = env.activeKeyIdentifier as string;

        // 3) Try unlock with current wallet signature
        let canUnlock = true;
        try {
          await unlockCEKWithSignature(env, keyIdentifier, sigBytes);
        } catch {
          canUnlock = false;
        }

        // 4) If cannot unlock, prompt to connect original wallet to link
        if (!canUnlock) {
          const [, originalAddr] = activeKeyId.split(':');
          setPendingLink(activeKeyId, keyIdentifier);
          toast.info(`Keystore locked with ${originalAddr}. Please connect that wallet to link your current wallet.`);
          return;
        }

        // 5) If different active key, try to link using cached original signature
        if (activeKeyId !== keyIdentifier) {
          const originalSig = await getCachedSignature(activeKeyId);
          if (originalSig) {
            await addWalletWrapWithSignatures(env, activeKeyId, originalSig, keyIdentifier, sigBytes);
            clearPendingLink();
            toast.success('Wallets linked successfully!');
          } else {
            setPendingLink(activeKeyId, keyIdentifier);
            toast.info('Please connect the original wallet to link accounts');
            return;
          }
        } else {
          // active == current; check if there is a pending link target and we have its signature cached
          const { from, to } = getPendingLink();
          if (from && to && from === keyIdentifier) {
            const otherSig = await getCachedSignature(to);
            const mySig = await getCachedSignature(from);
            if (otherSig && mySig) {
              await addWalletWrapWithSignatures(env, from, mySig, to, otherSig);
              clearPendingLink();
              toast.success('Wallets linked successfully!');
            }
          }
        }
      }

      // 6) Initialize node if not already initialized
      if (!isWasmInitialized()) {
        await initializeWasm(process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!, userProfile.account, userProfile.network, sigBytes);
        await startWatching();
        
        // Check connection status after initialization
        const status = await getNodeConnectionStatus();
        setNodeConnectionStatus(status);
        
        if (status.relay_connected) {
          toast.success('Node connected successfully!');
        } else {
          toast.warning('Node initialized but not connected to relay');
        }
      } else {
        // Check existing connection status
        const status = await getNodeConnectionStatus();
        setNodeConnectionStatus(status);
        
        if (status.relay_connected) {
          toast.info('Node already connected');
        } else {
          toast.warning('Node initialized but not connected to relay');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to connect node: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsConnectingNode(false);
    }
  };

  const handleWalletSelect = (address: string) => {
    setSelectedWallet(address);
  };

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


  return (
    <IsBrowser>
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Select Wallet Section */}
      <div className="space-y-3">
        <div className="space-y-2">
          <RadioGroup value={selectedWallet || undefined} onValueChange={handleWalletSelect}>
            
            {userWallets.map((wallet) => (
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
                        <span className="text-[#4A5853] text-xs">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>

          <DynamicConnectButton
           buttonContainerClassName="w-full h-10 flex justify-center items-center bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 rounded-lg">
           {primaryWallet ? "Change Wallet" : "Connect Wallet"}
          </DynamicConnectButton>

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
                  Connecting Node...
                </>
              ) : nodeConnectionStatus?.relay_connected === true ? (
                'Node Connected'
              ) : (
                'Connect Node'
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


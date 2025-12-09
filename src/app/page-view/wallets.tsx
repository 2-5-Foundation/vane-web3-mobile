"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext, useUserWallets, IsBrowser, useWalletConnectorEvent, useDynamicModals, DynamicMultiWalletPromptsWidget, useSwitchWallet } from "@dynamic-labs/sdk-react-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTransactionStore } from "@/app/lib/useStore";
import { Copy, Plus, X, MoreVertical } from "lucide-react";
import Image from "next/image";


export default function Wallets() {
  const {primaryWallet, handleLogOut, removeWallet, setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const switchWallet = useSwitchWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [longPressedWallet, setLongPressedWallet] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpenWallet, setMenuOpenWallet] = useState<string | null>(null);
  const isWasmInitialized = useTransactionStore((s) => s.isWasmInitialized);
  const addAccount = useTransactionStore((s) => s.addAccount);
  const setUserProfile = useTransactionStore((s) => s.setUserProfile);
  const userProfile = useTransactionStore((s) => s.userProfile);
  const exportStorageData = useTransactionStore((s) => s.exportStorageData);
  const prevWalletsRef = useRef<Set<string>>(new Set());
  const hasCheckedStorageRef = useRef<boolean>(false);


  const handleWalletSelect = async (address: string) => {
    // Check if this wallet is already the primary wallet
    if (primaryWallet && primaryWallet.address === address) {
      // Already selected, don't do anything
      return;
    }
    
    // Find the wallet by address
    const targetWallet = userWallets.find(w => w.address === address);
    if (!targetWallet) {
      toast.error('Wallet not found');
      return;
    }
    
    // Double-check we're not already on this wallet
    if (primaryWallet && primaryWallet.id === targetWallet.id) {
      return;
    }
    
    try {
      // Switch to the selected wallet using its ID
      await switchWallet(targetWallet.id);
      // update the user profile
      setUserProfile({
        account: targetWallet.address,
        network: targetWallet.chain,
      });
      // Note: primaryWallet will update via useEffect when Dynamic SDK updates it
    } catch (error) {
      toast.error('Failed to switch wallet');
      console.error('Switch wallet error:', error);
    }
  };

  const handleLinkNewWallet = () => {
    setShowLinkNewWalletModal(true);
  };

  const handleCopyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleDisconnectWallet = async (walletId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLongPressedWallet(null);
    setMenuOpenWallet(null);
    
    const walletToRemove = userWallets.find(w => w.id === walletId);
    
    if (!walletToRemove) {
      toast.error('Wallet not found');
      return;
    }
    
    const isPrimaryWallet = primaryWallet && walletToRemove.address === primaryWallet.address;
    
    try {
      // If it's the primary wallet, disconnect first using handleLogOut
      if (isPrimaryWallet && handleLogOut) {
        try {
          await handleLogOut();
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (disconnectError) {
          toast.error('Failed to disconnect primary wallet');
          return;
        }
      }

      // For non-primary wallets or after primary disconnect, remove the wallet
      if (!removeWallet) {
        toast.error('Remove wallet function not available');
        return;
      }

      // Remove the wallet by ID
      await removeWallet(walletId);
      
      // Check if wallet was removed
      const checkInterval = setInterval(() => {
        if (!userWallets.find(w => w.id === walletId)) {
          clearInterval(checkInterval);
          toast.success('Wallet unlinked successfully');
        }
      }, 200);
      
      // Stop checking after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (userWallets.find(w => w.id === walletId)) {
          toast.error('Wallet removal may have failed. Please refresh the page.');
        }
      }, 5000);
      
    } catch (error) {
      toast.error(`Failed to unlink wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLongPressStart = (walletId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedWallet(walletId);
    }, 500); // 500ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (longPressedWallet) {
        const target = e.target as HTMLElement;
        // Check if click is outside the tooltip
        if (!target.closest('[data-tooltip]')) {
          setLongPressedWallet(null);
        }
      }
      if (menuOpenWallet) {
        const target = e.target as HTMLElement;
        // Check if click is outside the menu
        if (!target.closest('[data-menu]')) {
          setMenuOpenWallet(null);
        }
      }
    };

    if (longPressedWallet || menuOpenWallet) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [longPressedWallet, menuOpenWallet]);

  // Automatically set selectedWallet when primaryWallet changes
  useEffect(() => {
    if (primaryWallet) {
      setSelectedWallet(primaryWallet.address);
      console.log('Primary wallet updated:', primaryWallet.address);
    }
  }, [primaryWallet]);


  useWalletConnectorEvent(
    primaryWallet?.connector,
    'accountChange',
    ({ accounts }, connector) => {
    },
  );

  // Initialize prevWalletsRef on mount to avoid treating existing wallets as new
  useEffect(() => {
    if (prevWalletsRef.current.size === 0 && userWallets.length > 0) {
      prevWalletsRef.current = new Set(userWallets.map(w => w.address));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect new wallets and call addAccount (only when a new wallet is actually added)
  useEffect(() => {
    const checkAndAddNewWallets = async () => {
      if (!isWasmInitialized() || !userProfile.network) return;
      
      const currentWalletAddresses = new Set(userWallets.map(w => w.address));
      const prevWalletAddresses = prevWalletsRef.current;
      
      // Find new wallets (only those not in previous set)
      const newWallets = userWallets.filter(w => !prevWalletAddresses.has(w.address));
      
      if (newWallets.length > 0) {
        try {
          // Fetch storage to check if accounts are already registered
          const storage = await exportStorageData();
          
          // Get registered accounts from storage
          const registeredAccounts = new Set<string>();
          if (storage?.user_account?.accounts) {
            storage.user_account.accounts.forEach(([address]) => {
              registeredAccounts.add(address.toLowerCase());
            });
          }
          
          // Call addAccount only for wallets not already in storage
          for (const wallet of newWallets) {
            const walletAddressLower = wallet.address.toLowerCase();
            if (!registeredAccounts.has(walletAddressLower)) {
              try {
                await addAccount(wallet.address, userProfile.network);
              } catch (error) {
                console.error('Error adding account:', error);
              }
            } else {
              console.log(`Account ${wallet.address} already registered in storage, skipping`);
            }
          }
        } catch (error) {
          console.error('Error fetching storage data:', error);
          // If storage fetch fails, still try to add accounts (fallback behavior)
          for (const wallet of newWallets) {
            try {
              await addAccount(wallet.address, userProfile.network);
            } catch (addError) {
              console.error('Error adding account:', addError);
            }
          }
        }
        
        // Update ref after processing new wallets
        prevWalletsRef.current = currentWalletAddresses;
      }
    };

    checkAndAddNewWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWallets, userProfile.network]);

  // Check storage and register missing accounts after node is connected (runs only once)
  useEffect(() => {
    const checkAndRegisterAccounts = async () => {
      // Only run if WASM is initialized and we haven't checked yet
      console.log('Checking storage and registering accounts');
      if (
        !isWasmInitialized() ||
        hasCheckedStorageRef.current ||
        userWallets.length === 0
      ) {
        return;
      }
      console.log('Checking storage and registering accounts 2');

      // Mark as checked immediately to prevent concurrent runs
      hasCheckedStorageRef.current = true;

      try {
        // Fetch storage data
        const storage = await exportStorageData();
        
        if (!storage) {
          console.log('No storage data found, registering all wallets');
          // If no storage, register all wallets
          for (const wallet of userWallets) {
            try {
              await addAccount(wallet.address, wallet.chain);
            } catch (error) {
              console.error(`Error adding account ${wallet.address}:`, error);
            }
          }
          return;
        }

        // Get registered accounts from storage
        const registeredAccounts = new Set<string>();
        if (storage.user_account?.accounts) {
          storage.user_account.accounts.forEach(([address]) => {
            registeredAccounts.add(address.toLowerCase());
          });
        }

        // Check each wallet and register if not in storage
        for (const wallet of userWallets) {
          const walletAddressLower = wallet.address.toLowerCase();
          if (!registeredAccounts.has(walletAddressLower)) {
            try {
              console.log(`Registering missing account: ${wallet.address} on ${wallet.chain}`);
              await addAccount(wallet.address, wallet.chain);
            } catch (error) {
              console.error(`Error adding account ${wallet.address}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error checking storage for accounts:', error);
        // Reset the ref on error so it can be retried
        hasCheckedStorageRef.current = false;
      }
    };

    checkAndRegisterAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWasmInitialized(), userWallets.length]);



  const handleConnectWallet = () => {
    setShowAuthFlow(true);
  };

  return (
    <IsBrowser>
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Link Wallet */}
      <div className="mb-4 flex items-center justify-start">
        <Button
          onClick={handleLinkNewWallet}
          disabled={!primaryWallet}
          className={`bg-transparent border text-white rounded-lg px-3 py-1 h-7 text-xs font-bold flex items-center gap-1.5 transition-all duration-150 ${
            !primaryWallet
              ? 'border-[#4A5853] text-[#4A5853] cursor-not-allowed opacity-50'
              : 'border-[#7EDFCD] hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black'
          }`}
        >
          <Plus className="h-2.5 w-2.5 stroke-[2.5]" />
          Link New Wallet
        </Button>
      </div>

      {/* Select Wallet Section */}
      <div className="space-y-3">
        <div className="space-y-2">
          <RadioGroup 
            value={primaryWallet?.address || undefined} 
            onValueChange={handleWalletSelect}
          >
            
            {userWallets.map((wallet) => (
              <div key={wallet.address} className="relative">
                <Card 
                  className="bg-[#0D1B1B] border-[#4A5853]/20 relative cursor-pointer active:bg-[#0D1B1B]/80 transition-colors"
                  onMouseDown={() => handleLongPressStart(wallet.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() => handleLongPressStart(wallet.id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      checked={primaryWallet?.address === wallet.address}
                      value={wallet.address}
                      id={wallet.address}
                      className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                      onClick={(e) => {
                        if (longPressedWallet === wallet.id || menuOpenWallet === wallet.id) {
                          e.stopPropagation();
                        }
                        // Debug: Log what's being clicked vs what's primary
                        console.log('RadioGroupItem clicked:', {
                          clickedAddress: wallet.address,
                          primaryWalletAddress: primaryWallet?.address
                        });
                      }}
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {wallet.connector?.metadata?.icon ? (
                          <Image
                            src={wallet.connector.metadata.icon}
                            alt={wallet.connector?.name || 'Wallet icon'}
                            width={20}
                            height={20}
                            className="rounded"
                            unoptimized
                          />
                        ) : (
                          <span className="text-white text-sm">{wallet.connector?.name || 'Unknown'}</span>
                        )}
                        <span className="text-[#4A5853] text-xs">{wallet.address.slice(0, 13)}...{wallet.address.slice(-13)}</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenWallet(menuOpenWallet === wallet.id ? null : wallet.id);
                          }}
                          className="h-4 w-4 flex items-center justify-center hover:bg-[#4A5853]/20 rounded transition-colors flex-shrink-0"
                          aria-label="Wallet options"
                          tabIndex={0}
                        >
                          <MoreVertical className="h-3 w-3 text-[#7EDFCD]" />
                        </button>
                        
                        {/* Menu Dropdown */}
                        {menuOpenWallet === wallet.id && (
                          <div 
                            data-menu
                            className="absolute right-0 top-6 z-30 bg-[#0D1B1B] border border-[#4A5853]/40 rounded-xl shadow-xl min-w-[160px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                handleCopyAddress(wallet.address, e);
                                setMenuOpenWallet(null);
                              }}
                              className="w-full text-left text-white hover:bg-[#7EDFCD]/40 hover:text-black text-sm font-medium px-4 py-2.5 first:rounded-t-xl transition-all duration-200 flex items-center gap-2.5"
                              aria-label="Copy address"
                            >
                              <Copy className="h-4 w-4 text-[#7EDFCD]" />
                              Copy address
                            </button>
                            <button
                              onClick={(e) => {
                                handleDisconnectWallet(wallet.id, e);
                                setMenuOpenWallet(null);
                              }}
                              className="w-full text-left text-red-400 hover:text-red-500 hover:bg-[#7EDFCD]/30 text-sm font-medium px-4 py-2.5 last:rounded-b-xl transition-all duration-200 flex items-center gap-2.5"
                              aria-label="Unlink wallet"
                            >
                              <X className="h-4 w-4" />
                              Unlink wallet
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Long Press Tooltip - Disconnect Button */}
              {longPressedWallet === wallet.id && (
                <div 
                  data-tooltip
                  className="absolute -top-9 right-0 z-20 bg-[#0D1B1B] border border-red-500/60 rounded-md shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => handleDisconnectWallet(wallet.id, e)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[10px] font-medium px-2.5 py-1.5 rounded transition-colors"
                    aria-label="Unlink wallet"
                  >
                    Unlink
                  </button>
                </div>
              )}
            </div>
            ))}
          </RadioGroup>

          {!primaryWallet && (
            <Button
              type="button"
              onClick={handleConnectWallet}
              className="w-full h-10 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg"
            >
              Connect Wallet
            </Button>
          )}

          
          <Alert className="bg-blue-500/10 border-blue-400/30">
            <AlertTitle className="text-blue-400">Heads up!</AlertTitle>
            <AlertDescription className="text-blue-300">
              User experience will improve currently in open beta.
            </AlertDescription>
            <AlertDescription className="text-blue-300">
              Phantom wallet will only work in in-app browser, and if some wallet fails to connect, please share the issue on{' '}
              <a 
                href="https://x.com/VaneNetwork_" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-200 hover:text-blue-100 underline font-bold text-base"
              >
                X
              </a>
            </AlertDescription>
          </Alert>
        </div>
      </div>
      <DynamicMultiWalletPromptsWidget />
    </div>
    </IsBrowser>
  );
}
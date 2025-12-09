"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useDynamicContext, useTokenBalances, useUserWallets } from '@dynamic-labs/sdk-react-core'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useTransactionStore } from "@/app/lib/useStore"
import { Rocket, Download, TrendingUp, ArrowLeft, User, Send } from "lucide-react"
import { ChainEnum, TokenBalance } from "@dynamic-labs/sdk-api-core"
import { Button } from "@/components/ui/button"
import { Token, getTokenDecimals } from "@/lib/vane_lib/primitives"
import { getTokenLabel } from "./page-component/sender-pending"

// Supported network IDs
const SOLANA_NETWORK_ID = 101;
const EVM_NETWORK_IDS = [1, 56, 10, 42161, 137, 8453]; // Ethereum, BNB, Optimism, Arbitrum, Polygon, Base

// Separate component for token balances that only mounts after network is known
const TokenBalancesComponent = ({ networkId, onBalancesChange }: { networkId: number, onBalancesChange: (balances: any[]) => void }) => {
  const tokenBalanceArgs = useMemo(() => {
    const base = { includeFiat: true, includeNativeBalance: true };
    
    if (networkId === 101) {
      return { ...base, chainName: ChainEnum.Sol };
    } else if (networkId === 1 || networkId === 56 || networkId === 10 || networkId === 42161) {
      return { ...base, chainName: ChainEnum.Evm, networkId };
    }
    
    return base;
  }, [networkId]);

  const { tokenBalances, isLoading, isError } = useTokenBalances(tokenBalanceArgs);

  useEffect(() => {
    onBalancesChange(tokenBalances || []);
  }, [tokenBalances, onBalancesChange]);

  return null; // This component doesn't render anything, just handles token balance fetching
}

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'receive'>('transfer')
  const [balance, setBalance] = useState("0")
  const [availableTokens, setAvailableTokens] = useState<any[]>([])
  const [currentNetworkId, setCurrentNetworkId] = useState<number | null>(null)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [transferType, setTransferType] = useState<'self' | 'external' | null>(null)
  const [failedTransactionsValue, setFailedTransactionsValue] = useState<number>(0)
  const [failedTransactionCount, setFailedTransactionCount] = useState<number>(0)

  const { primaryWallet } = useDynamicContext()
  const userWallets = useUserWallets()
  const { exportStorageData, isWasmInitialized, initializeWasm, startWatching } = useTransactionStore()
  const [isInitializing, setIsInitializing] = useState(false)
  const [balancesRefreshToken, setBalancesRefreshToken] = useState<number>(0)

  const syncNetworkIdOnce = useCallback(async () => {
    if (!primaryWallet) return
    try {
      const networkId = Number(await primaryWallet.getNetwork())
      setCurrentNetworkId(networkId)
    } catch (error) {
      console.error('Error syncing network for balances:', error)
    }
  }, [primaryWallet])

  // Get token balances with network-specific parameters (same pattern as total balance)
  const tokenBalanceArgs = useMemo(() => {
    if (!currentNetworkId) return undefined;

    const base = { includeFiat: true, includeNativeBalance: true };
    
    // Solana
    if (currentNetworkId === SOLANA_NETWORK_ID) {
      return { ...base, chainName: ChainEnum.Sol };
    }
    
    // EVM chains: Ethereum (1), BNB (56), Optimism (10), Arbitrum (42161), Polygon (137), Base (8453)
    if (EVM_NETWORK_IDS.includes(currentNetworkId)) {
      return { ...base, chainName: ChainEnum.Evm, networkId: currentNetworkId };
    }
    
    // Unsupported chain - return undefined
    return undefined;
  }, [currentNetworkId]);

  const { tokenBalances } = useTokenBalances(tokenBalanceArgs);

  // Calculate USD value for a failed transaction
  const calculateTransactionValue = useCallback((amount: bigint, token: Token, balances: TokenBalance[]): number => {
    if (!balances?.length) return 0;

    const tokenSymbol = getTokenLabel(token);
    if (!tokenSymbol) return 0;

    const balance = balances.find((b: any) => 
      b.symbol?.toUpperCase() === tokenSymbol.toUpperCase() || 
      b.name?.toUpperCase() === tokenSymbol.toUpperCase()
    );
    if (!balance) return 0;

    const decimals = getTokenDecimals(token);
    if (!decimals) return 0;

    const tokenAmount = Number(amount) / Math.pow(10, decimals);
    const pricePerToken = balance.price || (balance.marketValue && balance.balance > 0 ? balance.marketValue / balance.balance : 0);
    
    return tokenAmount * pricePerToken;
  }, [])
 
   // Handle token balances from the separate component
   const handleBalancesChange = useCallback((balances: any[]) => {
     if (balances && balances.length > 0) {
       // Sum all tokens' marketValue
       const totalValue = balances.reduce((sum, token) => {
         return sum + (token.marketValue || 0);
       }, 0);
       setBalance(totalValue.toString());
       setAvailableTokens(balances);
     } else {
       setBalance("0");
       setAvailableTokens([]);
     }
   }, [])

  // Derive network ID from Dynamic SDK for token balances
   useEffect(() => {
    const syncNetworkId = async () => {
      if (!primaryWallet) {
        setCurrentNetworkId(null)
        return
      }

      try {
        const networkId = Number(await primaryWallet.getNetwork())
          setCurrentNetworkId(networkId)
      } catch (error) {
        console.error('Error fetching network from Dynamic:', error)
      }
    }

    // Sync immediately when primaryWallet changes
    syncNetworkId()

    // Poll for network changes (important for redirect mode where page may reload)
    const pollInterval = setInterval(() => {
      if (primaryWallet) {
        syncNetworkId()
      }
    }, 1500) // Poll every 1.5 seconds

    return () => clearInterval(pollInterval)
   }, [primaryWallet])

  // Ensure current network is synced when wallet connects or form opens
  useEffect(() => {
    syncNetworkIdOnce()
    setBalancesRefreshToken(Date.now())
  }, [primaryWallet, showTransferForm, syncNetworkIdOnce])

  // Ensure current network is synced when wallet connects or form is opened
  useEffect(() => {
    syncNetworkIdOnce()
  }, [primaryWallet, showTransferForm, syncNetworkIdOnce])

   // Calculate total value and count of failed transactions using useTokenBalances
   useEffect(() => {
    const calculateFailedTransactionsValue = async () => {
      if (!isWasmInitialized()) return;
      
      try {
        const storageExport = await exportStorageData();
        if (!storageExport?.failed_transactions) {
          setFailedTransactionsValue(0);
          setFailedTransactionCount(0);
          return;
        }

        // Set the count
        setFailedTransactionCount(storageExport.failed_transactions.length);

        // Calculate total value if we have token balances
        if (!tokenBalances?.length) {
          setFailedTransactionsValue(0);
          return;
        }

        let totalValue = 0;
        storageExport.failed_transactions.forEach((tx) => {
          const value = calculateTransactionValue(BigInt(tx.amount), tx.token, tokenBalances);
          totalValue += value;
        });

        setFailedTransactionsValue(totalValue);
    } catch (error) {
        console.error('Error calculating failed transactions value:', error);
        setFailedTransactionsValue(0);
        setFailedTransactionCount(0);
    }
    };

    calculateFailedTransactionsValue();
  }, [isWasmInitialized, exportStorageData, tokenBalances, calculateTransactionValue])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 px-4 max-w-sm mx-auto">
      {/* Token Balances Component - only renders after network is known */}
      {currentNetworkId && (
        <TokenBalancesComponent 
          key={`${currentNetworkId}-${primaryWallet?.address ?? 'no-wallet'}-${balancesRefreshToken}`}
          networkId={currentNetworkId} 
          onBalancesChange={handleBalancesChange} 
        />
      )}
      
      {/* Balance Display */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1 mb-3">
        <p className="text-gray-400 text-xs font-medium">Total Available Balance</p>
        <p className="text-2xl font-light text-white">${parseFloat(balance).toFixed(4)}</p>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="transfer" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
        <TabsList className="grid grid-cols-2 bg-[#1a2628] p-0.5 h-auto">
          <TabsTrigger value="transfer" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]">
            <Rocket className="h-4 w-4" /> Transfer
          </TabsTrigger>
          <TabsTrigger value="receive" className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]">
            <Download className="h-4 w-4" /> Verifiable Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="mt-4">
          {!showTransferForm ? (
            <div className="space-y-4">
              {/* Selection Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#0D1B1B] rounded-lg p-4 flex flex-col space-y-3"
              >
                <TrendingUp className="w-3 h-3 text-gray-400 mb-1" />
                <p className="text-gray-300 text-base font-medium mb-1 tracking-wide">Total funds protected by Vane</p>
                <p className="text-xs text-gray-500">These funds could have been lost due to transactional mistakes.</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-lg font-light text-gray-300">${failedTransactionsValue.toFixed(4)}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-400">Safe Reverts</p>
                    <p className="text-lg font-light text-gray-300">{failedTransactionCount}</p>
                  </div>
                </div>
              </motion.div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    // Check if wallet list has more than 1 wallet
                    if (userWallets.length <= 1) {
                      toast.error('Wallet linked should be more than 1')
                      return
                    }
                    
                    await syncNetworkIdOnce()
                    setTransferType('self')
                    setShowTransferForm(true)
                    
                    // Initialize node with self_node: true
                    if (!isWasmInitialized() && primaryWallet && !isInitializing) {
                      setIsInitializing(true)
                      try {
                        await initializeWasm(
                          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
                          primaryWallet.address,
                          primaryWallet.chain,
                          false, // self_node: false for now
                          true  // live: true
                        )
                        await startWatching()
                      } catch (error) {
                        console.error('Failed to initialize node:', error)
                      } finally {
                        setIsInitializing(false)
                      }
                    }
                  }}
                  className="flex-1 h-20 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg text-xs font-medium ml-2 flex flex-col items-center justify-center gap-1"
                >
                  <User className="h-5 w-5" />
                  Safe Self Transfer
                </Button>
                <Button
                  onClick={async () => {
                    await syncNetworkIdOnce()
                    setTransferType('external')
                    setShowTransferForm(true)
                    
                    // Initialize node with self_node: false
                    if (!primaryWallet) {
                      toast.error('Connect wallet first')
                      return
                    }
                    if (!isWasmInitialized() && primaryWallet && !isInitializing) {
                      setIsInitializing(true)
                      try {
                        await initializeWasm(
                          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
                          primaryWallet.address,
                          primaryWallet.chain,
                          false, // self_node: false
                          true   // live: true
                        )
                        await startWatching()
                      } catch (error) {
                        console.error('Failed to initialize node:', error)
                      } finally {
                        setIsInitializing(false)
                      }
                    }
                  }}
                  className="flex-1 h-20 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg text-xs font-medium mr-2 flex flex-col items-center justify-center gap-1"
                >
                  <Send className="h-5 w-5" />
                  Safe External Transfer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Back Button with Breadcrumb */}
              <Button
                onClick={() => {
                  setShowTransferForm(false)
                  setTransferType(null)
                }}
                variant="ghost"
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-2 p-0 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs">
                  Transfer {transferType && '>'} {transferType === 'self' ? 'Self Transfer' : transferType === 'external' ? 'External Transfer' : ''}
                </span>
              </Button>
              <TransferForm 
                tokenList={availableTokens} 
                transferType={transferType} 
                userWallets={userWallets}
                onNetworkChange={(id) => setCurrentNetworkId(id)}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="receive" className="mt-4">
          <TransferReceive />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

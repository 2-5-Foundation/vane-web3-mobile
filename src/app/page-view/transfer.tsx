"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useDynamicContext, useTokenBalances } from '@dynamic-labs/sdk-react-core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Rocket, Download, Network } from "lucide-react"
import { ChainEnum } from "@dynamic-labs/sdk-api-core"

// Separate component for token balances that only mounts after network is known
const TokenBalancesComponent = ({ networkId, onBalancesChange }: { networkId: number, onBalancesChange: (balances: any[]) => void }) => {
  const tokenBalanceArgs = useMemo(() => {
    const base = { includeFiat: true, includeNativeBalance: true };
    
    if (networkId === 101) {
      return { ...base, chainName: ChainEnum.Sol };
    } else if (networkId === 1 || networkId === 56) {
      return { ...base, chainName: ChainEnum.Evm, networkId };
    }
    
    return base;
  }, [networkId]);

  const { tokenBalances, isLoading, isError } = useTokenBalances(tokenBalanceArgs);

  const stableOnBalancesChange = useCallback(onBalancesChange, []);

  useEffect(() => {
    stableOnBalancesChange(tokenBalances || []);
  }, [tokenBalances, stableOnBalancesChange]);

  return null; // This component doesn't render anything, just handles token balance fetching
}

// EVM Networks configuration
const EVM_NETWORKS = [
  { id: 1, name: "Ethereum", value: "ethereum" },
  { id: 56, name: "BNB Smart Chain", value: "bnb" }
]

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'receive'>('transfer')
  const [balance, setBalance] = useState("0")
  const [network, setNetwork] = useState<string>("")
  const [availableTokens, setAvailableTokens] = useState<any[]>([])
  const [selectedEVMNetwork, setSelectedEVMNetwork] = useState<string>("ethereum")
  const [showNetworkDropdown, setShowNetworkDropdown] = useState<boolean>(false)
  const [currentNetworkId, setCurrentNetworkId] = useState<number | null>(null)

  const { primaryWallet } = useDynamicContext()
 
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

   useEffect(() => {
    const fetchNetwork = async () => {
      if (primaryWallet) {
        const networkId = Number(await primaryWallet.getNetwork())
        setCurrentNetworkId(networkId)
        
        // Check if current network is EVM
        const isEVMBased = EVM_NETWORKS.some(evmNetwork => evmNetwork.id === networkId)
        setShowNetworkDropdown(isEVMBased)
        
        if (networkId === 1) {
          setNetwork("Ethereum")
          setSelectedEVMNetwork("ethereum")
        } else if (networkId === 137) {
          setNetwork("Polygon")
          setSelectedEVMNetwork("ethereum")
        } else if (networkId === 8453) {
          setNetwork("Base")
          setSelectedEVMNetwork("ethereum")
        } else if (networkId === 56) {
          setNetwork("BNB Smart Chain")
          setSelectedEVMNetwork("bnb")
        } else if (networkId === 101) {
          setNetwork("Solana")
          setSelectedEVMNetwork("solana")
        }
      }
    }
    fetchNetwork()
   }, [primaryWallet])

  const handleNetworkSwitch = async (networkValue: string) => {
    if (!primaryWallet) return
    
    try {
      const targetNetwork = EVM_NETWORKS.find(network => network.value === networkValue)
      
      if (!targetNetwork) {
        console.error('Network not found:', networkValue)
        return
      }
      
      await primaryWallet.switchNetwork(targetNetwork.id)
      setSelectedEVMNetwork(targetNetwork.name)
      setNetwork(targetNetwork.name)
      setCurrentNetworkId(targetNetwork.id)
      
    } catch (error) {
      console.error('Failed to switch network:', error)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 px-4 max-w-sm mx-auto">
      {/* Token Balances Component - only renders after network is known */}
      {currentNetworkId && (
        <TokenBalancesComponent 
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
            <Download className="h-4 w-4" /> Receive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-2 text-xs mb-3">
            <Network className="w-3 h-3 text-gray-400" />
            <span className="text-gray-400">Sender Network:</span>
            
            {showNetworkDropdown ? (
              <Select value={selectedEVMNetwork} onValueChange={handleNetworkSwitch}>
                <SelectTrigger className="bg-[#1a2628] border-white/10 text-white rounded-md h-5 w-28 text-xs px-2">
                  <SelectValue className="text-white text-xs" />
                </SelectTrigger>
                <SelectContent className="bg-[#253639] border-white/10">
                  {EVM_NETWORKS.map((network) => (
                    <SelectItem 
                      key={network.value} 
                      value={network.value} 
                      className="text-white focus:bg-white/5 text-xs h-6"
                    >
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-gray-300 font-medium text-xs">{network}</span>
            )}
          </motion.div>
          <TransferForm tokenList={availableTokens} />
        </TabsContent>

        <TabsContent value="receive" className="mt-4">
          <TransferReceive />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

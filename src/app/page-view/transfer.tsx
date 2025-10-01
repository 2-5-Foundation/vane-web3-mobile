"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useDynamicContext, useTokenBalances } from '@dynamic-labs/sdk-react-core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Rocket, Download, Network } from "lucide-react"

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'receive'>('transfer')
  const [balance, setBalance] = useState("0")
  const [network, setNetwork] = useState<string>("")
  const [availableTokens, setAvailableTokens] = useState<any[]>([])

  const { primaryWallet } = useDynamicContext()
  const { tokenBalances, isLoading, isError } = useTokenBalances({
    includeFiat: true,
    includeNativeBalance: true,
  });

   useEffect(() => {
     if (tokenBalances && tokenBalances.length > 0) {
       // Sum all tokens' marketValue
       const totalValue = tokenBalances.reduce((sum, token) => {
         return sum + (token.marketValue || 0);
       }, 0);
       setBalance(totalValue.toString());
       setAvailableTokens(tokenBalances);
     } else {
       setBalance("0");
       setAvailableTokens([]);
     }

     const fetchNetwork = async () => {
       if (primaryWallet) {
         const n = await primaryWallet.getNetwork()
         if (n === 1) {
           setNetwork("Ethereum")
         } else if (n === 137) {
           setNetwork("Polygon")
         } else if (n === 8453) {
           setNetwork("Base")
         }
       }
     }
     fetchNetwork()
   }, [tokenBalances, primaryWallet])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 px-4 max-w-sm mx-auto">
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
            <span className="text-gray-300 font-medium">{network}</span>
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

"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Rocket, Download, Network } from "lucide-react"

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'receive'>('transfer')
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const userWallets = useUserWallets();

  // calculate full amount
  useEffect(() => {
    // Define an async function inside useEffect
    const calculateTotalAmount = async () => {
      let total = 0;
      
      const balances = await Promise.all(
        userWallets.map(wallet => wallet.getBalance())
      );
      
      total = balances.reduce((sum, balance) => sum + parseFloat(balance), 0);
      
      setTotalAmount(total);
    };

    calculateTotalAmount();
  }, [userWallets]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="pt-2 px-4 max-w-sm mx-auto"
    >
      {/* Balance Display */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1 mb-3"
      >
        <p className="text-gray-400 text-xs font-medium">Total Available Balance</p>
        <p className="text-2xl font-light text-white">${totalAmount}</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs 
          defaultValue="transfer" 
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'transfer' | 'receive')}
          className="mb-6"
        >
          <TabsList className="grid grid-cols-2 bg-[#1a2628] p-0.5 h-auto">
            <TabsTrigger 
              value="transfer" 
              className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
            >
              <Rocket className="h-4 w-4" />
              Transfer
            </TabsTrigger>
            <TabsTrigger 
              value="receive" 
              className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
            >
              <Download className="h-4 w-4" />
              Receive
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transfer" className="mt-4">
            {/* Sender Network Indicator */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2 text-xs mb-3"
            >
              <Network className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400">Sender Network:</span>
              <span className="text-gray-300 font-medium">Ethereum Network</span>
            </motion.div>
            <TransferForm />
          </TabsContent>
          <TabsContent value="receive" className="mt-4">
            <TransferReceive />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}

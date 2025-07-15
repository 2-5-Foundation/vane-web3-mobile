"use client"

import { useEffect, useState } from "react"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Rocket, Download } from "lucide-react"

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
    <div className="pt-2 px-4 max-w-sm mx-auto">
      {/* Balance Display */}
      <div className="bg-[#0D1B1B]/80 backdrop-blur-sm border border-[#4A5853]/20 rounded-xl p-2 mb-3 shadow-lg">
        <div className="text-left">
          <h1 className="text-lg font-mono text-[#9EB2AD]">${totalAmount}</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs 
        defaultValue="transfer" 
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'transfer' | 'receive')}
        className="mb-6"
      >
        <TabsList className="grid grid-cols-2 bg-[#0D1B1B] p-0.5 h-auto">
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
          <TransferForm />
        </TabsContent>
        <TabsContent value="receive" className="mt-4">
          <TransferReceive />
        </TabsContent>
      </Tabs>
    </div>
  )
}

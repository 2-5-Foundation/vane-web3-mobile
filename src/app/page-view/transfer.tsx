"use client"

import { useEffect, useState } from "react"
import TransferForm from "../page-view/page-component/transfer-form"
import TransferReceive from "./page-component/transfer-receive"
import { useUserWallets } from '@dynamic-labs/sdk-react-core'


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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Fixed Top Section */}
      <div className="flex-none px-4">
        {/* Toggle Buttons */}
        <div className="flex gap-2 bg-[#282A3D] p-0.5 rounded-lg mb-3">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeTab === 'transfer' 
                ? 'bg-[#7EDFCD] text-black' 
                : 'text-[#A0A6F5] hover:text-white'
              }`}
          >
            Transfer
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeTab === 'receive' 
                ? 'bg-[#7EDFCD] text-black' 
                : 'text-[#A0A6F5] hover:text-white'
              }`}
          >
            Receive
          </button>
        </div>

        {/* Total Balance */}
        <div className="text-center space-y-0.5 mb-3">
          <p className="text-xs text-[#F5F5F5]">Total balance</p>
          <h1 className="text-2xl font-bold text-[#FFFFFF]">${totalAmount}</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto px-4 pb-12">
          {activeTab === 'transfer' ? <TransferForm /> : <TransferReceive />}
        </div>

        {/* Bottom Shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0D1313] via-[#0D1313]/60 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

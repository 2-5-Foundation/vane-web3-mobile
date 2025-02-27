"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react"

interface TransactionDetails {
  fromAddress: string;
  codeword: string;
  network: string;
  amount: string;
  currency: string;
  status: 'awaiting' | 'confirmed' | 'failed' | 'successful'
}

export default function SenderPending() {
  const transaction: TransactionDetails = {
    fromAddress: "0x7834...2951",
    codeword: "BlueHorizon",
    network: "Ethereum",
    amount: "2.5",
    currency: "ETH",
    status: 'awaiting' // change this to test different states
  }

  const statusConfig = {
    awaiting: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Awaiting receiver confirmation..",
      color: "text-[#FFA500]"
    },
    confirmed: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "Receiver confirmed",
      color: "text-[#7EDFCD]"
    },
    failed: {
      icon: <XCircle className="h-4 w-4" />,
      text: "Receiver failed to confirm",
      color: "text-red-500"
    },
    successful: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "Transaction successful",
      color: "text-[#7EDFCD]"
    }
  }

  const currentStatus = statusConfig[transaction.status]

  const handleRevert = () => {
    // Handle revert logic
    console.log("Transaction reverted")
  }

  const handleConfirm = () => {
    // Handle confirm logic
    console.log("Transaction confirmed")
  }

  const handleRefresh = () => {
    // Add refresh logic here
    console.log("Refreshing transaction status...")
  }

  return (
    <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
      <CardContent className="p-3 space-y-3">
        {/* Transaction Details */}
        <div className="space-y-3">
          <div className="flex">
            <div className="flex-1 space-y-0.5">
              <span className="text-[#9EB2AD] text-[12px]">From address</span>
              <p className="text-white font-mono text-sm">{transaction.fromAddress}</p>
            </div>
            <div className="flex-1 text-right space-y-0.5">
              <span className="text-[#9EB2AD] text-[12px]">Codeword</span>
              <p className="text-white text-sm">{transaction.codeword}</p>
            </div>
          </div>

          <div className="flex">
            <div className="flex-1 space-y-0.5">
              <span className="text-[#9EB2AD] text-[12px]">Network</span>
              <p className="text-white text-sm">{transaction.network}</p>
            </div>
            <div className="flex-1 text-right space-y-0.5">
              <span className="text-[#9EB2AD] text-[12px]">Amount</span>
              <p className="text-white text-sm">
                {transaction.amount} {transaction.currency}
              </p>
            </div>
          </div>
        </div>

        {/* Status with Refresh Button */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${currentStatus.color}`}>
            {currentStatus.icon}
            <span className="text-sm">{currentStatus.text}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10"
            >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleRevert}
            variant="outline"
            className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
          >
            Revert
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs"
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

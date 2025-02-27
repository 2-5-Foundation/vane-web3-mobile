"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TransactionDetails {
  fromAddress: string;
  codeword: string;
  network: string;
  amount: string;
  currency: string;
}

export default function ReceiverPending() {
  const transaction: TransactionDetails = {
    fromAddress: "0x7834...2951",
    codeword: "BlueHorizon",
    network: "Ethereum",
    amount: "2.5",
    currency: "ETH"
  }

  const handleApprove = () => {
    // Handle approve logic
    console.log("Transaction approved")
  }

  const handleReject = () => {
    // Handle reject logic
    console.log("Transaction rejected")
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleReject}
            variant="outline"
            className="flex-1 h-10 bg-transparent border-[#4A5853]/20 text-white hover:bg-[#4A5853]/10 text-xs"
          >
            Reject
          </Button>
          <Button 
            onClick={handleApprove}
            className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs"
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

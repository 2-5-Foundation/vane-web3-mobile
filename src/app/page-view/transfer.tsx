"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { useState } from "react"

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'receive'>('transfer')

  return (
    <div className="pt-2 px-4 max-h-[60vh] space-y-3 max-w-sm mx-auto">
      {/* Toggle Buttons */}
      <div className="flex gap-2 bg-[#282A3D] p-0.5 rounded-lg">
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
      <div className="text-center space-y-0.5">
        <p className="text-xs text-[#F5F5F5]">Total balance</p>
        <h1 className="text-2xl font-bold text-[#FFFFFF]">$5,280.42</h1>
      </div>

      {/* Transfer Card */}
      <Card className="bg-[#0B1B1C] border-[#4A5853]/20">
        <CardContent className="pt-2 px-3 space-y-3">
          {/* Recipient Field */}
          <div className="space-y-1">
            <Label className="text-sm text-[#F5F5F5]">Recipient</Label>
            <Input 
              placeholder="0x.." 
              className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] text-sm border-t-0 border-x-0 rounded-t-none"
            />
          </div>

          {/* Amount and Asset Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm text-[#F5F5F5]">Amount</Label>
              <Input 
                type="number" 
                placeholder="500.00"
                className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#F5F5F5]">Asset</Label>
              <Select>
                <SelectTrigger className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none">
                  <SelectValue placeholder="ETH" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1B1C] border-[#4A5853]/20">
                  <SelectItem value="eth" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">
                    ETH
                  </SelectItem>
                  <SelectItem value="usdc" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">
                    USDC
                  </SelectItem>
                  <SelectItem value="usdt" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">
                    USDT
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Warning Message */}
          <div className="flex items-center gap-2 border border-[#424BDF] text-[#A0A6F5] bg-[#282A3D] p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 text-[#424BDF]" />
            <p className="text-xs">Recipient will need to confirm the transaction</p>
          </div>

          {/* Submit Button */}
          <Button 
            className="w-full h-8 bg-[#7EDFCD] text-[#0B1B1C] hover:bg-[#7EDFCD]/90"
          >
            Initiate tranfer
          </Button>
        </CardContent>
      </Card>

      {/* Space reserved for outgoing transaction status */}
      <div className="h-[200px]" />
    </div>
  )
}

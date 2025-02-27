"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function Wallets() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null)

  // Initial wallet choice screen
  if (hasWallet === null) {
    return (
      <div className="pt-2 px-4 max-h-[60vh] space-y-3 max-w-sm mx-auto">
        <h1 className="text-center text-xl font-medium text-white">Connect wallet</h1>
        
        <div className="space-y-3">
          <Button 
            onClick={() => setHasWallet(true)}
            className="w-full h-10 bg-[#0D1B1B] hover:bg-[#0D1B1B]/90 text-white border border-[#4A5853]/20"
          >
            I have a wallet
          </Button>
          
          <Button 
            onClick={() => setHasWallet(false)}
            className="w-full h-10 bg-[#7EDFCD] hover:bg-[#7EDFCD]/90 text-black"
          >
            Set up Account
          </Button>
        </div>
      </div>
    )
  }

  // Existing wallet connection screen
  if (hasWallet) {
    return (
      <div className="pt-2 px-4 max-h-[60vh] space-y-3 max-w-sm mx-auto">
        <h1 className="text-center text-xl font-medium text-white">Connect wallet</h1>
        
        <div className="space-y-3">
          <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
            <CardContent className="p-3">
              <button className="w-full flex items-center justify-between p-2 h-8 rounded-lg hover:bg-[#4A5853]/10">
                <div className="flex items-center gap-3">
                  <Image 
                    src="/metamask-logo.png" 
                    alt="Metamask" 
                    width={32} 
                    height={32}
                  />
                  <span className="text-white">Metamask</span>
                </div>
                <span className="text-[#7EDFCD]">Connected</span>
              </button>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
            <CardContent className="p-3">
              <button className="w-full flex items-center justify-between p-2 h-8 rounded-lg hover:bg-[#4A5853]/10">
                <div className="flex items-center gap-3">
                  <Image 
                    src="/phantom-logo.png" 
                    alt="Phantom" 
                    width={32} 
                    height={32}
                  />
                  <span className="text-white">Phantom</span>
                </div>
                <span className="text-[#7EDFCD]">Connected</span>
              </button>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-10 bg-transparent border border-dashed border-[#4A5853]/40 text-[#4A5853] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40"
          >
            + Connect new wallet
          </Button>
        </div>
      </div>
    )
  }

  // Smart Account creation screen (to be implemented)
  return (
    <div className="pt-2 px-4 max-h-[60vh] space-y-3 max-w-sm mx-auto">
      <h1 className="text-center text-xl font-medium text-white">Create Smart Account</h1>
      {/* Smart account creation UI will go here */}
    </div>
  )
}

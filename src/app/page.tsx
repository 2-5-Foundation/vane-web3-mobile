"use client"

import { useEffect, useState } from 'react'
import { useStore } from '@/app/lib/useStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, ArrowRight } from "lucide-react"
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'

export default function Home() {
  const currentView = useStore(state => state.currentView)

  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768)
  }, [])

  const renderView = () => {
    switch (currentView) {
      case 'transfers':
        return <Transfer />
      case 'pending':
        return <Receive />
      case 'profile':
        return <Profile />
      case 'wallet':
        return <Wallets />
      default:
        return <Transfer />
    }
  }

  if (!isMobile) {
    return (
      <div className="h-screen bg-[#0D1313] flex items-center justify-center p-4">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20 max-w-md w-full">
          <CardHeader className="space-y-4 flex flex-col items-center text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-[#7EDFCD]/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#7EDFCD]" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl text-white">Mobile Only Application</CardTitle>
              <CardDescription className="text-[#9EB2AD]">
                This application is optimized for mobile devices. Please access it from your smartphone for the best experience.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <Button variant="outline" className="text-[#7EDFCD] border-[#7EDFCD]/20 hover:bg-[#7EDFCD]/10">
              Learn More <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0D1313] text-[#4A5853]">
      {renderView()}
    </main>
  )
}

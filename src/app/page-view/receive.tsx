'use client'

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import ReceiverPending from './page-component/receiver-pending'
import { useState } from "react"
import { useTransactionStore } from "../lib/useStore"

export default function Receive() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const fetchPendingTxUpdates = useTransactionStore(state => state.fetchPendingTxUpdates)

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchPendingTxUpdates()    
    // Reset the animation after 1 second
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  return (
    <div className="relative pt-2 px-4 max-w-sm mx-auto">
      {/* Refresh Button */}
      <div className="flex justify-end mb-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleRefresh}
          className="h-8 w-8 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10"
        >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto pb-12">
        <ReceiverPending />
      </div>
      
      {/* Gradient Fade Effect */}
      <div className="fixed bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-[#0D1313] via-[#0D1313]/60 to-transparent pointer-events-none md:bottom-0" />
    </div>
  )
}

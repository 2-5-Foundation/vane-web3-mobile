"use client"

import { useStore } from '@/app/lib/useStore'
import Dashboard from './page-view/dashboard'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import Settings from './page-view/settings'

export default function Home() {
  const currentView = useStore(state => state.currentView)

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'wallet':
        return <Wallets />
      case 'transfers':
        return <Transfer />
      case 'profile':
        return <Receive />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1B1C] text-[#4A5853]">
      {renderView()}
    </main>
  )
}

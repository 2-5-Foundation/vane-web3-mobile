"use client"

import { useStore } from '@/app/lib/useStore'
import { Frame } from './page-view/frame'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'

export default function Home() {
  const currentView = useStore(state => state.currentView)

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

  return (
    <Frame>
      {renderView()}
    </Frame>
  )
}

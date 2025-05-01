"use client"

import { useStore, useTransactionStore } from '@/app/lib/useStore'
import Profile from './page-view/profile'
import Wallets from './page-view/wallets'
import Transfer from './page-view/transfer'
import Receive from './page-view/receive'
import { useEffect } from 'react'

export default function Home() {
  const currentView = useStore(state => state.currentView)
  const connectAirtable = useTransactionStore(state => state.setWsUrl);
  const airtable = useTransactionStore(state => state.airtable)
  useEffect(()=>{
    connectAirtable()
  },[airtable])

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
      renderView()
  )
}

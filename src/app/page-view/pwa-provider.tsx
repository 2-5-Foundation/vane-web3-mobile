'use client'

import { useEffect } from 'react'

export const PWAProvider = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(console.error)
    }
  }, [])

  return null
} 
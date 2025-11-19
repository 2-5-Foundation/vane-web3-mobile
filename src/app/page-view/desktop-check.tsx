'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Alert, AlertDescription } from "@/components/ui/alert"

export function DesktopCheck({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(() => {
    // Client-side only: check immediately
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640
    }
    return false
  })

  useEffect(() => {
    const checkSize = () => {
      setIsDesktop(window.innerWidth >= 640)
    }
    
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  // If desktop, show the message - NEVER render children (prevents providers from mounting)
  if (isDesktop) {
    return (
      <div className="fixed inset-0 bg-[#0A1919] flex items-center justify-center p-4 z-[9999]">
        <div className="flex flex-col items-center space-y-6 w-full max-w-lg">
          <div className="w-full">
            <Image 
              src="/vane-safety-net.png" 
              alt="Vane Logo" 
              width={400}
              height={400}
              className="w-full h-auto"
              priority
            />
          </div>
          
          <div className="w-full">
            <Alert className="bg-[#0D1B1B] border-[#4A5853]/20 w-full">
              <AlertDescription className="text-[#9EB2AD] text-center">
                Vane is currently on mobile web. Switch to mobile
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    )
  }

  // Not desktop: show the app (providers will mount here)
  return <>{children}</>
}


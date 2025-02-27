'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useStore } from '@/app/lib/useStore'
import type { NavigationState } from '@/app/lib/useStore'
import { Smartphone, ArrowRight } from "lucide-react"
import Image from 'next/image'


type NavItem = {
  name: string
  icon: React.ReactNode
  isTransfer?: boolean
}

const navItems: NavItem[] = [
  {
    name: 'Wallet',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2"/>
        <path d="M16 12h4v4h-4a2 2 0 0 1 0-4z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    name: 'Transfers',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 12h10m-5-5l5 5-5 5M3 7v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4z" 
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    isTransfer: true,
  },
  {
    name: 'Pending',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Profile',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

const DesktopMessage = () => (
  <div className="fixed inset-0 bg-[#0D1313] flex items-center justify-center p-4">
    <Card className="bg-[#0D1B1B] py-5 border-[#4A5853]/20 max-w-md w-full">
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
     
    </Card>
  </div>
)

export function Frame({ children }: { children: React.ReactNode }) {
  const { currentView, setCurrentView } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640) // sm breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isMobile) {
    return <DesktopMessage />
  }

  // Separate transfer button for special styling
  const transferButton = navItems.find(item => item.isTransfer)
  const regularNavItems = navItems.filter(item => !item.isTransfer)

  return (
    <div className="min-h-screen bg-[#0D1313]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#4A5853]/20 bg-[#0D1313]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0D1313]/60">
        <div className="flex justify-between items-center h-14 px-[15px]">
          {/* Logo section */}
          <div className="flex items-center">
            <Image 
              src="/vane-logo.png" 
              alt="Vane Logo" 
              width={24}
              height={24}
              className="h-6 w-auto"
            />
          </div>

          {/* Mobile menu button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                className="md:hidden text-[#4A5853] hover:text-[#4A5853] hover:bg-transparent cursor-not-allowed" 
                disabled
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </SheetTrigger>
            {/* <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setCurrentView(item.name || 'dashboard' as NavigationState['currentView'])
                      setIsOpen(false)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-left
                      ${currentView === item.name
                        ? 'bg-[#7EDFCD]/10 text-[#7EDFCD] font-medium' 
                        : 'text-[#4A5853] hover:bg-[#7EDFCD]/5 hover:text-[#7EDFCD]/80'
                      }`}
                  >
                    {item.icon}
                    {item.name}
                  </button>
                ))}
              </nav>
            </SheetContent> */}
          </Sheet>
        </div>
      </header>

      {/* Main content */}
      <main className="container pt-0 md:ml-[200px]">
        {children}
      </main>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-[#0D1313]/95 backdrop-blur-lg border-t border-[#4A5853]/20 md:hidden">
        <div className="relative grid h-full grid-cols-4 mx-auto max-w-md px-6">
          {/* First item */}
          {regularNavItems.slice(0, 1).map((item) => (
            <button
              key={item.name}
              onClick={() => setCurrentView(item.name.toLowerCase() as NavigationState['currentView'])}
              className={`flex flex-col items-center justify-center transition-all duration-200
                ${currentView === item.name.toLowerCase()
                  ? 'text-[#7EDFCD] translate-y-[-2px]' 
                  : 'text-[#4A5853] hover:text-[#7EDFCD]/80 active:translate-y-[-1px]'
                }`}
            >
              <div className={`${currentView === item.name.toLowerCase() ? 'drop-shadow-md' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-xs mt-0.5 font-medium ${
                currentView === item.name.toLowerCase() ? 'opacity-100' : 'opacity-70'
              }`}>{item.name}</span>
            </button>
          ))}

          {/* Transfer Button */}
          {transferButton && (
            <button
              onClick={() => setCurrentView('transfers')}
              className={`z-20 flex flex-col items-center justify-center transition-all duration-200
                ${currentView === 'transfers'
                  ? 'text-[#7EDFCD] translate-y-[-4px]' 
                  : 'text-[#4A5853] hover:text-[#7EDFCD]/80 active:translate-y-[-2px]'
                }`}
            >
              <div className={`transform scale-110 ${
                currentView === 'transfers' ? 'drop-shadow-lg' : ''
              }`}>
                {transferButton.icon}
              </div>
              <span className={`text-xs mt-0.5 font-medium ${
                currentView === 'transfers' ? 'opacity-100' : 'opacity-70'
              }`}>{transferButton.name}</span>
            </button>
          )}

          {/* Last two items */}
          {regularNavItems.slice(1).map((item) => (
            <button
              key={item.name}
              onClick={() => setCurrentView(item.name.toLowerCase() as NavigationState['currentView'])}
              className={`flex flex-col items-center justify-center transition-all duration-200
                ${currentView === item.name.toLowerCase()
                  ? 'text-[#7EDFCD] translate-y-[-2px]' 
                  : 'text-[#4A5853] hover:text-[#7EDFCD]/80 active:translate-y-[-1px]'
                }`}
            >
              <div className={`${currentView === item.name.toLowerCase() ? 'drop-shadow-md' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-xs mt-0.5 font-medium ${
                currentView === item.name.toLowerCase() ? 'opacity-100' : 'opacity-70'
              }`}>{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden fixed left-0 top-[3.5rem] h-screen w-[200px] border-r border-[#4A5853]/20 bg-[#0D1313]/95 backdrop-blur-lg md:block">
        <div className="space-y-2 py-4 px-2">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setCurrentView(item.name.toLowerCase() as NavigationState['currentView'])}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full
                ${currentView === item.name.toLowerCase()
                  ? 'bg-[#7EDFCD]/10 text-[#7EDFCD] font-medium shadow-sm' 
                  : 'text-[#4A5853] hover:bg-[#7EDFCD]/5 hover:text-[#7EDFCD]/80 active:bg-[#7EDFCD]/10'
                }`}
            >
              <div className={`${currentView === item.name.toLowerCase() ? 'drop-shadow-sm' : ''}`}>
                {item.icon}
              </div>
              <span className={`${
                currentView === item.name.toLowerCase() ? 'opacity-100' : 'opacity-80'
              }`}>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

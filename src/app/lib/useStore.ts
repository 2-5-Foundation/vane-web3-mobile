import { create } from 'zustand'

// Wallets tracking


// Settings config


// Ongoing transaction state


// site state for buttons


export type NavigationState = {
  currentView: 'dashboard' | 'wallet' | 'transfers' | 'profile' | 'settings'
  setCurrentView: (view: NavigationState['currentView']) => void
}

export const useStore = create<NavigationState>((set) => ({
  currentView: 'transfers',
  setCurrentView: (view) => set({ currentView: view }),
}))
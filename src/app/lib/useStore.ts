import { create } from 'zustand'

// Wallets tracking


// Settings config


// Ongoing transaction state


// site state for buttons


export type NavigationState = {
  currentView: 'wallet' | 'transfers' | 'pending' | 'profile';
  setCurrentView: (view: NavigationState['currentView']) => void;
};

export const useStore = create<NavigationState>((set) => ({
  currentView: 'transfers',
  setCurrentView: (view) => set({ currentView: view }),
}))
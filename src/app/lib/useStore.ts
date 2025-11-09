/**
 * Vane Web3 Mobile Store - Transaction State Management
 * 
 * This store manages transaction state and sorting logic for the Vane Web3 mobile app:
 * - User profile and wallet connection
 * - Transaction state management (sender/receiver contexts)
 * - Automatic transaction sorting and categorization
 * - Utility methods for transaction status checking
 * 
 * Key Features:
 * - Transaction sorting logic (sender vs receiver)
 * - Status management and utility functions
 * - Clean separation of concerns (no WASM API wrappers)
 * - Direct integration with vane_lib WASM API
 * 
 * Usage:
 * - Use vane_lib WASM API functions directly
 * - Use this store for transaction state management and sorting
 * - Call txStatusSorter() to process incoming transaction updates
 */

import { create } from 'zustand'
import { 
  TxStateMachine, 
  Token, 
  ChainSupported, 
  initializeNode,
  initiateTransaction,
  senderConfirm,
  receiverConfirm,
  revertTransaction,
  fetchPendingTxUpdates,
  watchTxUpdates,
  exportStorage,
  StorageExport,
  getNodeConnection,
  isInitialized,
  LogLevel,
  NodeConnectionStatus,
  addAccount,
  
} from '@/lib/vane_lib/main'

import { config } from 'dotenv';
import { bytesToHex } from 'viem';
import { toast } from 'sonner';
import { toWire } from '@/lib/vane_lib/pkg/host_functions/networking';

config();
export interface TransferFormData {
  recipient: string;
  amount: number | string; 
  asset: string;
  network: string;
}

export interface UserProfile {
  account: string;
  network: string;
}

export interface TransactionState {
  userProfile: UserProfile;
  transferFormData: TransferFormData;
  // storing incoming transactions that serve as sender notifications
  senderPendingTransactions: TxStateMachine[];  // Store all transaction updates
  // storing incoming transactions that serve as receiver notifications the receiver needs to confirm or reject
  recvTransactions: TxStateMachine[]
  status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'TxSubmissionPending' | 'ReceiverNotRegistered' | 'Reverted';

  // WASM state
  isWatchingUpdates: boolean;
  nodeStatus: 'idle' | 'initializing' | 'ready';

  // Methods
  setUserProfile: (userProfile: UserProfile) => void;
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'TxSubmissionPending' | 'ReceiverNotRegistered' | 'Reverted') => void;
  txStatusSorter: (update:TxStateMachine) => void;
  sortTransactionsUpdates: (txs:TxStateMachine[]) => void;
  clearAllTransactions: () => void; 
  // sender context
  removeTransaction: (txNonce: number) => void;
  addTransaction: (tx: TxStateMachine) => void;
  // receiver context
  addRecvTransaction: (tx: TxStateMachine) => void;
  removeRecvTransaction: (txNonce: number) => void;
  
  // WASM initialization and management
  initializeWasm: (relayMultiAddr: string, account: string, network: string, live?: boolean) => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  isWasmInitialized: () => boolean;
  
  // WASM transaction methods
  initiateTransaction: (sender: string, receiver: string, amount: bigint, token: Token, codeWord: string, senderNetwork: ChainSupported, receiverNetwork: ChainSupported) => Promise<TxStateMachine>;
  addAccount: (accountId: string, network: string) => Promise<void>;
  senderConfirmTransaction: (tx: TxStateMachine) => Promise<void>;
  receiverConfirmTransaction: (tx: TxStateMachine) => Promise<void>;
  revertTransaction: (tx: TxStateMachine, reason?: string) => Promise<void>;
  fetchPendingUpdates: () => Promise<TxStateMachine[]>;
  exportStorageData: () => Promise<StorageExport>;
  loadStorageData: () => StorageExport | null;
  getNodeConnectionStatus: () => Promise<NodeConnectionStatus>;

  // Utility methods
  isTransactionReverted: (tx: TxStateMachine) => boolean;
  isTransactionCompleted: (tx: TxStateMachine) => boolean;
  getTransactionStatus: (tx: TxStateMachine) => string;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // state
  userProfile: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user-profile');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return {
      account: '',
      network: ''
    };
  })(),
  transferFormData: {
    recipient: '',
    amount: 0,
    asset: '',
    network: '',
    codeword: ''
  },
  senderPendingTransactions: [],
  recvTransactions: [],
  status: 'Genesis',
  isWatchingUpdates: false,
  nodeStatus: 'idle',

  // method
  setUserProfile: (userProfile: UserProfile) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user-profile', JSON.stringify(userProfile));
    }
    set({userProfile: userProfile});
  },
  storeSetTransferFormData: (formData: TransferFormData) => set({transferFormData: formData}),

  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'TxSubmissionPending' | 'ReceiverNotRegistered' | 'Reverted') => set({status}),
  
  
  txStatusSorter: (update: TxStateMachine) => {
    set((state) => {
        // Use the utility method to get consistent status string
        const statusString = get().getTransactionStatus(update);
        
        
        switch (statusString) {
            case 'Genesis':
                const isSender = update.senderAddress === get().userProfile.account;
                const isReceiver = update.receiverAddress === get().userProfile.account;
                
                if (isSender) {
                    return {
                        ...state,
                        senderPendingTransactions: [update, ...state.senderPendingTransactions]
                    };
                }
                
                if (isReceiver) {
                    return {
                        ...state,
                        recvTransactions: [update, ...state.recvTransactions]
                    };
                }
                
                return state;
                
            case 'RecvAddrConfirmed':
            case 'RecvAddrConfirmationPassed':
            case 'NetConfirmed':
            case 'ReceiverNotRegistered': 
            case 'RecvAddrFailed':
            case 'SenderConfirmed':
            case 'SenderConfirmationfailed':
            case 'FailedToSubmitTxn':
            case 'TxSubmissionPassed':
            case 'TxSubmissionPending':
            case 'TxError':
            case 'Reverted':
                return {
                    ...state,
                    senderPendingTransactions: [update, ...state.senderPendingTransactions]
                };

            default:
                return state;
        }
    });
},
  
  sortTransactionsUpdates: (txs: TxStateMachine[]) => {
      txs.forEach(tx => {
          // Call txStatusSorter directly as it now handles the state updates
          get().txStatusSorter(tx);
      });
  },
 
  addTransaction: (tx: TxStateMachine) =>
    set((state) => ({
      senderPendingTransactions: [tx, ...state.senderPendingTransactions]
    })),

  removeTransaction: (txNonce: number) =>{
      set((state) => ({
          senderPendingTransactions: state.senderPendingTransactions.filter(tx => tx.txNonce !== txNonce)
        }))
  },

  addRecvTransaction: (tx: TxStateMachine) =>
    set((state) => ({
      recvTransactions: [tx, ...state.recvTransactions]
    })),

  removeRecvTransaction: (txNonce: number) =>{
      set((state) => ({
          recvTransactions: state.recvTransactions.filter(tx => tx.txNonce !== txNonce)
        }))
  },

  clearAllTransactions: () => {
      set((state) => ({
          ...state,
          senderPendingTransactions: [],
          recvTransactions: []
      }));
  },

  // WASM initialization and management
  initializeWasm: async (relayMultiAddr: string, account: string, network: string, live: boolean = true) => {
    try {
      if (isInitialized()) {
        console.log('WASM already initialized');
        return;
      }

      console.log('Initializing WASM node...');
      
      // Load storage export from localStorage if it exists
      const storageExport = get().loadStorageData();
      
      if (storageExport) {
        console.log('Loaded storage export from localStorage');
      } else {
        console.log('No storage export found in localStorage');
      }
      
      await initializeNode({
        relayMultiAddr,
        account,
        network,
        live,
        logLevel: LogLevel.Info,
        storage: storageExport ?? undefined
      });
      console.log('WASM node initialized successfully');

      // Zeroize sensitive material
      
    } catch (error) {
      toast.error('Failed to initialize app');
      console.error('Failed to initialize app:', error);
      throw error;
    }
  },

  startWatching: async () => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    const state = get();
    if (state.isWatchingUpdates) {
      console.log('Already watching updates');
      return;
    }

    try {
      await watchTxUpdates((tx: TxStateMachine) => {
        get().txStatusSorter(tx);
      });
      
      set({ isWatchingUpdates: true });
      console.log('Started watching transaction updates');
    } catch (error) {
      console.error('Error starting transaction watching:', error);
      throw error;
    }
  },

  stopWatching: () => {
    set({ isWatchingUpdates: false });
    console.log('Stopped watching transaction updates');
  },

  isWasmInitialized: () => isInitialized(),

  // WASM transaction methods
  initiateTransaction: async (
    sender: string, 
    receiver: string, 
    amount: bigint, 
    token: Token, 
    codeWord: string, 
    senderNetwork: ChainSupported, 
    receiverNetwork: ChainSupported
  ) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      const tx = await initiateTransaction(sender, receiver, amount, token, codeWord, senderNetwork, receiverNetwork);
      console.log('Transaction initiated successfully:', tx);
      
      // Add to local state
      get().txStatusSorter(tx);
      
      return tx;
    } catch (error) {
      console.error('Error initiating transaction:', error);
      throw error;
    }
  },
  addAccount: async (accountId: string, network: string) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }
    try {
      await addAccount(accountId, network);
      console.log('Account added successfully');
      toast.success('Account added successfully');

    } catch (error) {
      console.error('Error adding account:', error);
      toast.error('Error adding account');
    }
  },
  getNodeConnectionStatus: async (): Promise<NodeConnectionStatus> => {
    return getNodeConnection();
  },

  senderConfirmTransaction: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      await senderConfirm(tx);
      console.info('Transaction confirmed by sender successfully');
      toast.success('Transaction confirmed by sender successfully');
      
      // Export storage and save to localStorage
      const storageExport = await get().exportStorageData();
      
      // Submit metrics to API
      try {
        const response = await fetch('/api/submit-metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(storageExport, (key, value) => {
            // Handle BigInt serialization for API request
            if (typeof value === 'bigint') {
              return value.toString();
            }
            return value;
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to submit metrics:', await response.text());
        } else {
          console.log('Metrics submitted successfully');
        }
      } catch (metricsError) {
        console.error('Error submitting metrics:', metricsError);
        // Don't throw - metrics submission failure shouldn't block the transaction confirmation
      }
    } catch (error) {
      console.error('Error confirming transaction by sender:', error);
      toast.error('Error confirming transaction');
      throw error;
    }
  },

  receiverConfirmTransaction: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      await receiverConfirm(tx);
      console.log('Transaction confirmed by receiver successfully');
    } catch (error) {
      console.error('Error confirming transaction by receiver:', error);
      throw error;
    }
  },

  revertTransaction: async (tx: TxStateMachine, reason?: string) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      await revertTransaction(tx, reason);
      console.log('Transaction reverted successfully');
    } catch (error) {
      console.error('Error reverting transaction:', error);
      throw error;
    }
  },

  fetchPendingUpdates: async () => {
    const state = get();
    
    if (!state.isWasmInitialized) {
      console.warn('WASM node not initialized - cannot fetch updates');
      return [];
    }

    try {
      const updates = await fetchPendingTxUpdates();
      console.log('Fetched pending updates:', updates);
      
      // If updates is empty, clear all transactions
      if (!updates || updates.length === 0) {
        console.log('No updates found, clearing transactions');
        set((state) => ({
          ...state,
          senderPendingTransactions: [],
          recvTransactions: []
        }));
      } else {
        // Clear existing transactions and process new updates
        set((state) => ({
          ...state,
          senderPendingTransactions: [],
          recvTransactions: []
        }));
        
        // Process updates
        get().sortTransactionsUpdates(updates);
      }
      
      return updates;
    } catch (error) {
      console.error('Error fetching pending updates:', error);
      return [];
    }
  },

  exportStorageData: async (): Promise<StorageExport> => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      const storage = await exportStorage();
      console.log('Exported storage data:', storage);
      
      // Save to browser storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('vane-storage-export', JSON.stringify(storage, (key, value) => {
          // Handle BigInt serialization
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        }));
        console.log('Storage data saved to localStorage');
      }
      
      return storage;
    } catch (error) {
      console.error('Error exporting and saving storage data:', error);
      throw error;
    }
  },

  loadStorageData: (): StorageExport | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem('vane-storage-export');
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      
      if (!parsed || typeof parsed !== 'object') {
        console.warn('Invalid storage data format in localStorage');
        return null;
      }

      // Normalize types: revive bigint fields expected by WASM (u128)
      // Specifically: DbTxStateMachine.amount should be bigint
      const reviveTransactionAmount = (tx: any): any => {
        if (!tx || typeof tx !== 'object') {
          return tx;
        }
        
        // Convert amount from string to BigInt if needed
        if (tx.amount !== undefined) {
          if (typeof tx.amount === 'string') {
            try {
              tx.amount = BigInt(tx.amount);
            } catch (e) {
              console.warn('Failed to convert amount to BigInt:', tx.amount, e);
              return null; // Invalid transaction
            }
          } else if (typeof tx.amount === 'number') {
            // Convert number to BigInt (shouldn't happen, but handle it)
            tx.amount = BigInt(tx.amount);
          }
          // If already BigInt, keep it as is
        }
        
        // Ensure tx_hash is an array of numbers
        if (tx.tx_hash && Array.isArray(tx.tx_hash)) {
          tx.tx_hash = tx.tx_hash.map((val: any) => typeof val === 'string' ? parseInt(val, 10) : Number(val));
        }
        
        return tx;
      };

      const reviveTransactions = (transactions: any[]): any[] => {
        if (!Array.isArray(transactions)) {
          return [];
        }
        return transactions
          .map(reviveTransactionAmount)
          .filter((tx) => tx !== null);
      };

      // Revive transaction amounts
      const storageExport: StorageExport = {
        nonce: typeof parsed.nonce === 'string' 
          ? Number(parsed.nonce) 
          : typeof parsed.nonce === 'bigint' 
          ? Number(parsed.nonce) 
          : parsed.nonce ?? 0,
        success_transactions: reviveTransactions(parsed.success_transactions || []),
        failed_transactions: reviveTransactions(parsed.failed_transactions || []),
        ...(parsed.user_account && { user_account: parsed.user_account }),
      };

      console.log('Loaded storage data from localStorage:', storageExport);
      return storageExport;
    } catch (error) {
      console.error('Error loading storage data from localStorage:', error);
      return null;
    }
  },

  // Utility methods
  isTransactionReverted: (tx: TxStateMachine) => {
    const status = get().getTransactionStatus(tx);
    return status === 'Reverted' || status === 'FailedToSubmitTxn';
  },

  isTransactionCompleted: (tx: TxStateMachine) => {
    const status = get().getTransactionStatus(tx);
    return status === 'TxSubmissionPassed' || status === 'FailedToSubmitTxn' || status === 'Reverted';
  },

  getTransactionStatus: (tx: TxStateMachine) => {
    if (typeof tx.status === 'string') {
      return tx.status;
    }
    
    if (typeof tx.status === 'object' && tx.status !== null) {
      // Handle object-based status
      if ('type' in tx.status) {
        return tx.status.type;
      }
      
      // Handle status with data
      const keys = Object.keys(tx.status);
      return keys.length > 0 ? keys[0] : 'Unknown';
    }
    
    return 'Unknown';
  },


}));


// ---------------------------------- site state for buttons ----------------------------------
export type NavigationState = {
  currentView: 'wallet' | 'transfers' | 'pending' | 'profile';
  setCurrentView: (view: NavigationState['currentView']) => void;
};

export const useStore = create<NavigationState>((set) => ({
  currentView: 'transfers',
  setCurrentView: (view) => set({ currentView: view }),
}));

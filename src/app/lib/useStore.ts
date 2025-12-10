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
  isInitialized,
  LogLevel,
  addAccount,
  clearRevertedFromCache,
  deleteTxInCache
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
  status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted';

  // WASM state
  isWatchingUpdates: boolean;

  // Methods
  setUserProfile: (userProfile: UserProfile) => void;
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted') => void;
  txStatusSorter: (update:TxStateMachine) => void;
  sortTransactionsUpdates: (txs:TxStateMachine[]) => void;
  clearAllTransactions: () => void; 
  // sender context
  removeTransaction: (tx: TxStateMachine) => void;
  addTransaction: (tx: TxStateMachine) => void;
  // receiver context
  addRecvTransaction: (tx: TxStateMachine) => void;
  removeRecvTransaction: (txNonce: number) => void;
  
  // WASM initialization and management
  initializeWasm: (relayMultiAddr: string, account: string, network: string, selfNode:boolean, live: boolean) => Promise<void>;
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

  // Utility methods
  isTransactionReverted: (tx: TxStateMachine) => boolean;
  isTransactionCompleted: (tx: TxStateMachine) => boolean;
  getTransactionStatus: (tx: TxStateMachine) => string;
}

const normalizeChainAddress = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.split(':').pop()?.trim().toLowerCase() ?? '';
};

const stringToChainSupported = (network: string): ChainSupported => {
  const upper = network.toUpperCase();
  if (upper === 'EVM') return ChainSupported.Ethereum;

  const normalized = network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  const chain = Object.values(ChainSupported).find(c => c === normalized || c === network);
  
  if (!chain) {
    throw new Error(`Invalid network: ${network}`);
  }
  
  return chain;
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // state
  userProfile: {
    account: '',
    network: ''
  },
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

  // method
  setUserProfile: (userProfile: UserProfile) => {
    set({
      userProfile: {
        ...userProfile,
        account: normalizeChainAddress(userProfile.account)
      }
    });
  },
  storeSetTransferFormData: (formData: TransferFormData) => set({transferFormData: formData}),

  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted') => set({status}),
  
  
  txStatusSorter: (update: TxStateMachine) => {
    set((state) => {
        // Use the utility method to get consistent status string
        const statusString = get().getTransactionStatus(update);
        

        const normalizedCurrentAccount = normalizeChainAddress(get().userProfile.account);
        const normalizedSenderAddress = normalizeChainAddress(update.senderAddress);
        const normalizedReceiverAddress = normalizeChainAddress(update.receiverAddress);

        const isSender = normalizedCurrentAccount !== '' && normalizedSenderAddress === normalizedCurrentAccount;
        const isReceiver = normalizedCurrentAccount !== '' && normalizedReceiverAddress === normalizedCurrentAccount;

        switch (statusString) {
            case 'Genesis':

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
            case 'TxError':
            case 'Reverted':
    
                if(isSender){
                return {
                    ...state,
                    senderPendingTransactions: [update, ...state.senderPendingTransactions]
                };
              }

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

  removeTransaction: (tx: TxStateMachine) =>{
    if(!isInitialized()) {
      throw new Error('WASM node not initialized');
    }
    deleteTxInCache(tx);
      set((state) => ({
          senderPendingTransactions: state.senderPendingTransactions.filter(tx => tx.txNonce !== tx.txNonce)
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
  initializeWasm: async (relayMultiAddr: string, account: string, network: string, selfNode:boolean, live: boolean = true) => {
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
        self_node:selfNode,
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
      const chainSupported = stringToChainSupported(network);
      await addAccount(accountId, chainSupported);
      console.log('Account added successfully');

    } catch (error) {
      console.error('Error adding account:', error);
      throw error;
    }
  },

  senderConfirmTransaction: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error('WASM node not initialized');
    }

    try {
      await senderConfirm(tx);      
      // Export storage and save to localStorage
      const storageExport = await get().exportStorageData();
      // convert all amounts to their decimals

      
      // Submit metrics to API
      try {
        const response = await fetch('/api/submit-metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(storageExport)
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
    
    if (!state.isWasmInitialized()) {
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
      // Catch WASM RuntimeError specifically
      if (error instanceof Error && error.name === 'RuntimeError') {
        console.error('WASM RuntimeError in fetchPendingUpdates (possibly Base network issue):', error);
        return [];
      }
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
      
      // Normalize BigInt values to numbers for safe serialization
      // Specifically handles DbTxStateMachine arrays where amount might be BigInt
      const normalizeBigInt = (value: any): any => {
        if (typeof value === 'bigint') {
          return Number(value);
        }
        if (Array.isArray(value)) {
          // Handle arrays - recursively normalize each element
          return value.map((item) => {
            // If item is an object (like DbTxStateMachine), normalize it
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
              const normalized: any = {};
              for (const key in item) {
                // Convert BigInt amount to number
                if (key === 'amount' && typeof item[key] === 'bigint') {
                  normalized[key] = Number(item[key]);
                } else {
                  normalized[key] = normalizeBigInt(item[key]);
                }
              }
              return normalized;
            }
            // For primitive array elements, normalize recursively
            return normalizeBigInt(item);
          });
        }
        if (value !== null && typeof value === 'object') {
          const normalized: any = {};
          for (const key in value) {
            normalized[key] = normalizeBigInt(value[key]);
          }
          return normalized;
        }
        return value;
      };

      const normalizedStorage = normalizeBigInt(storage) as StorageExport;
      
      // Save to browser storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('vane-storage-export', JSON.stringify(normalizedStorage));
        console.log('Storage data saved to localStorage');
      }
      
      return normalizedStorage;
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

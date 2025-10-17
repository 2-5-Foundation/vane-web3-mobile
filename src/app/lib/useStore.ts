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

import {
  mnemonicGenerate,
  mnemonicValidate,
  mnemonicToMiniSecret,
  ed25519PairFromSeed
} from '@polkadot/util-crypto';

import { config } from 'dotenv';
import { 
  getKdfMessageBytes,
  setupKeystoreWithSignature,
  loadEnvelopeOrThrow,
  unlockCEKWithSignature,
  decryptLibp2pSecretWithCEK
} from './keystore';
import { bytesToHex } from 'viem';
import { toast } from 'sonner';

config();
export interface TransferFormData {
  recipient: string;
  amount: number; 
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
  nodeStatus: 'idle' | 'initializing' | 'ready';

  // Methods
  setUserProfile: (userProfile: UserProfile) => void;
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted') => void;
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
  initializeWasm: (relayMultiAddr: string, account: string, network: string, authSignature?: Uint8Array, live?: boolean) => Promise<void>;
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
  loadStorageData: () => unknown | null;
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

  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted') => set({status}),
  
  
  txStatusSorter: (update: TxStateMachine) => {
    set((state) => {
        // Use the utility method to get consistent status string
        const statusString = get().getTransactionStatus(update);
        
        switch (statusString) {
            case 'Genesis':
                const isSender = update.senderAddress === get().userProfile.account;
                const isReceiver = update.receiverAddress === get().userProfile.account;
                
                if (isSender) {
                    const alreadyInSender = state.senderPendingTransactions.some(tx => tx.txNonce === update.txNonce);
                    if (!alreadyInSender) {
                        return {
                            ...state,
                            senderPendingTransactions: [update, ...state.senderPendingTransactions]
                        };
                    }
                }
                
                if (isReceiver) {
                    const alreadyInRecv = state.recvTransactions.some(tx => tx.txNonce === update.txNonce);
                    if (!alreadyInRecv) {
                        return {
                            ...state,
                            recvTransactions: [update, ...state.recvTransactions]
                        };
                    }
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
            case 'Reverted':
                if (!state.senderPendingTransactions.some(tx => tx.txNonce === update.txNonce)) {
                    return {
                        ...state,
                        senderPendingTransactions: [update, ...state.senderPendingTransactions]
                    };
                }
                return state;

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
  initializeWasm: async (relayMultiAddr: string, account: string, network: string, authSignature?: Uint8Array, live: boolean = false) => {
    try {
      
      
      if (isInitialized()) {
        console.log('WASM already initialized');
        return;
      }

      // Build a chain-agnostic key identifier like "evm:0x...", "sol:...", "btc:..."
      const toPrefix = (n: string) => {
        const normalized = (n || '').toLowerCase();
        if ([
          'ethereum', 'base', 'polygon', 'optimism', 'arbitrum', 'bnb', 'bsc', 'evm'
        ].includes(normalized)) return 'evm';
        if (normalized.includes('sol')) return 'sol';
        if (normalized.includes('btc') || normalized.includes('bitcoin')) return 'btc';
        if (normalized.includes('dot') || normalized.includes('polkadot')) return 'dot';
        if (normalized.includes('tron')) return 'tron';
        return normalized || 'evm';
      };
      const keyIdentifier = `${toPrefix(network)}:${account}`;

      // ——— Keystore: first-time or unlock path ———
      let libp2pSecret32: Uint8Array | null = null;
      try {
        const env = await loadEnvelopeOrThrow();
        if (!authSignature) throw new Error('Missing auth signature to unlock keystore');
        const CEK = await unlockCEKWithSignature(env, keyIdentifier, authSignature);
        const secret = await decryptLibp2pSecretWithCEK(env, CEK);
        CEK.fill(0);
        libp2pSecret32 = secret;
      } catch {
        // First-time setup: derive a libp2p secret deterministically for now
        if (!authSignature) throw new Error('Missing auth signature for first-time setup');
        // Generate a new libp2p secret (32 bytes). Using polkadot util to derive from mnemonic.
        const mnemonic = mnemonicGenerate();
        const secret = mnemonicToMiniSecret(mnemonic);
        await setupKeystoreWithSignature(secret, keyIdentifier, authSignature);
        libp2pSecret32 = secret;
      }

      // Optional: restore exported storage if available
      const maybeStored = get().loadStorageData() as StorageExport | null;
      if (maybeStored) {
        console.log('Found storage export in browser storage; passing to initializeNode.');
      }

      console.log('Initializing WASM node...');
      await initializeNode({
        relayMultiAddr,
        account,
        network,
        live,
        logLevel: LogLevel.Info,
        libp2pKey: bytesToHex(libp2pSecret32!),
        storage: maybeStored ?? undefined
      });
      console.log('WASM node initialized successfully');

      // Zeroize sensitive material
      if (libp2pSecret32) libp2pSecret32.fill(0);
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
      
      // Process updates
      get().sortTransactionsUpdates(updates);
      
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

  loadStorageData: () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('vane-storage-export');
        if (stored) {
          const parsed = JSON.parse(stored);

          // Normalize types: revive bigint fields expected by WASM (u128)
          // Specifically: DbTxStateMachine.amount should be bigint
          try {
            if (parsed && typeof parsed === 'object') {
              const reviveAmount = (arr: any[]) => {
                if (!Array.isArray(arr)) return [];
                return arr.map((tx) => {
                  if (tx && typeof tx === 'object') {
                    if (typeof tx.amount === 'string') {
                      // Convert serialized bigint string back to BigInt
                      tx.amount = BigInt(tx.amount);
                    }
                  }
                  return tx;
                });
              };

              if (parsed.success_transactions) {
                parsed.success_transactions = reviveAmount(parsed.success_transactions);
              }
              if (parsed.failed_transactions) {
                parsed.failed_transactions = reviveAmount(parsed.failed_transactions);
              }

              // Ensure numeric counters are numbers
              if (typeof parsed.nonce === 'string') parsed.nonce = Number(parsed.nonce);
              if (typeof parsed.total_value_success === 'string') parsed.total_value_success = Number(parsed.total_value_success);
              if (typeof parsed.total_value_failed === 'string') parsed.total_value_failed = Number(parsed.total_value_failed);
            }
          } catch (e) {
            console.warn('Warning: failed to fully normalize stored storage export. Proceeding with raw parsed object.', e);
          }

          console.log('Loaded storage data from localStorage:', parsed);
          return parsed;
        }
      } catch (error) {
        console.error('Error loading storage data from localStorage:', error);
      }
    }
    return null;
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

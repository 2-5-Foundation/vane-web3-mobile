import { create } from 'zustand'
import { TxStateMachine, VaneClientRpc, createVaneClient } from 'vane_lib'
import { config } from 'dotenv';

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

  // Methods
  setUserProfile: (userProfile: UserProfile) => void;
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (status: 'Genesis' | 'RecvAddrConfirmed' | 'RecvAddrConfirmationPassed' | 'NetConfirmed' | 'SenderConfirmed' | 'SenderConfirmationfailed' | 'RecvAddrFailed' | 'FailedToSubmitTxn' | 'TxSubmissionPassed' | 'ReceiverNotRegistered' | 'Reverted') => void;
  txStatusSorter: (update:TxStateMachine) => void;
  sortTransactionsUpdates: (txs:TxStateMachine[]) => void;
  clearAllTransactions: () => void; 
  // sender context
  removeTransaction: (txNonce: number) => void;  // Add this
  addTransaction: (tx: TxStateMachine) => void;
  // receiver context
  addRecvTransaction: (tx: TxStateMachine) => void;
  removeRecvTransaction: (txNonce: number) => void;
  // websocket connection
  wsUrl: string;
  vaneClient:VaneClientRpc | null;
  isWebSocketConnected: boolean;
  setWsUrl: (account: string) => Promise<void>;
  watchPendingTxUpdates: () => Promise<boolean>;
  fetchPendingTxUpdates: () => Promise<void>;
  disconnectWebSocket: () => void;
  // redis
  registerUserRedis: (addresses: {account: string, network: string}[]) => Promise<void>;
  addAccount: (address: string, network: string, hash: string) => Promise<void>;
  getAccountLinkHashRedis: (address: string) => Promise<string>;
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
  wsUrl: '',
  vaneClient: null,
  isWebSocketConnected: false,
  airtable: null,
  redis: null,

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
        // Cast status to string or get the type property
        const statusString = typeof update.status === 'string' 
            ? update.status 
            : (update.status as unknown as {type: string})?.type || update.status;
        
        switch (statusString) {
            case 'Genesis':
                console.log("userProfile", get().userProfile);
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

  // ---------------------------------- WebSocket connection (Postman-like stability) ----------------------------------
  watchPendingTxUpdates: async () => {
    try {
        const state = get();
        
        // Don't create multiple connections - just like Postman
        if (state.vaneClient && state.vaneClient.isConnected() && state.isWebSocketConnected) {
          console.log('WebSocket already connected and stable - no need to reconnect');
          return true;
        }

        // Clean up any existing connection first
        if (state.vaneClient) {
          console.log('Cleaning up existing connection...');
          state.vaneClient.disconnect();
          set({ vaneClient: null, isWebSocketConnected: false });
        }

        if (!state.wsUrl) {
          console.error('WebSocket URL not set');
          throw new Error('WebSocket URL not set');
        }

        console.log("Creating single stable WebSocket connection to:", state.wsUrl);
        const vaneClientInstance = await createVaneClient(state.wsUrl);
        
        if (!vaneClientInstance || !vaneClientInstance.isConnected()) {
          console.error('Failed to create or connect Vane client');
          throw new Error('Failed to create stable WebSocket connection');
        }
 
        set({ 
          vaneClient: vaneClientInstance,
          isWebSocketConnected: true
        });
 
        // Set up transaction watching once - like Postman's simple message handling
        await vaneClientInstance.watchTxUpdates((update: TxStateMachine) => {
          if (!update) {
            console.log("No updates yet, continuing to watch...");
            return;
          }

          try {
            console.log("Received transaction update:", update);
            get().txStatusSorter(update);
          } catch (error) {
            console.error('Error processing transaction update:', error);
            // Don't disconnect on processing errors - keep connection stable
          }
        });

        console.log("WebSocket connected and stable - watching for updates");
        return true;
 
    } catch (error) {
        console.error('Failed to establish stable WebSocket connection:', error);
        set({ 
          vaneClient: null,
          isWebSocketConnected: false
        });
        throw error;
    }
  },

  fetchPendingTxUpdates: async () => {
    const state = get();
    
    if (!state.vaneClient ) {
      console.warn('WebSocket not connected - cannot fetch updates');
      return;
    }

    try {
      const pendingTxUpdates = await state.vaneClient.fetchPendingTxUpdates();
      get().sortTransactionsUpdates(pendingTxUpdates);
    } catch (error) {
      console.error('Error fetching pending updates:', error);
      // Don't disconnect on fetch errors - keep connection stable
    }
  },

  disconnectWebSocket: () => {
    const state = get();
    if (state.vaneClient) {
      console.log('Manually disconnecting WebSocket...');
      state.vaneClient.disconnect();
      set({ 
        vaneClient: null,
        isWebSocketConnected: false
      });
    }
  },

  setWsUrl: async (account: string) => {
    try {
      const response = await fetch(`/api/redis/account?account=${account}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch account profile');
      }

      const wsUrl = `wss://${data.profile.rpc}`;
      set({ wsUrl: wsUrl });
      console.log('WebSocket URL set to:', wsUrl);
    } catch (error) {
      console.error('Error setting WebSocket URL:', error);
      throw error;
    }
  },

  registerUserRedis: async (addresses: {account: string, network: string}[]) => {
    try {
      const response = await fetch('/api/redis/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to register users: ${data.error}`);
      }
      set({userProfile: {account: addresses[0].account, network: addresses[0].network}});
      console.log("Redis setup successful");
    } catch (error) {
      console.error('Error registering users in Redis:', error);
      throw error;
    }
  },

  addAccount: async (account: string, network: string, hash: string) => {
    try {
      const response = await fetch('/api/redis/add-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account, network, hash }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to add account: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding account:', error);
      throw error;
    }
  },

  getAccountLinkHashRedis: async (address: string) => {
    try {
      const response = await fetch(`/api/redis/add-account?address=${address}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to fetch account hash: ${data.error}`);
      }

      return data.hash;
    } catch (error) {
      console.error('Error fetching account hash:', error);
      throw error;
    }
  }

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
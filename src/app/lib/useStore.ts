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

export interface TransactionState {
  transferFormData: TransferFormData;
  // storing incoming transactions that serve as sender notifications
  senderPendingTransactions: TxStateMachine[];  // Store all transaction updates
  // storing incoming transactions that serve as receiver notifications the receiver needs to confirm or reject
  recvTransactions: TxStateMachine[]
  status: 'pending' | 'receiverNotRegistered' | 'RecvAddrFailed' | 'receiverConfirmed' | 'senderConfirmed' | 'completed';

  // Methods
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (status: 'initial'|'pending' |'receiverNotRegistered' |'RecvAddrFailed' |'receiverConfirmed' | 'senderConfirmed' | 'completed') => void;
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
  setWsUrl: (address: string) => Promise<void>;
  watchPendingTxUpdates: () => Promise<boolean>;
  fetchPendingTxUpdates: () => Promise<void>;
  // redis
  registerUserRedis: (addresses: {address: string, network: string}[]) => Promise<void>;
  addAccount: (address: string, network: string, hash: string) => Promise<void>;
  getAccountLinkHashRedis: (address: string) => Promise<string>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // state
  transferFormData: {
    recipient: '',
    amount: 0,
    asset: '',
    network: '',
    codeword: ''
  },
  senderPendingTransactions: [],
  recvTransactions: [],
  status: 'pending',
  wsUrl: '',
  vaneClient: null,
  airtable: null,
  redis: null,

  storeSetTransferFormData: (formData: TransferFormData) => set({transferFormData: formData}),

  setTransferStatus: (status: 'receiverNotRegistered'|'pending' |'RecvAddrFailed' |'receiverConfirmed' | 'senderConfirmed' | 'completed') => set({status}),

  txStatusSorter: (update: TxStateMachine) => {
      set((state) => {
          switch (update.status) {
              case {type: 'Genesis'}:
                  console.log("Genesis");
                  // Check if transaction already exists in recvTransactions
                  if (!state.recvTransactions.some(tx => tx.txNonce === update.txNonce)) {
                      return {
                          ...state,
                          recvTransactions: [update, ...state.recvTransactions]
                      };
                  }
                  return state;
              case {type: 'RecvAddrConfirmed'}:
              case {type: 'ReceiverNotRegistered'}:
              case {type: 'RecvAddrFailed'}:
              case {type: 'SenderConfirmed'}:
                  // Check if transaction already exists in transactions
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
      console.log("sortTransactionsUpdates");
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

  // ---------------------------------- WebSocket connection ----------------------------------
  watchPendingTxUpdates: async () => {
    try {
        const state = get();
        console.log("RPC URL", `wss://${state.wsUrl}`);
        const vaneClientInstance = await createVaneClient(state.wsUrl);
        if (!vaneClientInstance) {
            console.error('Failed to create Vane client');
            throw new Error('Failed to create Vane client');
        }
 
        set({ vaneClient: vaneClientInstance });
 
        // Watch for transaction updates
        vaneClientInstance.watchTxUpdates((update: TxStateMachine) => {
            if (!update) {
                // No updates yet, just continue waiting
                return;
            }

            try {
                console.log("Received update:", update);
                get().txStatusSorter(update);
            } catch (error) {
                console.error('Error processing transaction update:', error);
                // Don't throw here, just log the error and continue watching
            }
        });

        // Return success if we got here
        return true;
 
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        set({ vaneClient: null }); // Reset client on error
        throw error; // Re-throw the error to be handled by the caller
    }
  },

  fetchPendingTxUpdates: async () => {
    const state = get();
    const vaneClientInstance = state.vaneClient;
    if (!vaneClientInstance) {
      console.error('Vane client not initialized');
      return;
    }

    const pendingTxUpdates = await vaneClientInstance.fetchPendingTxUpdates();
    get().sortTransactionsUpdates(pendingTxUpdates);
  },

  setWsUrl: async (address: string) => {
    try {
      const response = await fetch(`/api/redis/account?address=${address}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch account profile');
      }

      const wsUrl = `wss://${data.profile.rpc}`;
      set({ wsUrl: wsUrl });
    } catch (error) {
      console.error('Error setting WebSocket URL:', error);
      throw error;
    }
  },

  

  registerUserRedis: async (addresses: {address: string, network: string}[]) => {
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

      console.log("Redis setup successful");
    } catch (error) {
      console.error('Error registering users in Redis:', error);
      throw error;
    }
  },

  addAccount: async (address: string, network: string, hash: string) => {
    try {
      const response = await fetch('/api/redis/add-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, network, hash }),
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
}))
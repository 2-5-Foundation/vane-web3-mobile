import { create } from 'zustand'
import { TxStateMachine, VaneClientRpc, createVaneClient } from 'vane_lib'
import { useEffect } from 'react';

// ---------------------------------- Wallets tracking ----------------------------------

// ---------------------------------- For native wallet users ----------------------------------
// ---------------------------------- For non-native wallet users ----------------------------------







// ---------------------------------- Settings config ----------------------------------
// interface SettingsState {
  
// }

// export const useSettingsStore = create<SettingsState>((set, get) => ({

// }));


// ---------------------------------- Ongoing transaction state ----------------------------------

export interface TransferFormData {
  recipient: string;
  amount: number; 
  asset: string;
  network: string;
}

export interface TransactionState {
  transferFormData: TransferFormData;
  // storing incoming transactions that serve as sender notifications
  transactions: TxStateMachine[];  // Store all transaction updates
  // storing incoming transactions that serve as receiver notifications the receiver needs to confirm or reject
  recvTransactions: TxStateMachine[]
  status: 'initial'|'pending'| 'receiverNotRegistered' |'RecvAddrFailed' |'receiverConfirmed' | 'senderConfirmed' | 'completed';

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
  setWsUrl: (url:string) => void;
  initializeWebSocket: () => Promise<void>;
  
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // state
  transferFormData: {
    recipient: '',
    amount: 0,
    asset: '',
    network: ''
  },
  transactions: [],
  recvTransactions: [],
  status: 'initial',
  wsUrl: '',
  vaneClient: null,

  storeSetTransferFormData: (formData: TransferFormData) => set({transferFormData: formData}),

  setTransferStatus: (status: 'initial'|'receiverNotRegistered'|'pending' |'RecvAddrFailed' |'receiverConfirmed' | 'senderConfirmed' | 'completed') => set({status}),

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
                  if (!state.transactions.some(tx => tx.txNonce === update.txNonce)) {
                      return {
                          ...state,
                          transactions: [update, ...state.transactions]
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
      transactions: [tx, ...state.transactions]
    })),

  removeTransaction: (txNonce: number) =>{
      set((state) => ({
          transactions: state.transactions.filter(tx => tx.txNonce !== txNonce)
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
          transactions: [],
          recvTransactions: []
      }));
  },

  // ---------------------------------- WebSocket connection ----------------------------------
  initializeWebSocket: async () => {
    try {
        const state = get();
        
        const vaneClientInstance = await createVaneClient(state.wsUrl);
        if (!vaneClientInstance) {
            console.error('Failed to create Vane client');
            // TODO: add re connecting logic here
            return;
        }
 
        set({ vaneClient: vaneClientInstance });
 
        // Watch for transaction updates
        vaneClientInstance.watchTxUpdates((update: TxStateMachine) => {
            try {
                console.log("Received update:", update);
                get().txStatusSorter(update);
            } catch (error) {
                console.error('Error processing transaction update:', error);
            }
        });
 
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        set({ vaneClient: null }); // Reset client on error
    }
  },

  setWsUrl: (url:string) =>{
    set({wsUrl: url});
  }

}));

export const useInitializeWebSocket = () => {
  const wsUrl = useTransactionStore(state => state.wsUrl);
  const vaneClient = useTransactionStore(state => state.vaneClient);
  const initializeWebSocket = useTransactionStore(state => state.initializeWebSocket);

  useEffect(() => {
      if (!vaneClient && wsUrl) {
          try {
              initializeWebSocket();
          } catch (error) {
              console.error("Failed to initialize WebSocket:", error);
          }
      }
  }, [vaneClient, wsUrl, initializeWebSocket]);

  // Cleanup function to close the WebSocket connection when the component unmounts
  useEffect(() => {
      return () => {
          if (vaneClient) {
              vaneClient.disconnect();
          }
      };
  }, [vaneClient]);
};


// ---------------------------------- site state for buttons ----------------------------------
export type NavigationState = {
  currentView: 'wallet' | 'transfers' | 'pending' | 'profile';
  setCurrentView: (view: NavigationState['currentView']) => void;
};

export const useStore = create<NavigationState>((set) => ({
  currentView: 'transfers',
  setCurrentView: (view) => set({ currentView: view }),
}))
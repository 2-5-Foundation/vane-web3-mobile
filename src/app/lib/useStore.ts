import { create } from 'zustand'
import { TxStateMachine, VaneClientRpc, createVaneClient } from 'vane_lib'
import Airtable from 'airtable';
import { config } from 'dotenv';
import { keccak256, toHex } from 'viem'



export interface TransferFormData {
  recipient: string;
  amount: number; 
  asset: string;
  network: string;
}

config();

const apiKey = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
const baseId = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
const tableId = process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID;

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
  setWsUrl: () => void;
  watchPendingTxUpdates: () => Promise<void>;
  fetchPendingTxUpdates: () => Promise<void>;
  // airtable
  airtable: Airtable.Base | null;
  setRegisterAirtable: () => void;
  registerUserAirtable: (address: string, network: string, email: string) => void;
  
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

  setWsUrl: async () => {
    const maxRetries = 5;
    const retryDelay = 10000; // 1 second

    const fetchRpcUrl = async (retryCount = 0): Promise<string> => {
      const key = keccak256(toHex('airtable_user_id'));
      const record_id = localStorage.getItem(key);
      const airtable = get().airtable;
      console.log(`airtable id: ${record_id}`)

      return new Promise((resolve, reject) => {
        airtable(tableId).find(record_id, (err, record) => {
          
          if (err) {
            if (retryCount < maxRetries) {
              setTimeout(() => {
                fetchRpcUrl(retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, retryDelay);
            } else {
              reject(new Error('Failed to fetch RPC URL after multiple attempts'));
            }
            return;
          }

          const fields = record.fields as { rpc: string };
          if (!fields.rpc && retryCount < maxRetries) {
            setTimeout(() => {
              fetchRpcUrl(retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, retryDelay);
          } else if (fields.rpc) {
            resolve(fields.rpc);
          } else {
            reject(new Error('Rpc url not found'));
          }
        });
      });
    };

    try {
      const rpcUrl = await fetchRpcUrl();
      set({ wsUrl: rpcUrl });
    } catch (error) {
      console.error('Failed to fetch RPC URL:', error);
      // TODO: Handle error (maybe show toast notification)
    }
  },
  // airtable
  setRegisterAirtable: () => {
    try {   
      const airtable = new Airtable({ apiKey: apiKey }).base(baseId);
      set({ airtable });
      console.log("airtable setup successful", airtable);
    } catch (error) {
      console.log("Error setting up Airtable:", error);
    }
  },
  registerUserAirtable: (address: string, network: string, email: string) => {
    get().setRegisterAirtable();
    const airtable = get().airtable;

    airtable(tableId)?.create([
      {
        "fields": {
          "accountId1": JSON.stringify({
            account: address,
            network: network
          }),
          "social": email
        }
      }
    ],(err, records) => {
      if (err) {
        console.error(err);
      } else {
        const key = keccak256(toHex('airtable_user_id'));
        localStorage.setItem(key, records[0].getId());      
      }
    });
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
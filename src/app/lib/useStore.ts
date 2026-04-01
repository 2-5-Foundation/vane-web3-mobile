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

import { create } from "zustand";
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
  fetchTxSessionLogs,
  watchTxUpdates,
  exportStorage,
  StorageExport,
  isInitialized,
  LogLevel,
  addAccount,
  clearRevertedFromCache,
  deleteTxInCache,
  verifyTxCallPayload,
  clearCache,
} from "@/lib/vane_lib/main";

import { config } from "dotenv";
import { bytesToHex } from "viem";
import { toast } from "sonner";
import { toWire } from "@/lib/vane_lib/pkg/host_functions/networking";

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

export type TxLifecycleRole = "sender" | "receiver";
export type TrackerType =
  | "context_capture"
  | "tx_lifecycle_event"
  | "backend_send_result"
  | "fetch_pending_updates"
  | "wallet_connection";

export interface TxTrackerContext {
  browserName?: string;
  userAgent?: string;
  networkInfo?: string;
  walletName?: string;
  walletAddress?: string;
  walletConnected?: boolean;
  ipAddress?: string;
  ipFetchSuccess?: boolean;
  ipFetchError?: string;
}

export interface TxTrackerEvent {
  timestamp: number;
  trackerType: TrackerType;
  stage: string;
  role?: TxLifecycleRole;
  success?: boolean;
  backendSent?: boolean;
  shownInUi?: boolean;
  details?: string;
  log?: TxStateMachine;
  contextSnapshot?: TxTrackerContext;
}

export interface TxTrackerRecord {
  multiId: string;
  events: TxTrackerEvent[];
  backend?: TxSessionLogEntry[];
}

export interface TxTrackerState {
  context: TxTrackerContext;
  byMultiId: Record<string, TxTrackerRecord>;
  globalEvents: TxTrackerEvent[];
}

export interface TxSessionLogEntry {
  timestamp: number;
  stage: string;
  log: TxStateMachine;
}

export interface TransactionState {
  userProfile: UserProfile;
  transferFormData: TransferFormData;
  vaneAuth: Uint8Array;
  metricsTxList: TxStateMachine[];
  // storing incoming transactions that serve as sender notifications
  senderPendingTransactions: TxStateMachine[]; // Store all transaction updates
  // storing incoming transactions that serve as receiver notifications the receiver needs to confirm or reject
  recvTransactions: TxStateMachine[];
  status:
    | "Genesis"
    | "RecvAddrConfirmed"
    | "RecvAddrConfirmationPassed"
    | "NetConfirmed"
    | "SenderConfirmed"
    | "SenderConfirmationfailed"
    | "RecvAddrFailed"
    | "FailedToSubmitTxn"
    | "TxSubmissionPassed"
    | "ReceiverNotRegistered"
    | "Reverted";

  // WASM state
  isWatchingUpdates: boolean;
  backendConnected: boolean;
  txTracker: TxTrackerState;

  // Methods
  setBackendConnected: (connected: boolean) => void;
  setVaneAuth: (vaneAuth: Uint8Array) => void;
  setMetricsTxList: (txList: TxStateMachine[]) => void;
  setUserProfile: (userProfile: UserProfile) => void;
  storeSetTransferFormData: (formData: TransferFormData) => void;
  setTransferStatus: (
    status:
      | "Genesis"
      | "RecvAddrConfirmed"
      | "RecvAddrConfirmationPassed"
      | "NetConfirmed"
      | "SenderConfirmed"
      | "SenderConfirmationfailed"
      | "RecvAddrFailed"
      | "FailedToSubmitTxn"
      | "TxSubmissionPassed"
      | "ReceiverNotRegistered"
      | "Reverted",
  ) => void;
  txStatusSorter: (update: TxStateMachine) => void;
  sortTransactionsUpdates: (txs: TxStateMachine[]) => void;
  clearAllTransactions: () => void;
  // sender context
  removeTransaction: (tx: TxStateMachine) => void;
  addTransaction: (tx: TxStateMachine) => void;
  // receiver context
  addRecvTransaction: (tx: TxStateMachine) => void;
  removeRecvTransaction: (txNonce: number) => void;
  isWasmCorrupted: () => Promise<boolean>;

  // WASM initialization and management
  initializeWasm: (
    relayMultiAddr: string,
    account: string,
    network: string,
    selfNode: boolean,
    live: boolean,
  ) => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  isWasmInitialized: () => boolean;
  clearCache: () => void;

  // WASM transaction methods
  initiateTransaction: (
    sender: string,
    receiver: string,
    amount: bigint,
    token: Token,
    codeWord: string,
    senderNetwork: ChainSupported,
    receiverNetwork: ChainSupported,
    vaneFeesAmount: bigint,
  ) => Promise<TxStateMachine>;
  addAccount: (accountId: string, network: string) => Promise<void>;
  senderConfirmTransaction: (tx: TxStateMachine) => Promise<void>;
  receiverConfirmTransaction: (tx: TxStateMachine) => Promise<void>;
  verifyTxCallPayload: (tx: TxStateMachine) => Promise<void>;
  revertTransaction: (tx: TxStateMachine, reason?: string) => Promise<void>;
  fetchPendingUpdates: () => Promise<TxStateMachine[]>;
  exportStorageData: () => Promise<StorageExport>;
  loadStorageData: () => StorageExport | null;
  recordTrackerEvent: (
    trackerType: TrackerType,
    params: Partial<TxTrackerEvent>,
  ) => void;
  captureTrackerContext: (
    params?: Partial<
      Pick<
        TxTrackerContext,
        "walletName" | "walletAddress" | "walletConnected" | "networkInfo"
      >
    >,
  ) => Promise<void>;
  fetchTxSessionLogsByMultiId: (
    address: string,
    multiId?: string,
  ) => Promise<TxSessionLogEntry[]>;
  getTxLifecycle: (multiId: string) => TxTrackerRecord | null;
  clearTxLifecycle: (multiId?: string) => void;

  // Utility methods
  isTransactionReverted: (tx: TxStateMachine) => boolean;
  isTransactionCompleted: (tx: TxStateMachine) => boolean;
  getTransactionStatus: (tx: TxStateMachine) => string;
}

const normalizeChainAddress = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  return value.split(":").pop()?.trim().toLowerCase() ?? "";
};

const stringToChainSupported = (network: string): ChainSupported => {
  if (network === "SOL") return ChainSupported.Solana;

  const upper = network.toUpperCase();
  if (upper === "EVM") return ChainSupported.Ethereum;
  const normalized =
    network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  const chain = Object.values(ChainSupported).find(
    (c) => c === normalized || c === network,
  );

  if (!chain) {
    throw new Error(`Invalid network: ${network}`);
  }

  return chain;
};

const getBrowserName = (ua: string): string => {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
};

const resolveMultiIdFromTx = (tx?: TxStateMachine): string | null => {
  if (!tx?.multiId || tx.multiId.length === 0) {
    return null;
  }
  return bytesToHex(Uint8Array.from(tx.multiId));
};

const cloneTxSnapshot = (tx?: TxStateMachine): TxStateMachine | undefined => {
  if (!tx) return undefined;
  try {
    return structuredClone(tx);
  } catch {
    return tx;
  }
};

const deriveRoleFromTx = (
  tx: TxStateMachine | undefined,
  currentAccount: string,
): TxLifecycleRole | undefined => {
  if (!tx) {
    return undefined;
  }

  const normalizedCurrent = normalizeChainAddress(currentAccount);
  if (!normalizedCurrent) {
    return undefined;
  }

  const normalizedSender = normalizeChainAddress(tx.senderAddress);
  const normalizedReceiver = normalizeChainAddress(tx.receiverAddress);

  if (normalizedSender === normalizedCurrent) {
    return "sender";
  }
  if (normalizedReceiver === normalizedCurrent) {
    return "receiver";
  }

  return undefined;
};

const isDuplicateTrackerEvent = (
  prev: TxTrackerEvent | undefined,
  next: TxTrackerEvent,
): boolean => {
  if (!prev) {
    return false;
  }

  return (
    prev.trackerType === next.trackerType &&
    prev.stage === next.stage &&
    (prev.details ?? "") === (next.details ?? "") &&
    (prev.success ?? null) === (next.success ?? null) &&
    (prev.backendSent ?? null) === (next.backendSent ?? null) &&
    (prev.shownInUi ?? null) === (next.shownInUi ?? null)
  );
};

const lifecycleStageFromStatus = (status: string): string => {
  switch (status) {
    case "Genesis":
      return "initial request sender";
    case "RecvAddrConfirmed":
    case "RecvAddrConfirmationPassed":
      return "receiver response";
    case "NetConfirmed":
      return "receiver response";
    case "SenderConfirmed":
      return "sender confirmation";
    case "TxSubmissionPassed":
    case "FailedToSubmitTxn":
      return "tx submission";
    case "Reverted":
      return "sender revertation";
    case "ReceiverNotRegistered":
      return "receiver not registered";
    case "RecvAddrFailed":
      return "receiver response failed";
    case "SenderConfirmationfailed":
      return "sender confirmation failed";
    default:
      return `tx status ${status}`;
  }
};

const defaultStageByTrackerType = (trackerType: TrackerType): string => {
  switch (trackerType) {
    case "context_capture":
      return "context captured";
    case "wallet_connection":
      return "wallet event";
    case "fetch_pending_updates":
      return "pending updates";
    case "backend_send_result":
      return "backend send result";
    case "tx_lifecycle_event":
      return "tx lifecycle";
    default:
      return "tracker event";
  }
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  // state
  vaneAuth: new Uint8Array(),
  metricsTxList: [],
  userProfile: {
    account: "",
    network: "",
  },
  transferFormData: {
    recipient: "",
    amount: 0,
    asset: "",
    network: "",
    codeword: "",
  },
  senderPendingTransactions: [],
  recvTransactions: [],
  status: "Genesis",
  isWatchingUpdates: false,
  backendConnected: false,
  txTracker: {
    context: {},
    byMultiId: {},
    globalEvents: [],
  },

  // method
  setBackendConnected: (connected: boolean) => set({ backendConnected: connected }),
  setVaneAuth: (vaneAuth: Uint8Array) => set({ vaneAuth }),
  setMetricsTxList: (txList: TxStateMachine[]) => set({ metricsTxList: txList }),
  setUserProfile: (userProfile: UserProfile) => {
    set({
      userProfile: {
        ...userProfile,
        account: normalizeChainAddress(userProfile.account),
      },
    });
  },
  storeSetTransferFormData: (formData: TransferFormData) =>
    set({ transferFormData: formData }),

  setTransferStatus: (
    status:
      | "Genesis"
      | "RecvAddrConfirmed"
      | "RecvAddrConfirmationPassed"
      | "NetConfirmed"
      | "SenderConfirmed"
      | "SenderConfirmationfailed"
      | "RecvAddrFailed"
      | "FailedToSubmitTxn"
      | "TxSubmissionPassed"
      | "ReceiverNotRegistered"
      | "Reverted",
  ) => set({ status }),

  txStatusSorter: (update: TxStateMachine) => {
    const statusString = get().getTransactionStatus(update);
    const normalizedCurrentAccount = normalizeChainAddress(get().userProfile.account);
    const normalizedSenderAddress = normalizeChainAddress(update.senderAddress);
    const normalizedReceiverAddress = normalizeChainAddress(update.receiverAddress);
    const isSender =
      normalizedCurrentAccount !== "" &&
      normalizedSenderAddress === normalizedCurrentAccount;
    const isReceiver =
      normalizedCurrentAccount !== "" &&
      normalizedReceiverAddress === normalizedCurrentAccount;
    const lifecycleStage = lifecycleStageFromStatus(statusString);

    if (isSender) {
      get().recordTrackerEvent("tx_lifecycle_event", {
        role: "sender",
        stage: lifecycleStage,
        shownInUi: true,
        log: update,
        details: `sender tx update (${statusString})`,
      });
    }

    if (isReceiver) {
      get().recordTrackerEvent("tx_lifecycle_event", {
        role: "receiver",
        stage: lifecycleStage,
        shownInUi: true,
        log: update,
        details: `receiver tx update (${statusString})`,
      });
    }

    set((state) => {
      switch (statusString) {
        case "Genesis":
          if (isSender) {
            return {
              ...state,
              senderPendingTransactions: [
                update,
                ...state.senderPendingTransactions,
              ],
            };
          }

          if (isReceiver) {
            return {
              ...state,
              recvTransactions: [update, ...state.recvTransactions],
            };
          }

          return state;

        case "RecvAddrConfirmed":
        case "RecvAddrConfirmationPassed":
        case "NetConfirmed":
        case "ReceiverNotRegistered":
        case "RecvAddrFailed":
        case "SenderConfirmed":
        case "SenderConfirmationfailed":
        case "FailedToSubmitTxn":
        case "TxSubmissionPassed":
        case "TxError":
        case "Reverted":
          if (isSender) {
            return {
              ...state,
              senderPendingTransactions: [
                update,
                ...state.senderPendingTransactions,
              ],
            };
          }

        default:
          return state;
      }
    });
  },

  sortTransactionsUpdates: (txs: TxStateMachine[]) => {
    txs.forEach((tx) => {
      // Call txStatusSorter directly as it now handles the state updates
      get().txStatusSorter(tx);
    });
  },

  addTransaction: (tx: TxStateMachine) =>
    set((state) => ({
      senderPendingTransactions: [tx, ...state.senderPendingTransactions],
    })),

  removeTransaction: (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }
    deleteTxInCache(tx);
    set((state) => ({
      senderPendingTransactions: state.senderPendingTransactions.filter(
        (tx) => tx.txNonce !== tx.txNonce,
      ),
    }));
  },

  addRecvTransaction: (tx: TxStateMachine) =>
    set((state) => ({
      recvTransactions: [tx, ...state.recvTransactions],
    })),

  removeRecvTransaction: (txNonce: number) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }
    const toRemove = get().recvTransactions.find((t) => t.txNonce === txNonce);
    if (toRemove) {
      deleteTxInCache(toRemove);
    }
    set((state) => ({
      recvTransactions: state.recvTransactions.filter(
        (tx) => tx.txNonce !== txNonce,
      ),
    }));
  },

  clearAllTransactions: () => {
    set((state) => ({
      ...state,
      senderPendingTransactions: [],
      recvTransactions: [],
    }));
  },

  isWasmCorrupted: async () => {
    const TIMEOUT_MS = 1500;
    const vaneAuth = get().vaneAuth;

    // Missing auth makes WASM operations unusable for tx flow.
    if (vaneAuth.length === 0) {
      return true;
    }

    try {
      await Promise.race([
        exportStorage(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("WASM_HEALTHCHECK_TIMEOUT")),
            TIMEOUT_MS,
          ),
        ),
      ]);

      console.log("WASM is not corrupted");
      return false;
    } catch (e) {
      console.log("WASM is corrupted");
      const msg = String((e as any)?.message ?? e);

      // Not initialized is handled explicitly by UI checks and should not be
      // classified as corruption here.
      if (msg.includes("WASM node not initialized")) {
        return false;
      }

      // Fail closed: unknown WASM health-check errors are treated as corrupted
      // to avoid false healthy status in the UI.
      return true;
    }
  },

  // WASM initialization and management
  initializeWasm: async (
    relayMultiAddr: string,
    account: string,
    network: string,
    selfNode: boolean,
    live: boolean = true,
  ) => {
    try {
      if (isInitialized()) {
        console.log("WASM already initialized");
        return;
      }

      const vaneAuth = get().vaneAuth;
      if (vaneAuth.length === 0) {
        throw new Error("vane auth is not set");
      }

      console.log("Initializing WASM node...");

      // Load storage export from localStorage if it exists
      const storageExport = get().loadStorageData();

      if (storageExport) {
        console.log("Loaded storage export from localStorage");
      } else {
        console.log("No storage export found in localStorage");
      }

      await initializeNode({
        sig: vaneAuth,
        relayMultiAddr,
        account,
        network,
        self_node: selfNode,
        live,
        logLevel: LogLevel.Info,
        storage: storageExport ?? undefined,
      });
      console.log("WASM node initialized successfully");

      // Zeroize sensitive material
    } catch (error) {
      toast.error("Failed to initialize app");
      console.error("Failed to initialize app:", error);
      throw error;
    }
  },

  startWatching: async () => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    const state = get();
    if (state.isWatchingUpdates) {
      console.log("Already watching updates");
      return;
    }

    try {
      await watchTxUpdates((tx: TxStateMachine) => {
        get().txStatusSorter(tx);
      });

      set({ isWatchingUpdates: true });
      console.log("Started watching transaction updates");
    } catch (error) {
      console.error("Error starting transaction watching:", error);
      throw error;
    }
  },

  stopWatching: () => {
    set({ isWatchingUpdates: false });
    console.log("Stopped watching transaction updates");
  },

  isWasmInitialized: () => isInitialized(),
  clearCache: async () => await clearCache(),

  // WASM transaction methods
  initiateTransaction: async (
    sender: string,
    receiver: string,
    amount: bigint,
    token: Token,
    codeWord: string,
    senderNetwork: ChainSupported,
    receiverNetwork: ChainSupported,
    vaneFeesAmount: bigint,
  ) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }
    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }

    try {
      const tx = await initiateTransaction(
        vaneAuth,
        sender,
        receiver,
        amount,
        token,
        codeWord,
        senderNetwork,
        receiverNetwork,
        vaneFeesAmount,
      );
      console.log("Transaction initiated successfully:", tx);

      // Add to local state
      get().txStatusSorter(tx);

      return tx;
    } catch (error) {
      console.error("Error initiating transaction:", error);
      throw error;
    }
  },
  addAccount: async (accountId: string, network: string) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }
    try {
      const chainSupported = stringToChainSupported(network);
      await addAccount(accountId, chainSupported);
      console.log("Account added successfully");
    } catch (error) {
      console.error("Error adding account:", error);
      throw error;
    }
  },

  verifyTxCallPayload: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }
    try {
      await verifyTxCallPayload(tx);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  senderConfirmTransaction: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }

    try {
      await senderConfirm(vaneAuth, tx);
  
    } catch (error) {
      console.error("Error confirming transaction by sender:", error);
      toast.error("Error confirming transaction");
      throw error;
    }
  },

  receiverConfirmTransaction: async (tx: TxStateMachine) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }

    try {
      await receiverConfirm(vaneAuth, tx);
    } catch (error) {
      console.error("Error confirming transaction by receiver:", error);
      throw error;
    }
  },

  revertTransaction: async (tx: TxStateMachine, reason?: string) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }

    try {
      await revertTransaction(vaneAuth, tx, reason);
      console.log("Transaction reverted successfully");
    } catch (error) {
      console.error("Error reverting transaction:", error);
      throw error;
    }
  },

  fetchPendingUpdates: async () => {
    const state = get();
    get().recordTrackerEvent("fetch_pending_updates", {
      stage: "fetch called",
      details: "useStore.fetchPendingUpdates invoked",
    });

    if (!state.isWasmInitialized()) {
      console.warn("WASM node not initialized - cannot fetch updates");
      return [];
    }

    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }

    try {
      const updates = await fetchPendingTxUpdates(vaneAuth);
      console.log("Fetched pending updates:", updates);
      if (!updates || updates.length === 0) {
        get().recordTrackerEvent("fetch_pending_updates", {
          stage: "fetch result",
          details: "useStore.fetchPendingUpdates returned 0",
        });
      } else {
        updates.forEach((tx, index) => {
          get().recordTrackerEvent("fetch_pending_updates", {
            stage: "fetch result",
            details: `useStore.fetchPendingUpdates returned tx ${index + 1}/${updates.length}`,
            log: tx,
          });
        });
      }

      // If updates is empty, clear all transactions
      if (!updates || updates.length === 0) {
        console.log("No updates found, clearing transactions");
        set((state) => ({
          ...state,
          senderPendingTransactions: [],
          recvTransactions: [],
        }));
      } else {
        // Clear existing transactions and process new updates
        set((state) => ({
          ...state,
          senderPendingTransactions: [],
          recvTransactions: [],
        }));

        // Process updates
        get().sortTransactionsUpdates(updates);
      }

      return updates;
    } catch (error) {
      // Catch WASM RuntimeError specifically
      if (error instanceof Error && error.name === "RuntimeError") {
        console.error(
          "WASM RuntimeError in fetchPendingUpdates (possibly Base network issue):",
          error,
        );
        return [];
      }
      console.error("Error fetching pending updates:", error);
      return [];
    }
  },

  exportStorageData: async (): Promise<StorageExport> => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    try {
      const storage = await exportStorage();
      console.log("Exported storage data:", storage);

      // Normalize BigInt values to numbers for safe serialization
      // Specifically handles DbTxStateMachine arrays where amount might be BigInt
      const normalizeBigInt = (value: any): any => {
        if (typeof value === "bigint") {
          return Number(value);
        }
        if (Array.isArray(value)) {
          // Handle arrays - recursively normalize each element
          return value.map((item) => {
            // If item is an object (like DbTxStateMachine), normalize it
            if (
              item !== null &&
              typeof item === "object" &&
              !Array.isArray(item)
            ) {
              const normalized: any = {};
              for (const key in item) {
                // Convert BigInt amount to number
                if (key === "amount" && typeof item[key] === "bigint") {
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
        if (value !== null && typeof value === "object") {
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
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "vane-storage-export",
          JSON.stringify(normalizedStorage),
        );
        console.log("Storage data saved to localStorage");
      }

      return normalizedStorage;
    } catch (error) {
      console.error("Error exporting and saving storage data:", error);
      throw error;
    }
  },

  loadStorageData: (): StorageExport | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const stored = localStorage.getItem("vane-storage-export");
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);

      if (!parsed || typeof parsed !== "object") {
        console.warn("Invalid storage data format in localStorage");
        return null;
      }

      // Normalize types: revive bigint fields expected by WASM (u128)
      // Specifically: DbTxStateMachine.amount should be bigint
      const reviveTransactionAmount = (tx: any): any => {
        if (!tx || typeof tx !== "object") {
          return tx;
        }

        // Convert amount from string to BigInt if needed
        if (tx.amount !== undefined) {
          if (typeof tx.amount === "string") {
            try {
              tx.amount = BigInt(tx.amount);
            } catch (e) {
              console.warn("Failed to convert amount to BigInt:", tx.amount, e);
              return null; // Invalid transaction
            }
          } else if (typeof tx.amount === "number") {
            // Convert number to BigInt (shouldn't happen, but handle it)
            tx.amount = BigInt(tx.amount);
          }
          // If already BigInt, keep it as is
        }

        // Ensure tx_hash is an array of numbers
        if (tx.tx_hash && Array.isArray(tx.tx_hash)) {
          tx.tx_hash = tx.tx_hash.map((val: any) =>
            typeof val === "string" ? parseInt(val, 10) : Number(val),
          );
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
        nonce:
          typeof parsed.nonce === "string"
            ? Number(parsed.nonce)
            : typeof parsed.nonce === "bigint"
              ? Number(parsed.nonce)
              : (parsed.nonce ?? 0),
        success_transactions: reviveTransactions(
          parsed.success_transactions || [],
        ),
        failed_transactions: reviveTransactions(
          parsed.failed_transactions || [],
        ),
        ...(parsed.user_account && { user_account: parsed.user_account }),
      };

      console.log("Loaded storage data from localStorage:", storageExport);
      return storageExport;
    } catch (error) {
      console.error("Error loading storage data from localStorage:", error);
      return null;
    }
  },

  recordTrackerEvent: (
    trackerType: TrackerType,
    params: Partial<TxTrackerEvent>,
  ) => {
    const nowMs = Date.now();
    const normalizedStage = (params.stage ?? "").trim();
    const resolvedLog = cloneTxSnapshot(params.log);
    const resolvedRole =
      deriveRoleFromTx(resolvedLog, get().userProfile.account) ?? params.role;
    const baseEvent: TxTrackerEvent = {
      timestamp: nowMs,
      trackerType,
      ...params,
      stage:
        normalizedStage.length > 0
          ? normalizedStage
          : defaultStageByTrackerType(trackerType),
      role: resolvedRole,
      log: resolvedLog,
      contextSnapshot: {
        ...get().txTracker.context,
        ...(params.contextSnapshot ?? {}),
      },
    };

    const isTxSpecific =
      trackerType === "tx_lifecycle_event" ||
      trackerType === "backend_send_result" ||
      (trackerType === "fetch_pending_updates" && !!params.log);
    const derivedMultiId = resolveMultiIdFromTx(params.log);

    if (isTxSpecific && !derivedMultiId) {
      return;
    }

    set((state) => {
      const nextTracker: TxTrackerState = {
        ...state.txTracker,
        context: baseEvent.contextSnapshot ?? state.txTracker.context,
        byMultiId: { ...state.txTracker.byMultiId },
        globalEvents: [...state.txTracker.globalEvents],
      };

      if (derivedMultiId) {
        const record = nextTracker.byMultiId[derivedMultiId] ?? {
          multiId: derivedMultiId,
          events: [],
        };

        const lastEvent = record.events[record.events.length - 1];
        if (isDuplicateTrackerEvent(lastEvent, baseEvent)) {
          return state;
        }

        nextTracker.byMultiId[derivedMultiId] = {
          ...record,
          events: [...record.events, baseEvent],
        };
      } else {
        const lastGlobalEvent =
          nextTracker.globalEvents[nextTracker.globalEvents.length - 1];
        if (isDuplicateTrackerEvent(lastGlobalEvent, baseEvent)) {
          return state;
        }
        nextTracker.globalEvents.push(baseEvent);
      }

      return { txTracker: nextTracker };
    });
  },

  captureTrackerContext: async (params) => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const context: TxTrackerContext = {
      browserName: getBrowserName(ua),
      userAgent: ua,
      networkInfo: params?.networkInfo ?? get().userProfile.network,
      walletName: params?.walletName,
      walletAddress: params?.walletAddress,
      walletConnected: params?.walletConnected,
    };

    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) {
        throw new Error(`ip_fetch_failed_${response.status}`);
      }
      const data = (await response.json()) as { ip?: string };
      context.ipAddress = data.ip;
      context.ipFetchSuccess = true;
    } catch (error) {
      context.ipFetchSuccess = false;
      context.ipFetchError = error instanceof Error ? error.message : String(error);
    }

    get().recordTrackerEvent("context_capture", { contextSnapshot: context });
  },

  fetchTxSessionLogsByMultiId: async (address: string, multiId?: string) => {
    if (!isInitialized()) {
      throw new Error("WASM node not initialized");
    }

    const vaneAuth = get().vaneAuth;
    if (vaneAuth.length === 0) {
      throw new Error("vane auth is not set");
    }
    console.log("[fetchTxSessionLogsByMultiId] vaneAuth", vaneAuth);


    try {
      const sessionLogs = await fetchTxSessionLogs(
        vaneAuth,
        address,
        multiId?.trim() ? multiId : null,
      );
      const normalizedLogs = Array.isArray(sessionLogs)
        ? (sessionLogs as TxSessionLogEntry[])
        : [];

      set((state) => {
        const existing = state.txTracker.byMultiId[multiId] ?? {
          multiId,
          events: [],
        };
        return {
          txTracker: {
            ...state.txTracker,
            byMultiId: {
              ...state.txTracker.byMultiId,
              [multiId]: {
                ...existing,
                backend: normalizedLogs,
              },
            },
          },
        };
      });

      return normalizedLogs;
    } catch (error) {
      console.error(`Error fetching tx session logs for ${multiId}:`, error);
      return [];
    }
  },

  getTxLifecycle: (multiId: string) => {
    return get().txTracker.byMultiId[multiId] ?? null;
  },

  clearTxLifecycle: (multiId?: string) => {
    if (multiId) {
      set((state) => {
        const nextByMultiId = { ...state.txTracker.byMultiId };
        delete nextByMultiId[multiId];
        return {
          txTracker: {
            ...state.txTracker,
            byMultiId: nextByMultiId,
          },
        };
      });
      return;
    }

    set((state) => ({
      txTracker: {
        ...state.txTracker,
        byMultiId: {},
        globalEvents: [],
      },
    }));
  },

  // Utility methods
  isTransactionReverted: (tx: TxStateMachine) => {
    const status = get().getTransactionStatus(tx);
    return status === "Reverted" || status === "FailedToSubmitTxn";
  },

  isTransactionCompleted: (tx: TxStateMachine) => {
    const status = get().getTransactionStatus(tx);
    return (
      status === "TxSubmissionPassed" ||
      status === "FailedToSubmitTxn" ||
      status === "Reverted"
    );
  },

  getTransactionStatus: (tx: TxStateMachine) => {
    if (typeof tx.status === "string") {
      return tx.status;
    }

    if (typeof tx.status === "object" && tx.status !== null) {
      // Handle object-based status
      if ("type" in tx.status) {
        return tx.status.type;
      }

      // Handle status with data
      const keys = Object.keys(tx.status);
      return keys.length > 0 ? keys[0] : "Unknown";
    }

    return "Unknown";
  },
}));

// ---------------------------------- site state for buttons ----------------------------------
export type NavigationState = {
  currentView: "wallet" | "transfers" | "pending" | "profile";
  setCurrentView: (view: NavigationState["currentView"]) => void;
};

export const useStore = create<NavigationState>((set) => ({
  currentView: "transfers",
  setCurrentView: (view) => set({ currentView: view }),
}));

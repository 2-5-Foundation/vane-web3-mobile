"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore"
import { TxStateMachine, TxStateMachineManager } from '@/lib/vane_lib/main'
import { bytesToHex, hexToBytes } from 'viem';
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";

// Helper to generate a unique key for a transaction
const getTxKey = (tx: TxStateMachine | { receiverAddress: string; amount: number; asset: string; codeword: string }) => {
  // Use txNonce if available (for real tx), else composite key
  if ('txNonce' in tx && tx.txNonce !== undefined && tx.txNonce !== null) return `nonce_${tx.txNonce}`;
  return [
    tx.receiverAddress,
    tx.amount.toString(),
    'codeword' in tx ? tx.codeword : tx.codeWord
  ].join(":");
};

// Timer component
const TxTimer = ({ txKey, duration = 600 }: { txKey: string; duration?: number }) => {
  // duration in seconds (default 10 min)
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check localStorage for expiry
    const storageKey = `tx-timer-expiry-${txKey}`;
    let expiryTimestamp: number;
    const expiry = localStorage.getItem(storageKey);
    const now = Math.floor(Date.now() / 1000);
    if (expiry) {
      expiryTimestamp = parseInt(expiry, 10);
      // If expired, reset for new initiated transaction
      if (expiryTimestamp < now) {
        expiryTimestamp = now + duration;
        localStorage.setItem(storageKey, String(expiryTimestamp));
      }
    } else {
      // Set expiry to now + duration
      expiryTimestamp = now + duration;
      localStorage.setItem(storageKey, String(expiryTimestamp));
    }

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = expiryTimestamp - now;
      setRemaining(diff > 0 ? diff : 0);
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [txKey, duration]);

  // Format mm:ss or show 'expired'
  if (remaining <= 0) {
    return (
      <span className="ml-2 px-2 py-0.5 rounded bg-[#1A2A2A] text-red-400 text-xs font-mono min-w-[44px] text-center">
        expired
      </span>
    );
  }
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <span className="ml-2 px-2 py-0.5 rounded bg-[#1A2A2A] text-[#7EDFCD] text-xs font-mono min-w-[44px] text-center">
      {mm}:{ss}
    </span>
  );
};

export default function SenderPending({
  initiatedTransactions = []
}: {
  initiatedTransactions?: TxStateMachine[];
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelConfirmArr, setShowCancelConfirmArr] = useState<boolean[]>([]);
  const [showActionConfirmMap, setShowActionConfirmMap] = useState<Record<string, boolean>>({});
  const [showSuccessComponents, setShowSuccessComponents] = useState<Set<string>>(new Set());
  const removeTransaction = useTransactionStore(state => state.removeTransaction)
  const addTransaction = useTransactionStore(state => state.addTransaction)
  const fetchPendingUpdates = useTransactionStore(state => state.fetchPendingUpdates)
  const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const senderConfirmTransaction = useTransactionStore(state => state.senderConfirmTransaction)
  const revertTransaction = useTransactionStore(state => state.revertTransaction)
  // ------------- Wallet ---------------------------------------
  const {primaryWallet}  = useDynamicContext()
  
  // Effect to handle 3-second delay for success components
  useEffect(() => {
    const timeouts: Record<string, ReturnType<typeof setTimeout>> = {};
    
    senderPendingTransactions.forEach(transaction => {
      const statusType = typeof transaction.status === 'string' ? transaction.status : transaction.status?.type || '';
      const txKey = String(transaction.txNonce || transaction.receiverAddress);
      
      if (statusType === 'TxSubmissionPassed' && !showSuccessComponents.has(txKey)) {
        // Set a 3-second timeout to show the success component
        timeouts[txKey] = setTimeout(() => {
          setShowSuccessComponents(prev => new Set(prev).add(txKey));
        }, 3000);
      }
    });
    
    // Cleanup timeouts
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [senderPendingTransactions, showSuccessComponents]);

  const handleRevert = async (transaction) => {
    await revertTransaction(transaction, "User requested revert");
    removeTransaction(transaction.txNonce);
    toast.info(`Transaction to ${transaction.receiverAddress} Reverted Safely`);
  }

  const handleConfirm = async(transaction:TxStateMachine) => {
    try {
      // Handle confirm logic
      // sign the transaction payload & update the transaction state
      const signature = await primaryWallet?.signMessage(bytesToHex(transaction.callPayload![0]))
      const txManager = new TxStateMachineManager(transaction);
      console.log(`signature:${signature}`)
      txManager.setSignedCallPayload(hexToBytes(signature as `0x${string}`));
      const updatedTransaction = txManager.getTx();

      await senderConfirmTransaction(updatedTransaction)
      
      // THIS WAS FOR SIMULATION ONLY
      // Create success transaction with TxSubmissionPassed status
      const successTxManager = new TxStateMachineManager(updatedTransaction);
      successTxManager.updateStatus({ type: 'TxSubmissionPassed', data: { hash: new Uint8Array(32) } });
      const successTransaction = successTxManager.getTx();
      
      // Remove the old transaction and add the success transaction
      removeTransaction(transaction.txNonce);
      addTransaction(successTransaction);
      
    } catch (error) {
      console.error('Error confirming transaction:', error);
      toast.error('Failed to confirm transaction');
    }
  }

  const handleComplete = (transaction) => {
    // Remove the transaction from the store
    removeTransaction(transaction.txNonce)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    // Call fetchPendingUpdates to get latest data
    fetchPendingUpdates()
    
    // Run for 3 seconds
    setTimeout(() => {
      setIsRefreshing(false)
      
      // After 3 seconds, check if senderPendingTransactions is empty
      // If empty, remove the default card by dispatching an event
      if (!senderPendingTransactions || senderPendingTransactions.length === 0) {
        // Remove all initiated transactions since no real transactions were found
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('removeAllInitiatedTx'));
        }
      }
    }, 3000)
  }

  // WASM is initialized in transfer-form.tsx when wallet connects

  const handleShowActionConfirm = (txKey: string, show: boolean) => {
    setShowActionConfirmMap(prev => ({ ...prev, [txKey]: show }));
  };

  const renderActionButtons = (transaction) => {
    // Fix: handle both string and object status
    const statusType = typeof transaction.status === 'string'
      ? transaction.status
      : transaction.status?.type;

    switch (statusType) {
      case 'Genesis':
        return !showActionConfirmMap[transaction.txNonce] ? (
          <div className="w-full">
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              variant="outline"
              className="w-full block h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
            >
              Revert
            </Button>
          </div>
        ) : (
          <Dialog open={showActionConfirmMap[transaction.txNonce]} onOpenChange={(open) => handleShowActionConfirm(transaction.txNonce, open)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  <Alert className="bg-red-100/10 border-red-300/40">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <AlertTitle className="text-red-400 font-semibold">Revert Transaction?</AlertTitle>
                  </Alert>
                </DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Are you sure you want to revert this transaction?
              </DialogDescription>
              <DialogFooter className="flex gap-2">
                <Button
                  className="flex-1 bg-red-400 hover:bg-red-500 text-white font-semibold"
                  onClick={() => handleRevert(transaction)}
                >
                  Confirm Revert
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-300/40 text-red-400"
                  onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                >
                  Keep Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      case 'RecvAddrFailed':
        return !showActionConfirmMap[transaction.txNonce] ? (
          <div className="w-full">
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              variant="outline"
              className="w-full block h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
            >
              Revert
            </Button>
          </div>
        ) : (
          <Dialog open={showActionConfirmMap[transaction.txNonce]} onOpenChange={(open) => handleShowActionConfirm(transaction.txNonce, open)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  <Alert className="bg-red-100/10 border-red-300/40">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <AlertTitle className="text-red-400 font-semibold">Revert Transaction?</AlertTitle>
                  </Alert>
                </DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Are you sure you want to revert this transaction?
              </DialogDescription>
              <DialogFooter className="flex gap-2">
                <Button
                  className="flex-1 bg-red-400 hover:bg-red-500 text-white font-semibold"
                  onClick={() => handleRevert(transaction)}
                >
                  Confirm Revert
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-300/40 text-red-400"
                  onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                >
                  Keep Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      case 'RecvAddrConfirmed':
        return (
          <div className="flex gap-2">
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              variant="outline"
              className={`flex-1 h-10 text-white transition-all duration-200 ${
                'bg-transparent border-red-500/20 text-white hover:bg-red-500/10'
              } text-xs font-medium`}
            >
              Revert
            </Button>
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
            >
              Confirm
            </Button>
            {/* Overlay for Confirm */}
            {showActionConfirmMap[transaction.txNonce] && (
              <div className="mt-4 w-full bg-[#1a2628] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-[#7EDFCD]" />
                  <span className="text-white text-base">Receiver confirmed</span>
                </div>
                <div className="text-white text-sm break-all mb-4 ml-7">{transaction.receiverAddress}</div>
                <div className="flex gap-2 w-full">
                  <Button
                    className="flex-1 bg-[#7EDFCD] hover:bg-[#7EDFCD]/90 text-black rounded-md"
                    onClick={() => handleConfirm(transaction)}
                  >
                    Submit Transaction
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-[#7EDFCD] text-[#7EDFCD] bg-transparent rounded-md"
                    onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                  >
                    Keep Transaction
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        return (
          <>
            <div className="flex gap-4 w-full mb-4">
              <Button
                onClick={() => {
                  handleShowActionConfirm(transaction.txNonce, false);
                  handleShowActionConfirm(`revert-${transaction.txNonce}`, !showActionConfirmMap[`revert-${transaction.txNonce}`]);
                }}
                variant="outline"
                className="flex-1 h-10 text-white transition-all duration-200 bg-transparent border-red-500/20 hover:bg-red-500/10 text-xs font-medium"
              >
                Revert
              </Button>
              <Button
                onClick={() => {
                  handleShowActionConfirm(`revert-${transaction.txNonce}`, false);
                  handleShowActionConfirm(transaction.txNonce, !showActionConfirmMap[transaction.txNonce]);
                }}
                className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
              >
                Confirm
              </Button>
            </div>
            {showActionConfirmMap[transaction.txNonce] && (
              <div className="w-full mt-2 pt-5 space-y-3 bg-[#1a2628] border-white/10 rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">Receiver address confirmed</span>
                  </div>
                  <p className="font-mono text-xs text-white break-all">{transaction.receiverAddress}</p>
                </div>
                <Button
                  className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 transition-all duration-200"
                  onClick={() => handleConfirm(transaction)}
                >
                  Submit Transaction
                </Button>
              </div>
            )}
            {showActionConfirmMap[`revert-${transaction.txNonce}`] && (
              <div className="w-full mt-2 p-3 space-y-3 bg-[#1a2628] border-white/10 rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-400">You are safely reverting the transaction</span>
                  </div>
                </div>
                <Button
                  className="w-full h-10 bg-red-500 text-white hover:bg-red-600 transition-all duration-200"
                  onClick={() => handleRevert(transaction)}
                >
                  Revert Transaction
                </Button>
              </div>
            )}
          </>
        );
      case 'SenderConfirmed':
        return (
          <div className="space-y-2">
            <Button
              className="w-full h-10 bg-[#4A5853]/20 text-[#7EDFCD] hover:bg-[#4A5853]/30 text-xs"
              disabled
            >
              Processing...
            </Button>
          </div>
        );
      case 'SenderConfirmationfailed':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              variant="outline"
              className="w-full h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
            >
              Cancel Transaction
            </Button>
            {showActionConfirmMap[transaction.txNonce] && (
              <Alert className="mt-4 bg-[#1a2628] border-white/10 rounded-xl shadow flex flex-col items-start p-6 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="text-red-400 text-base">Cancel Transaction?</span>
                </div>
                <div className="text-sm text-red-300 break-all mb-6 ml-7">{transaction.receiverAddress}</div>
                <div className="flex gap-2 w-full">
                  <Button
                    className="flex-1 bg-red-400 hover:bg-red-500 text-white rounded-md"
                    onClick={() => handleRevert(transaction)}
                  >
                    Confirm Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300/40 text-red-400 bg-transparent rounded-md"
                    onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                  >
                    Keep Transaction
                  </Button>
                </div>
              </Alert>
            )}
          </div>
        );
      case 'FailedToSubmitTxn':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleComplete(transaction)}
              className="w-full h-10 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/20 text-xs"
            >
              Transaction Submitted
            </Button>
          </div>
        );
      case 'TxSubmissionPassed':
        const txKey = String(transaction.txNonce || transaction.receiverAddress);
        const shouldShowSuccess = showSuccessComponents.has(txKey);
        
        if (!shouldShowSuccess) {
          return (
            <div className="space-y-2">
              <Button
                className="w-full h-10 bg-[#4A5853]/20 text-[#7EDFCD] hover:bg-[#4A5853]/30 text-xs"
                disabled
              >
                Processing...
              </Button>
            </div>
          );
        }
        
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleComplete(transaction)}
              className="w-full h-10 bg-[#4A5853]/20 text-[#7EDFCD] hover:bg-[#4A5853]/30 text-xs"
            >
              Completed
            </Button>
          </div>
        );
      case 'ReceiverNotRegistered':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
              variant="outline"
              className="w-full h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
            >
              Revert
            </Button>
            {showActionConfirmMap[transaction.txNonce] && (
              <Alert className="mt-4 bg-[#1a2628] border-white/10 rounded-xl shadow flex flex-col items-start p-6 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="text-red-400 text-base">Revert Transaction?</span>
                </div>
                <div className="text-sm text-red-300 break-all mb-6 ml-7">{transaction.receiverAddress}</div>
                <div className="flex gap-2 w-full">
                  <Button
                    className="flex-1 bg-red-400 hover:bg-red-500 text-white rounded-md"
                    onClick={() => handleRevert(transaction)}
                  >
                    Confirm Revert
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300/40 text-red-400 bg-transparent rounded-md"
                    onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                  >
                    Keep Transaction
                  </Button>
                </div>
              </Alert>
            )}
          </div>
        );
      case 'Reverted':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleComplete(transaction)}
              className="w-full h-10 bg-[#4A5853]/20 text-[#7EDFCD] hover:bg-[#4A5853]/30 text-xs"
            >
              Transaction Reverted
            </Button>
          </div>
        );
      default:
        return !showActionConfirmMap[transaction.txNonce] ? (
          <Button
            onClick={() => handleShowActionConfirm(transaction.txNonce, true)}
            variant="outline"
            className={`flex-1 h-10 text-white transition-all duration-200 ${
              'bg-transparent border-red-500/20 text-white hover:bg-red-500/10'
            } text-xs font-medium`}
          >
            Revert
          </Button>
        ) : (
          <Alert className="mt-4 bg-[#1a2628] border-white/10 rounded-xl shadow flex flex-col items-start p-6 w-full">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-red-400 text-base">Revert Transaction?</span>
            </div>
            <div className="text-sm text-red-300 break-all mb-6 ml-7">{transaction.receiverAddress}</div>
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1 bg-red-400 hover:bg-red-500 text-white rounded-md"
                onClick={() => handleRevert(transaction)}
              >
                Confirm Revert
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-300/40 text-red-400 bg-transparent rounded-md"
                onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
              >
                Keep Transaction
              </Button>
            </div>
          </Alert>
        );
    }
  };

  // Helper to get status colors and messages
  const getStatusInfo = (statusType: string) => {
    switch (statusType) {
      case 'TxSubmissionPassed':
        return {
          color: 'text-green-400 border-green-400',
          iconColor: 'text-green-400',
          message: 'Transaction completed successfully'
        };
      case 'Reverted':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Transaction reverted'
        };
      case 'RecvAddrFailed':
      case 'SenderConfirmationfailed':
      case 'FailedToSubmitTxn':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Transaction failed'
        };
      case 'FailedToSubmitTxn':
        return {
          color: 'text-blue-400 border-blue-400',
          iconColor: 'text-blue-400',
          message: 'Transaction successfully submitted'
        };
      case 'ReceiverNotRegistered':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Transaction failed'
        };
      case 'SenderConfirmed':
        return {
          color: 'text-blue-400 border-blue-400',
          iconColor: 'text-blue-400',
          message: 'Processing transaction...'
        };
      case 'RecvAddrConfirmed':
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        return {
          color: 'text-green-400 border-green-400',
          iconColor: 'text-green-400',
          message: 'Ready for confirmation'
        };
      default:
        return {
          color: 'text-[#FFA500] border-[#FFA500]',
          iconColor: 'text-[#FFA500]',
          message: 'Waiting for receiver confirmation..'
        };
    }
  };

  // Helper to toggle cancel confirmation for a card
  const handleShowCancelConfirm = (idx: number, show: boolean) => {
    setShowCancelConfirmArr(prev => {
      const arr = [...prev];
      arr[idx] = show;
      return arr;
    });
  };

  // State to track if we should show initiated transactions
  const [showInitiatedTransactions, setShowInitiatedTransactions] = useState(true);

  // Listen for the removeAllInitiatedTx event
  useEffect(() => {
    const handleRemoveAllInitiated = () => {
      setShowInitiatedTransactions(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('removeAllInitiatedTx', handleRemoveAllInitiated);
      return () => {
        window.removeEventListener('removeAllInitiatedTx', handleRemoveAllInitiated);
      };
    }
  }, []);

  // Reset showInitiatedTransactions when new initiatedTransactions are added
  useEffect(() => {
    if (initiatedTransactions.length > 0) {
      setShowInitiatedTransactions(true);
    }
  }, [initiatedTransactions.length]);

  // Filter out initiated transactions that already exist in the real transactions list
  const pendingInitiatedTransactions = showInitiatedTransactions ? initiatedTransactions.filter(initiatedTx => 
    !senderPendingTransactions?.some(realTx => 
      realTx.receiverAddress === initiatedTx.receiverAddress &&
      realTx.amount.toString() === initiatedTx.amount.toString()
    )
  ) : [];

  // Don't render anything if no real transactions exist and no initiated transactions to show
  if ((!senderPendingTransactions || senderPendingTransactions.length === 0) && pendingInitiatedTransactions.length === 0) {
    return null;
  }

  // Handler to remove an initiated transaction
  const handleCancelInitiated = (indexToRemove: number) => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('removeInitiatedTx', { detail: { index: indexToRemove } }));
    }
  };

  return (
    <div className="space-y-3">
      {/* Render all pending initiated transactions that don't exist in real list yet */}
      {pendingInitiatedTransactions.map((initiatedTx, index) => {
        const statusInfo = getStatusInfo('Genesis'); // Default status for initiated transactions
        return (
          <Card key={`initiated-${index}`} className="bg-[#1a2628] border-white/10 flex flex-col justify-between h-full">
            <CardContent className="p-3 space-y-3 flex flex-col h-full justify-between">
              <div className="space-y-3">
                {/* Sender Address Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">From address</span>
                  <p className="font-mono text-xs text-white break-all bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">{initiatedTx.senderAddress}</p>
                </div>
                
                {/* Receiver Address Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">To address</span>
                  <p className="font-mono text-xs text-white break-all bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">{initiatedTx.receiverAddress}</p>
                </div>
                
                {/* Codeword Row with Timer and Refresh Button */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Codeword</span>
                    <p className="font-mono text-xs text-white bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20 mt-1">{initiatedTx.codeWord}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <TxTimer txKey={getTxKey(initiatedTx)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      className="h-8 w-8 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10 transition-transform"
                      disabled={isRefreshing}
                      aria-label="Refresh"
                    >
                      <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                {/* Networks Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Sender Network</span>
                    <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                      <span className="text-xs text-white font-medium">{initiatedTx.senderAddressNetwork || ''}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Receiver Network</span>
                    <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                      <span className="text-xs text-white font-medium">Ethereum</span>
                    </div>
                  </div>
                </div>
                
                {/* Amount Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">Amount</span>
                  <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                    <span className="text-sm text-white font-semibold">{initiatedTx.amount.toString()} {initiatedTx.token.toString()}</span>
                  </div>
                </div>
              </div>
              {/* Status */}
              <div className={`flex items-center gap-2 ${statusInfo.color} border border-${statusInfo.iconColor} rounded-lg px-2 py-1 mt-2`}>
                <AlertCircle className={`h-4 w-4 ${statusInfo.iconColor}`} />
                <span className="text-xs">{statusInfo.message}</span>
              </div>
              {/* Cancel Button at the bottom */}
              <div className="mt-4 flex flex-col items-center">
                {!showCancelConfirmArr[index] ? (
                  <Button
                    className="w-full h-10 bg-red-500/80 text-white hover:bg-red-500 transition-all duration-200 border border-red-500/20"
                    onClick={() => handleShowCancelConfirm(index, true)}
                  >
                    Cancel
                  </Button>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center animate-zoom-in p-4 bg-gradient-to-b from-red-500/10 to-red-600/5 border border-red-500/30 rounded-lg backdrop-blur-sm transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-white text-sm font-medium">Cancel Transaction?</span>
                    </div>
                
                    <div className="w-full flex gap-2">
                      <Button
                        className="flex-1 h-10 bg-red-500 text-white hover:bg-red-600 transition-all duration-200 font-medium shadow-lg"
                        onClick={() => handleCancelInitiated(index)}
                      >
                        Confirm Cancel
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 bg-transparent border-[#4A5853]/40 text-[#9EB2AD] hover:bg-[#4A5853]/20 hover:text-white transition-all duration-200"
                        onClick={() => handleShowCancelConfirm(index, false)}
                      >
                        Keep Transaction
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Render all real transactions */}
      {senderPendingTransactions?.map((transaction) => {
        const txKey = String(transaction.txNonce || transaction.receiverAddress);
        const statusType = typeof transaction.status === 'string' ? transaction.status : transaction.status?.type || '';
        const statusInfo = getStatusInfo(statusType);
        return (
          <Card key={txKey} className="bg-[#1a2628] border-white/10 relative">
            <CardContent className="p-3 space-y-3">
              {/* Transaction Details */}
              <div className="space-y-3">
                {/* Sender Address Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">From address</span>
                  <p className="font-mono text-xs text-white break-all bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">{transaction.senderAddress}</p>
                </div>
                
                {/* Receiver Address Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">To address</span>
                  <p className="font-mono text-xs text-white break-all bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">{transaction.receiverAddress}</p>
                </div>
                
                {/* Codeword Row with Timer and Refresh Button */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Codeword</span>
                    <p className="font-mono text-xs text-white bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20 mt-1">{transaction.codeWord}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {statusType !== 'TxSubmissionPassed' && <TxTimer txKey={getTxKey(transaction)} />}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      className="h-8 w-8 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10 transition-transform"
                      disabled={isRefreshing}
                      aria-label="Refresh"
                    >
                      <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                {/* Networks Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Sender Network</span>
                    <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                      <span className="text-xs text-white font-medium">{transaction.senderAddressNetwork || ''}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Receiver Network</span>
                    <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                      <span className="text-xs text-white font-medium">Ethereum</span>
                    </div>
                  </div>
                </div>
                
                {/* Amount Row */}
                <div className="space-y-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">Amount</span>
                  <div className="bg-[#0D1B1B] px-2 py-1 rounded border border-[#4A5853]/20">
                    <span className="text-sm text-white font-semibold">{transaction.amount.toString()} {transaction.token.toString()}</span>
                  </div>
                </div>
              </div>

              {/* Status with Refresh Button */}
              {['RecvAddrConfirmationPassed', 'NetConfirmed'].includes(statusType) ? (
                <div className="flex items-center gap-2 text-green-400 border border-green-400 rounded-lg px-2 py-1 mt-2">
                  <AlertCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm">Receiver confirmed</span>
                </div>
              ) : (
                <div className={`flex items-center gap-2 ${statusInfo.color} border border-${statusInfo.iconColor} rounded-lg px-2 py-1 mt-2`}>
                  <AlertCircle className={`h-4 w-4 ${statusInfo.iconColor}`} />
                  <span className="text-sm">{statusInfo.message}</span>
                </div>
              )}
              {/* Dynamic Action Buttons */}
              <div className="w-full mt-4">
                {renderActionButtons(transaction)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  )
}
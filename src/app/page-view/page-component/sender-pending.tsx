"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore"
import { ChainSupported, Token, TokenManager, TxStateMachine, TxStateMachineManager, TxStatus } from '@/lib/vane_lib/main'
import { bytesToHex, hexToBytes } from 'viem';
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { useSignMessagePhantomRedirect } from "@/app/lib/signUniversal"

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


export const getTokenLabel = (token: Token): string => {
  if ('Ethereum' in token) {
    const ethereumVariant = token.Ethereum;
    if (typeof ethereumVariant === 'string') {
      if (ethereumVariant === 'ETH') return 'ETH';
    } else if ('ERC20' in ethereumVariant) {
      return ethereumVariant.ERC20.name;
    }
  }

  if ('Bnb' in token) {
    const bnbVariant = token.Bnb; 
    if (typeof bnbVariant === 'string') {
      if (bnbVariant === 'BNB') return 'BNB';
    } else if ('BEP20' in bnbVariant) {
      return bnbVariant.BEP20.name;
    }
  }

  if ('Polkadot' in token) {
    const polkadotVariant = token.Polkadot; 
    if (typeof polkadotVariant === 'string') {
      if (polkadotVariant === 'DOT') return 'DOT';
    } else if ('Asset' in polkadotVariant) {
      return polkadotVariant.Asset.name;
    }
  }

  if ('Solana' in token) {
    const solanaVariant = token.Solana; 
    if (typeof solanaVariant === 'string') {
      if (solanaVariant === 'SOL') return 'SOL';
    } else if ('SPL' in solanaVariant) {
      return solanaVariant.SPL.name;
    }
  }

  if ('Tron' in token) {
    const tronVariant = token.Tron; 
    if (typeof tronVariant === 'string') {
      if (tronVariant === 'TRX') return 'TRX';
    } else if ('TRC20' in tronVariant) {
      return tronVariant.TRC20.name;
    }
  }

  if ('Optimism' in token) {
    const optimismVariant = token.Optimism; 
    if (typeof optimismVariant === 'string') {
      if (optimismVariant === 'ETH') return 'ETH';
    } else if ('ERC20' in optimismVariant) {
      return optimismVariant.ERC20.name;
    }
  }

  if ('Arbitrum' in token) {
    const arbitrumVariant = token.Arbitrum; 
    if (typeof arbitrumVariant === 'string') {
      if (arbitrumVariant === 'ETH') return 'ETH';
    } else if ('ERC20' in arbitrumVariant) {
      return arbitrumVariant.ERC20.name;
    }
  }

  if ('Polygon' in token) {
    const polygonVariant = token.Polygon; 
    if (typeof polygonVariant === 'string') {
      if (polygonVariant === 'POL') return 'POL';
    } else if ('ERC20' in polygonVariant) {
      return polygonVariant.ERC20.name;
    }
  }

  if ('Base' in token) {
    const baseVariant = token.Base; 
    if (typeof baseVariant === 'string') {
      if (baseVariant === 'ETH') return 'ETH';
    } else if ('ERC20' in baseVariant) {
      return baseVariant.ERC20.name;
    }
  }

  if ('Bitcoin' in token) {
    const bitcoinVariant = token.Bitcoin; 
    if (bitcoinVariant === 'BTC') return 'BTC';
  }
};

export default function SenderPending() {
 
  const formatStatus = (status: string): string => {
    if (!status) return 'Unknown';
    
    // Convert camelCase to readable format
    return status
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim(); // Remove leading/trailing spaces
  };
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelConfirmArr, setShowCancelConfirmArr] = useState<boolean[]>([]);
  const [showActionConfirmMap, setShowActionConfirmMap] = useState<Record<string, boolean>>({});
  const [showSuccessComponents, setShowSuccessComponents] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const removeTransaction = useTransactionStore(state => state.removeTransaction)
  const fetchPendingUpdates = useTransactionStore(state => state.fetchPendingUpdates)
  // const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const senderConfirmTransaction = useTransactionStore(state => state.senderConfirmTransaction)
  const exportStorageData = useTransactionStore(state => state.exportStorageData)
  const revertTransaction = useTransactionStore(state => state.revertTransaction)
  const isWasmInitialized = useTransactionStore(state => state.isWasmInitialized)

  const { execute, signature, errorCode, errorMessage } = useSignMessagePhantomRedirect();


  // Effect to fetch transactions on mount
  useEffect(() => {
    if(!isWasmInitialized()) return;
    const fetchTransactions = async () => {
      setIsLoadingTransactions(true);
      try {
        await fetchPendingUpdates();
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to load pending transactions');
      } finally {
        setIsLoadingTransactions(false);
      }
    };
    
    fetchTransactions();
  }, [isWasmInitialized, fetchPendingUpdates]);



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
      await execute(bytesToHex(transaction.callPayload![0]))
      if(errorCode || errorMessage){
        toast.error(`Failed to sign transaction: ${errorMessage}`);
        return;
      }
      if(!signature) return;

      const txManager = new TxStateMachineManager(transaction);
      const hex = typeof signature === "string" ? (signature as `0x${string}`) : (bytesToHex(signature) as `0x${string}`);

      console.log(`signature:${hex}`)
      txManager.setSignedCallPayload(hexToBytes(hex));
      const updatedTransaction = txManager.getTx();

      await senderConfirmTransaction(updatedTransaction)
      
      // Remove the old transaction and add the success transaction
      removeTransaction(transaction.txNonce);
      
      // submit metrics
      exportStorageData().then((storage) => {
        if(storage.user_account?.multi_addr){
          fetch("/api/submit-metrics", {
            method: "POST",
            body: JSON.stringify(storage),
          })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch(error => console.error(error));
        }
      })

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
    
    try {
      // Call fetchPendingUpdates to get latest data
      await fetchPendingUpdates()
      toast.success('Transactions refreshed')
    } catch (error) {
      console.error('Error refreshing transactions:', error)
      toast.error('Failed to refresh transactions')
    } finally {
      setIsRefreshing(false)
    }
  }

  // WASM is initialized in transfer-form.tsx when wallet connects

  const handleShowActionConfirm = (txKey: string, show: boolean) => {
    setShowActionConfirmMap(prev => ({ ...prev, [txKey]: show }));
  };

  const toggleCardExpansion = (txKey: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txKey)) {
        newSet.delete(txKey);
      } else {
        newSet.add(txKey);
      }
      return newSet;
    });
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
          <div className="w-full flex gap-2">
            <Button
              className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-xs"
              onClick={() => handleRevert(transaction)}
            >
              Confirm Revert
            </Button>
            <Button
              className="flex-1 h-10 bg-[#1a2628] text-white hover:bg-[#2a3638] text-xs"
              onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
            >
              Keep Transaction
            </Button>
          </div>
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
          <div className="w-full flex gap-2">
            <Button
              className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-xs"
              onClick={() => handleRevert(transaction)}
            >
              Confirm Revert
            </Button>
            <Button
              className="flex-1 h-10 bg-[#1a2628] text-white hover:bg-[#2a3638] text-xs"
              onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
            >
              Keep Transaction
            </Button>
          </div>
        );
      case 'RecvAddrConfirmed':
        return (
          <div className="flex gap-2">
            <Button
              onClick={() => handleRevert(transaction)}
              variant="outline"
              className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleConfirm(transaction)}
              className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
            >
              Confirm
            </Button>
          </div>
        );
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        return (
          <div className="flex gap-2">
            <Button
              onClick={() => handleRevert(transaction)}
              variant="outline"
              className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleConfirm(transaction)}
              className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
            >
              Confirm
            </Button>
          </div>
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
              <div className="mt-2 flex gap-2">
                <Button
                  className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-xs"
                  onClick={() => handleRevert(transaction)}
                >
                  Confirm Cancel
                </Button>
                <Button
                  className="flex-1 h-10 bg-[#1a2628] text-white hover:bg-[#2a3638] text-xs"
                  onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
                >
                  Keep Transaction
                </Button>
              </div>
            )}
          </div>
        );
      case 'FailedToSubmitTxn':
        return (
          <div className="w-full">
            <Button
              onClick={() => handleComplete(transaction)}
              variant="outline"
              className="w-full h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
            >
              Cancel
            </Button>
          </div>
        );
      case 'TxSubmissionPassed':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleComplete(transaction)}
              className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
            >
              Completed
            </Button>
          </div>
        );
      case 'ReceiverNotRegistered':
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
          <div className="w-full flex gap-2">
            <Button
              className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-xs"
              onClick={() => handleRevert(transaction)}
            >
              Confirm Revert
            </Button>
            <Button
              className="flex-1 h-10 bg-[#1a2628] text-white hover:bg-[#2a3638] text-xs"
              onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
            >
              Keep Transaction
            </Button>
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
          <div className="w-full flex gap-2">
            <Button
              className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-xs"
              onClick={() => handleRevert(transaction)}
            >
              Confirm Revert
            </Button>
            <Button
              className="flex-1 h-10 bg-[#1a2628] text-white hover:bg-[#2a3638] text-xs"
              onClick={() => handleShowActionConfirm(transaction.txNonce, false)}
            >
              Keep Transaction
            </Button>
          </div>
        );
    }
  };

  // Helper to get status colors and messages
  const getStatusInfo = (statusType: string, transaction?: TxStateMachine) => {
    switch (statusType) {
      case 'Genesis':
        return {
          color: 'text-[#FFA500] border-[#FFA500]',
          iconColor: 'text-[#FFA500]',
          message: 'Waiting for receiver confirmation'
        };
      case 'ReceiverNotRegistered':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Receiver not registered to vane'
        };
      case 'RecvAddrFailed':
      case 'SenderConfirmationfailed':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Receiver confirmation failed, please revert'
        };
      case 'RecvAddrConfirmed':
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        return {
          color: 'text-green-400 border-green-400',
          iconColor: 'text-green-400',
          message: 'Receiver confirmation passed, make sure you did communicate'
        };
      case 'TxSubmissionPassed':
        if (transaction?.status?.type === 'TxSubmissionPassed') {
        const txHash = transaction?.status?.data?.hash ? 
          `0x${Array.from(transaction.status.data.hash).map((b: number) => b.toString(16).padStart(2, '0')).join('')}` : 
          'N/A';
          const truncatedHash = txHash.length > 20 ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : txHash;
          return {
            color: 'text-green-400 border-green-400',
            iconColor: 'text-green-400',
            message: `Transaction passed: ${truncatedHash}`,
            fullHash: txHash
          };
        }
      case 'Reverted':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Transaction cancelled'
        };
      case 'TxError':
        if (transaction?.status?.type === 'TxError') {
          const errorData = transaction?.status?.data || 'Unknown error';
          return {
            color: 'text-red-400 border-red-400',
            iconColor: 'text-red-400',
            message: `Unexpected transaction error: ${errorData}`
          };
        }
      case 'FailedToSubmitTxn':
        if (transaction?.status?.type === 'FailedToSubmitTxn') {
          const errorData = transaction?.status?.data || 'Transaction failed to submit';
          return {
            color: 'text-red-400 border-red-400',
            iconColor: 'text-red-400',
            message: `Transaction submission failed: ${errorData}`
          };
        }
      default:
        return {
          color: 'text-[#FFA500] border-[#FFA500]',
          iconColor: 'text-[#FFA500]',
          message: 'Waiting for receiver confirmation'
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


  // Listen for the removeAllInitiatedTx event
  useEffect(() => {
    const handleRemoveAllInitiated = () => {
      // Clear all initiated transactions from store
      useTransactionStore.getState().clearAllTransactions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('removeAllInitiatedTx', handleRemoveAllInitiated);
      return () => {
        window.removeEventListener('removeAllInitiatedTx', handleRemoveAllInitiated);
      };
    }
  }, []);

  // Show loading state while fetching transactions
  if (isLoadingTransactions) {
    return (
      <div className="pt-2 px-2 space-y-3 pb-24">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-2 text-[#9EB2AD]">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Make a transaction to view pending outgoing</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pt-2 space-y-3 pb-24">
      {/* Header with Refresh */}
      <div className="flex justify-end">
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          className="h-8 px-3 bg-transparent border border-[#4A5853]/40 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/50"
          aria-label="Refresh pending transactions"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {(!senderPendingTransactions || senderPendingTransactions.length === 0) ? (
        <>
          <div className="">
            <Card className="w-full bg-[#0D1B1B] border-[#4A5853]/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-center gap-2 text-[#9EB2AD]">
                  <span className="text-sm">No pending updates — initiate a transaction</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Render all real transactions */}
      {senderPendingTransactions?.filter((transaction) => {
        // Check if status is an object with 'Reverted' property
        const isReverted = transaction.status && typeof transaction.status === 'object' && 'Reverted' in transaction.status;
        // Don't display reverted transactions
        if (isReverted) return false;
        
        // Show all non-reverted transactions
        return true;
      }).map((transaction) => {
        const txKey = String(transaction.txNonce);
        const statusType = typeof transaction.status === 'string' ? transaction.status : transaction.status?.type || '';
        const statusInfo = getStatusInfo(statusType, transaction);
        const isExpanded = expandedCards.has(txKey);
        
        return (
          <Card key={txKey} className="w-full bg-[#0D1B1B] border-r-2 border-white/10 relative">
            <CardContent className="p-3">
              {/* Collapsed View - Always visible */}
              <div className="space-y-2">
                {/* Sender Address */}
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Sender Address</span>
                  <p className="font-sans text-xs text-white break-all">{transaction.senderAddress}</p>
                </div>
                
                {/* Receiver Address */}
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Receiver Address</span>
                  <p className="font-sans text-xs text-white break-all">{transaction.receiverAddress}</p>
                </div>
                
                {/* Networks Row */}
                <div className="flex justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Sender Network</span>
                    <p className="text-xs text-white font-medium">{transaction.senderAddressNetwork}</p>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-[#9EB2AD] font-medium">Receiver Network</span>
                    <p className="text-xs text-white font-medium">{transaction.receiverAddressNetwork}</p>
                  </div>
                </div>
                
                {/* Status Alert */}
                <div className={`flex items-center gap-2 ${statusInfo.color} border rounded-lg px-2 mt-10 py-2`}>
                  <AlertCircle className={`h-4 w-4 ${statusInfo.iconColor}`} />
                  {statusType === 'TxSubmissionPassed' && statusInfo.fullHash ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">Transaction passed:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(statusInfo.fullHash);
                          toast.success('Transaction hash copied to clipboard');
                        }}
                        className="text-xs font-mono hover:bg-green-400/20 px-1 py-0.5 rounded transition-colors cursor-pointer"
                        title="Click to copy full hash"
                      >
                        {statusInfo.message.split(': ')[1]}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs">{statusInfo.message}</span>
                  )}
                </div>
 
                 {/* Expand/Collapse Button */}
                 <div className="mt-2 flex items-center justify-center">
                   <Button
                     onClick={() => toggleCardExpansion(txKey)}
                     variant="ghost"
                     className="w-full h-8 text-[#7EDFCD] hover:bg-[#1a2628]"
                     aria-label={isExpanded ? 'Collapse' : 'Expand'}
                   >
                     {isExpanded ? (
                       <>
                         <ChevronUp className="h-4 w-4 mr-1" /> Collapse
                       </>
                     ) : (
                       <>
                         <ChevronDown className="h-4 w-4 mr-1" /> Expand
                       </>
                     )}
                   </Button>
                 </div>
                  {/* Gradient Separator */}
                  <div className="relative h-[3px] mt-6 mb-3">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4A5853]/20 to-transparent" />
                  </div>
            
                 {isExpanded && (
                   <div className="mt-3 space-y-3 relative">
                     {/* Amount and Asset */}
                     <div className="flex justify-between gap-3">
                       <div className="flex-1">
                         <span className="text-xs text-[#9EB2AD] font-medium">Amount</span>
                         <p className="text-sm text-white font-semibold">
                           {transaction.amount}
                         </p>
                       </div>
                       <div className="flex-1">
                         <span className="text-xs text-[#9EB2AD] font-medium">Asset</span>
                         <p className="text-sm text-white font-medium">
                           {getTokenLabel((transaction as TxStateMachine).token)}
                         </p>
                       </div>
                     </div>
                     
                     {/* Fees and Codeword */}
                     <div className="flex justify-between gap-3">
                       <div className="flex-1">
                         <span className="text-xs text-[#9EB2AD] font-medium">Fees</span>
                         <p className="text-sm text-white">
                          {transaction.feesAmount}
                         </p>
                       </div>
                       <div className="flex-1">
                         <span className="text-xs text-[#9EB2AD] font-medium">Codeword</span>
                         <p className="font-sans text-xs text-white mt-1">{transaction.codeWord}</p>
                       </div>
                     </div>
 
                     {/* Dynamic Action Buttons */}
                     <div className="w-full mt-4">
                       {renderActionButtons(transaction)}
                     </div>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        );
      })}
        </>
      )}
    </div>
  )
}
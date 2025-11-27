"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect} from "react"
import { useDynamicContext, WalletConnector} from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore"
import { ChainSupported, getTokenDecimals, Token, TxStateMachine, TxStateMachineManager} from '@/lib/vane_lib/main'
import { bytesToHex, formatEther, hexToBytes } from 'viem';
import bs58 from 'bs58';
import {
  isPhantomRedirectConnector,
  SignTransactionListener,
} from '@dynamic-labs/wallet-connector-core';


import { toast } from "sonner"

import { isSolanaWallet } from '@dynamic-labs/solana';
import { isEthereumWallet } from "@dynamic-labs/ethereum"

import {
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { usePhantomSignTransaction } from "./phantomSigning"


// Skeleton loading component
const TransactionSkeleton = () => (
  <Card className="w-full bg-[#0D1B1B] border-r-2 border-white/10 relative animate-pulse">
    <CardContent className="p-3">
      <div className="space-y-3">
        {/* Sender Address Skeleton */}
        <div>
          <div className="h-3 w-20 bg-gray-600 rounded mb-1"></div>
          <div className="h-4 w-full bg-gray-600 rounded"></div>
        </div>
        
        {/* Receiver Address Skeleton */}
        <div>
          <div className="h-3 w-24 bg-gray-600 rounded mb-1"></div>
          <div className="h-4 w-full bg-gray-600 rounded"></div>
        </div>
        
        {/* Networks Skeleton */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="h-3 w-16 bg-gray-600 rounded mb-1"></div>
            <div className="h-4 w-20 bg-gray-600 rounded"></div>
          </div>
          <div>
            <div className="h-3 w-16 bg-gray-600 rounded mb-1"></div>
            <div className="h-4 w-20 bg-gray-600 rounded"></div>
          </div>
        </div>
        
        {/* Status Skeleton */}
        <div className="h-8 w-full bg-gray-600 rounded"></div>
        
        {/* Expand Button Skeleton */}
        <div className="flex justify-center">
          <div className="h-6 w-16 bg-gray-600 rounded"></div>
        </div>
      </div>
    </CardContent>
  </Card>
);

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

 // Helper function to get token decimals
 export function formatAmount(amount: bigint, token: Token): number {
  const decimals = getTokenDecimals(token);
  if (!decimals) return 0;
  return Number(amount) / Math.pow(10, decimals);
};

// localStorage helpers for submission pending tracking
const getSubmissionPending = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('SubmissionPending');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setSubmissionPending = (txNonce: string, isPending: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getSubmissionPending();
    if (isPending) {
      current[txNonce] = true;
    } else {
      delete current[txNonce];
    }
    localStorage.setItem('SubmissionPending', JSON.stringify(current));
  } catch {}
};

const clearAllSubmissionPending = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('SubmissionPending');
  } catch {}
};

const isSubmissionPending = (txNonce: string): boolean => {
  return getSubmissionPending()[txNonce] === true;
};

export default function SenderPending() {

  // const { execute, errorCode, errorMessage, tx } = usePhantomSignTransaction();


  // ----------------------------------------------------------------- //
 
 
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [showActionConfirmMap, setShowActionConfirmMap] = useState<Record<string, boolean>>({});
  const [showSuccessComponents, setShowSuccessComponents] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());


  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [communicationConfirmed, setCommunicationConfirmed] = useState<Record<string, boolean>>({});
  const [submissionPending, setSubmissionPendingState] = useState<Record<string, boolean>>({});
  const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const removeTransaction = useTransactionStore(state => state.removeTransaction)
  const fetchPendingUpdates = useTransactionStore(state => state.fetchPendingUpdates)
  // const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const senderConfirmTransaction = useTransactionStore(state => state.senderConfirmTransaction)
  const revertTransaction = useTransactionStore(state => state.revertTransaction)
  const isWasmInitialized = useTransactionStore(state => state.isWasmInitialized)
  const nodeConnectionStatus = useTransactionStore(state => state.nodeConnectionStatus)

  const { primaryWallet } = useDynamicContext();


  // Initialize submission pending state from localStorage on mount
  useEffect(() => {
    setSubmissionPendingState(getSubmissionPending());
  }, []);

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



  // Effect to clear localStorage when status changes to FailedToSubmitTxn or TxSubmissionPassed
  useEffect(() => {
    senderPendingTransactions.forEach(transaction => {
      const statusType = typeof transaction.status === 'string' ? transaction.status : transaction.status?.type || '';
      const txNonce = String(transaction.txNonce);
      if (statusType === 'FailedToSubmitTxn' || statusType === 'TxSubmissionPassed') {
        setSubmissionPending(txNonce, false);
        setSubmissionPendingState(prev => {
          const next = { ...prev };
          delete next[txNonce];
          return next;
        });
      }
    });
  }, [senderPendingTransactions]);

  // Effect to clear all submission pending when node disconnects
  useEffect(() => {
    if (nodeConnectionStatus && !nodeConnectionStatus.relay_connected) {
      clearAllSubmissionPending();
      setSubmissionPendingState({});
    }
  }, [nodeConnectionStatus]);

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


  const handleRevert = async (transaction:TxStateMachine) => {
    console.log('transaction', transaction);
    await revertTransaction(transaction, "User requested revert");
    removeTransaction(transaction);
    toast.info(`Transaction to ${transaction.receiverAddress} Reverted Safely`);
  }


  const clearSubmissionPendingFlag = (txNonce: string) => {
    setSubmissionPending(txNonce, false);
    setSubmissionPendingState(prev => {
      const next = { ...prev };
      delete next[txNonce];
      return next;
    });
  };

  const handleConfirm = async(transaction:TxStateMachine) => {
      // Save txNonce to localStorage to track submission pending state
      const txNonce = String(transaction.txNonce);
      setSubmissionPending(txNonce, true);
      setSubmissionPendingState(prev => ({ ...prev, [txNonce]: true }));
      const handleFailure = (message?: string) => {
        if (message) {
          toast.error(message);
        }
        clearSubmissionPendingFlag(txNonce);
        setShowActionConfirmMap(prev => ({ ...prev, [txNonce]: true }));
      };
      
      // Handle confirm logic
      // sign the transaction payload & update the transaction state
      
      // Check if callPayload exists and has data
      const callPayload = ("ethereum" in transaction.callPayload) ? transaction.callPayload.ethereum.callPayload[0]
      : ("solana" in transaction.callPayload) ? transaction.callPayload.solana.callPayload 
      : ("bnb" in transaction.callPayload) ? transaction.callPayload.bnb.callPayload[0] : null;
      
      if (!callPayload) {
        return handleFailure('Transaction payload is missing. Please try again.');
      }

      const txManager = new TxStateMachineManager(transaction);

      if (transaction.senderAddressNetwork === ChainSupported.Solana) {

        if (isSolanaWallet(primaryWallet)) {
          const signer = await primaryWallet.getSigner();

          const conn = await primaryWallet.getConnection();
          const latesBlockHeight = await conn.getBlockHeight("finalized");

          let versionSolTx: VersionedTransaction;
          try {
               versionSolTx = new VersionedTransaction(VersionedMessage.deserialize(Uint8Array.from(callPayload)));

          } catch (error) {
            console.error('Error building Solana transaction:', error);
            return handleFailure('Failed to build Solana transaction.');
          }

          let txSignature: number[];
          try {

            const isRedirectWallet = isPhantomRedirectConnector(primaryWallet?.connector);

            if(isRedirectWallet){
              // await execute(versionSolTx);
              // toast.success("Signed tx: " + tx);
              toast.info("Please use another wallet for now (not Phantom)");

            } else{
              const signedTx = await signer.signTransaction(versionSolTx as any);
               txManager.setCallPayload({solana: {callPayload: Array.from(signedTx.message.serialize()), latestBlockHeight: latesBlockHeight}});
               txSignature = Array.from(signedTx.signatures[0]);
            }

          } catch (error) {
            console.error('Error signing Solana transaction:', error);
            return handleFailure('Failed to sign Solana transaction.');
          }
          txManager.setSignedCallPayload(txSignature);

        } else {
          return handleFailure('Please use a Solana wallet to confirm this transaction');
        }

      } else if(
        transaction.senderAddressNetwork === ChainSupported.Ethereum ||
        transaction.senderAddressNetwork === ChainSupported.Base ||
        transaction.senderAddressNetwork === ChainSupported.Polygon ||
        transaction.senderAddressNetwork === ChainSupported.Optimism ||
        transaction.senderAddressNetwork === ChainSupported.Arbitrum ||
        transaction.senderAddressNetwork === ChainSupported.Bnb
      ){

        if (isEthereumWallet(primaryWallet)) {
          const signer = await primaryWallet.getWalletClient();
          const txFields =
            "ethereum" in transaction.callPayload
              ? transaction.callPayload.ethereum.ethUnsignedTxFields
              : "bnb" in transaction.callPayload
                ? transaction.callPayload.bnb.bnbLegacyTxFields
                : null;
          if (!txFields) {
            return handleFailure('Invalid transaction fields');
          }

          const receipt = (await signer.sendTransactionSync(txFields as any));
          if (receipt.status === 'success') {

            const txHash = receipt.transactionHash;
            const signedCallPayload = hexToBytes(txHash as `0x${string}`);
            txManager.setSignedCallPayload(Array.from(signedCallPayload));
            txManager.setTxSubmissionPassed(Array.from(hexToBytes(txHash as `0x${string}`)));
            const feesAmount = Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
            txManager.setFeesAmount(feesAmount);

          } else {

            const signedCallPayload = hexToBytes(receipt.transactionHash as `0x${string}`);
            txManager.setSignedCallPayload(Array.from(signedCallPayload));
            txManager.setTxSubmissionFailed('Transaction failed to submit');
            toast.error('Transaction failed to submit');

          }
          
        } else {
          return handleFailure('Please use an EVM wallet to confirm this transaction');
        }

      }else{
        return handleFailure('Unsupported chain');
      }
      
      const updatedTransaction = txManager.getTx();
      console.log('updatedTransaction', updatedTransaction);
      try {
        await senderConfirmTransaction(updatedTransaction)
      } catch (error) {
        console.error('Error confirming transaction:', error);
        return handleFailure('Failed to submit transaction. Please cancel or retry.');
      }
          
  }

  const handleComplete = (transaction: TxStateMachine) => {
    // Remove the transaction from the store
    removeTransaction(transaction)
  }


  const handleRefresh = async () => {
    setIsRefreshing(true)
    setShowSkeleton(true)
    
    try {
      
      // Show skeleton for 1 second minimum
      await Promise.all([
        fetchPendingUpdates(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ])
      
      toast.success('Transactions refreshed')
    } catch (error) {
      console.error('Error refreshing transactions:', error)
      toast.error('Failed to refresh transactions')
    } finally {
      setIsRefreshing(false)
      setShowSkeleton(false)
    }
  }

  // WASM is initialized in transfer-form.tsx when wallet connects

  const handleShowActionConfirm = (txKey: string, show: boolean) => {
    setShowActionConfirmMap(prev => ({ ...prev, [txKey]: show }));
  };

  const handleCommunicationConfirm = (txKey: string) => {
    console.log('handleCommunicationConfirm called with txKey:', txKey);
    setCommunicationConfirmed(prev => {
      const newState = { ...prev, [txKey]: true };
      console.log('Updated communicationConfirmed state:', newState);
      return newState;
    });
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
        const txKey = String(transaction.txNonce);
        const isCommunicationConfirmed = communicationConfirmed[txKey];
        
        console.log('RecvAddrConfirmed case - txKey:', txKey, 'isCommunicationConfirmed:', isCommunicationConfirmed);
        
        if (!isCommunicationConfirmed) {
          return (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-400 font-medium mb-2">
                  ⚠️ Important: Before confirming this transaction
                </p>
                <p className="text-xs text-yellow-300">
                  Did you communicate with the intended receiver and confirm they received your message?
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRevert(transaction)}
                  variant="outline"
                  className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCommunicationConfirm(txKey)}
                  className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
                >
                  Yes, Next
                </Button>
              </div>
            </div>
          );
        }
        
        const isSubmitting = submissionPending[txKey] === true;
        
        return (
          <div className="space-y-3">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-400 font-medium">
                ✅ Communication confirmed. Ready to submit transaction.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleRevert(transaction)}
                variant="outline"
                className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleConfirm(transaction)}
                className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Transaction'
                )}
              </Button>
            </div>
          </div>
        );
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        const txKey2 = String(transaction.txNonce);
        const isCommunicationConfirmed2 = communicationConfirmed[txKey2];
        
        
        if (!isCommunicationConfirmed2) {
          return (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-400 font-medium mb-2">
                  ⚠️ Important: Before confirming this transaction
                </p>
                <p className="text-xs text-yellow-300">
                  Did you communicate with the intended receiver and confirm they received your message?
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRevert(transaction)}
                  variant="outline"
                  className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCommunicationConfirm(txKey2)}
                  className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
                >
                  Yes, Next
                </Button>
              </div>
            </div>
          );
        }
        
        const isSubmitting2 = submissionPending[txKey2] === true;
        
        return (
          <div className="space-y-3">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-400 font-medium">
                Communication confirmed. Ready to submit transaction.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleRevert(transaction)}
                variant="outline"
                className="flex-1 h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
                disabled={isSubmitting2}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleConfirm(transaction)}
                className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
                disabled={isSubmitting2}
              >
                {isSubmitting2 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Transaction'
                )}
              </Button>
            </div>
          </div>
        );
      case 'SenderConfirmed':
        return (
          <div className="space-y-2">
            <Button
              className="w-full h-10 bg-[#4A5853]/20 text-[#7EDFCD] hover:bg-[#4A5853]/30 text-xs"
              disabled
            >
              Wait for completion
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
      case 'TxError':
        return (
          <div className="space-y-2">
            <Button
              onClick={() => handleRevert(transaction)}
              variant="outline"
              className="w-full h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium"
            >
              Cancel Transaction
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
    console.log('statusType', statusType);
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
          message: 'Receiver not using Vane yet'
        };
      case 'RecvAddrFailed':
        return {
          color: 'text-red-400 border-red-400',
          iconColor: 'text-red-400',
          message: 'Receiver confirmation failed, please revert'
        };
      case 'SenderConfirmationfailed':
        return {
          color: 'text-red-400 border-red-400 bg-transparent',
          iconColor: 'text-red-400',
          message: 'Sender confirmation failed, please check your account choice'
        };
      case 'RecvAddrConfirmed':
      case 'RecvAddrConfirmationPassed':
      case 'NetConfirmed':
        return {
          color: 'text-green-400 border-green-400',
          iconColor: 'text-green-400',
          message: 'Receiver confirmation passed'
        };
      case 'SenderConfirmed':
        return {
          color: 'text-green-400 border-green-400',
          iconColor: 'text-green-400',
          message: 'Transaction confirmed, processing...'
        };
      case 'TxSubmissionPassed':
        if (transaction?.status?.type === 'TxSubmissionPassed') {
          const txHash = transaction?.status?.data?.hash ? 
          bytesToHex(Uint8Array.from(transaction.status.data.hash)) : 
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
            message: `${errorData}`
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
          className={`h-8 px-3 bg-transparent border border-[#4A5853]/40 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/50 ${isRefreshing ? 'animate-pulse' : ''}`}
          aria-label="Refresh pending transactions"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {showSkeleton ? (
        <>
          {/* Show skeleton loading animation */}
          {[...Array(2)].map((_, index) => (
            <TransactionSkeleton key={`skeleton-${index}`} />
          ))}
        </>
      ) : (() => {
        return (!senderPendingTransactions || senderPendingTransactions.length === 0);
      })() ? (
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
      {senderPendingTransactions?.filter((transaction, index, self) => {
        // Remove duplicates based on txNonce
        const isDuplicate = self.findIndex(t => t.txNonce === transaction.txNonce) !== index;
        if (isDuplicate) return false;
        
        // Check if status is an object with 'Reverted' property
        const isReverted = transaction.status && typeof transaction.status === 'object' && 'Reverted' in transaction.status;
        // Don't display reverted transactions
        if (isReverted) return false;
        
        // Show all non-reverted transactions
        return true;
      }).map((transaction) => {
        const txKey = String(transaction.txNonce);
        const statusType = transaction.status?.type || '';
        
        
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
                           {formatAmount(transaction.amount, transaction.token)} 
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
                          {transaction.feesAmount.toFixed(6)}
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



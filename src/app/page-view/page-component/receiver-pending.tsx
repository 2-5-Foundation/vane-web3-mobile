"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { bytesToHex, hexToBytes } from "viem"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore";
import { TxStateMachine, TxStateMachineManager } from '@/lib/vane_lib/main';
import { toast } from "sonner";
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getTokenLabel} from "./sender-pending";
import { useSignMessagePhantomRedirect } from "@/app/lib/signUniversal";

export default function ReceiverPending() {
  const { primaryWallet } = useDynamicContext()
  const { recvTransactions, receiverConfirmTransaction, isWasmInitialized, fetchPendingUpdates } = useTransactionStore()
  const { execute, signature, errorCode, errorMessage } = useSignMessagePhantomRedirect();

  // console.log('ReceiverPending - recvTransactions:', recvTransactions);
  const [approvedTransactions, setApprovedTransactions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [remainingByTx, setRemainingByTx] = useState<Record<string, number>>({});
  const [expiryByTx, setExpiryByTx] = useState<Record<string, number>>({});
  const INITIAL_SECONDS = 9 * 60 + 50; // 9:50
  const STORAGE_PREFIX = 'recvTimer:';

  // Helper functions for localStorage timer management
  const getExpiryFromStorage = (txNonce: string): number | null => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_PREFIX + txNonce) : null;
      if (!raw) return null;
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const setExpiryInStorage = (txNonce: string, expiryMs: number) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(STORAGE_PREFIX + txNonce, String(expiryMs));
    } catch {
      console.error('Error setting expiry in storage');
    }
  };

  // Only display transactions that haven't expired or have been approved
  const visibleTransactions = useMemo(() => {
    if (!recvTransactions) return [];
    return recvTransactions.filter((tx) => {
      const txNonce = String(tx.txNonce);
      const isApproved = approvedTransactions.has(txNonce);
      const remaining = remainingByTx[txNonce] ?? INITIAL_SECONDS;
      const isExpired = remaining === 0;
      return isApproved || !isExpired;
    });
  }, [recvTransactions, approvedTransactions, remainingByTx, INITIAL_SECONDS]);


  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPendingUpdates();
      toast.success('Transactions refreshed');
    } catch (e) {
      console.error('Error refreshing transactions:', e);
      toast.error('Failed to refresh transactions');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initialize timers for new transactions using txNonce as key
  useEffect(() => {
    if (!recvTransactions) return;
    
    setExpiryByTx(prev => {
      const next: Record<string, number> = { ...prev };
      for (const tx of recvTransactions) {
        const txNonce = String(tx.txNonce);
        if (!next[txNonce]) {
          let expiry = getExpiryFromStorage(txNonce);
          if (!expiry) {
            // Only set expiry if it doesn't exist (new transaction)
            expiry = Date.now() + INITIAL_SECONDS * 1000;
            setExpiryInStorage(txNonce, expiry);
          }
          next[txNonce] = expiry;
        }
      }
      return next;
    });

    setRemainingByTx(prev => {
      const next: Record<string, number> = { ...prev };
      for (const tx of recvTransactions) {
        const txNonce = String(tx.txNonce);
        if (!next[txNonce]) {
          const stored = getExpiryFromStorage(txNonce);
          const expiry = stored ?? (Date.now() + INITIAL_SECONDS * 1000);
          const baseRemaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
          next[txNonce] = Math.max(0, baseRemaining);
        }
      }
      return next;
    });
  }, [recvTransactions, INITIAL_SECONDS]);

  // Tick down once per second
  useEffect(() => {
    const id = setInterval(() => {
      setRemainingByTx(prev => {
        const next: Record<string, number> = {};
        const now = Date.now();
        
        Object.keys(prev).forEach(txNonce => {
          const expiry = expiryByTx[txNonce] ?? getExpiryFromStorage(txNonce);
          if (!expiry) {
            next[txNonce] = INITIAL_SECONDS; // fallback
          } else {
            next[txNonce] = Math.max(0, Math.floor((expiry - now) / 1000));
          }
        });
        
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiryByTx, INITIAL_SECONDS]);
  
  const handleApprove = async (transaction: TxStateMachine) => {
    try {
      if (!isWasmInitialized()) {
        toast.error('Connection not initialized. Please refresh the page.');
        return;
      }

      if (!primaryWallet) {
        toast.error('Please connect your wallet first');
        return;
      }

      await execute(transaction.receiverAddress);
      if(errorCode || errorMessage){
        toast.error(`Failed to sign transaction: ${errorMessage}`);
        return;
      }
      if(!signature) return;

      const hex = typeof signature === "string" ? (signature as `0x${string}`) : (bytesToHex(signature) as `0x${string}`);
      const txManager = new TxStateMachineManager(transaction);
      txManager.setReceiverSignature(hexToBytes(hex));
      const updatedTx = txManager.getTx();
      await receiverConfirmTransaction(updatedTx);
      
      // Mark this transaction as approved
      setApprovedTransactions(prev => new Set(prev).add(String(transaction.txNonce)));
      
      toast.success('Transaction confirmed successfully');
      
    } catch (error) {
      console.error('Error approving transaction:', error);
      toast.error(`Failed to confirm transaction: ${error}`);
    }
  }

  // Show connection status if not connected
  if (!isWasmInitialized()) {
    return (
      <div className="space-y-3">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-2 text-[#9EB2AD]">
              <WifiOff className="text-[#7EDFCD] h-4 w-4" />
              <span className="text-sm">Connecting to receive updates...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state when no pending transactions
  if (!visibleTransactions || visibleTransactions.length === 0) {
    return (
      <div className="space-y-3 pb-24">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Connected and listening</span>
              </div>
              <p className="text-[#9EB2AD] text-sm inline-flex items-center gap-1 whitespace-nowrap">
                <span>No pending transactions found •</span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center px-2 py-0.5 text-[#7EDFCD] border border-[#4A5853]/40 rounded hover:text-[#7EDFCD]/80 hover:border-[#7EDFCD]/60 focus:outline-none focus:ring-1 focus:ring-[#7EDFCD]/60 disabled:text-gray-500 disabled:border-gray-600"
                  aria-label="Refresh pending transactions"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRefresh();
                    }
                  }}
                >
                  Try refreshing
                </button>
              </p>
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

      {/* Pending Transactions */}
      {visibleTransactions.map((transaction) => (
        <Card key={transaction.txNonce} className="bg-[#0D1B1B] border-[#4A5853]/20 relative">
          <CardContent className="p-3 space-y-3 flex flex-col h-full justify-between">            
            
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
              
              {/* Amount and Asset Row */}
              <div className="flex justify-between gap-3">
                <div className="flex-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">Amount</span>
                  <p className="text-sm text-white font-semibold">{transaction.amount}</p>
                </div>
                <div className="flex-1">
                  <span className="text-xs text-[#9EB2AD] font-medium">Asset</span>
                  <p className="text-sm text-white font-medium">{getTokenLabel((transaction as TxStateMachine).token)}</p>
                </div>
              </div>
              
              {/* Codeword */}
              <div>
                <span className="text-xs text-[#9EB2AD] font-medium">Codeword</span>
                <p className="font-sans text-xs text-white mt-1">{transaction.codeWord}</p>
              </div>
              {/* Status Row */}
              <div className={`flex items-center gap-2 border rounded-lg px-2 mt-10 py-2 ${
                approvedTransactions.has(String(transaction.txNonce))
                  ? 'text-green-400 border-green-400'
                  : ((remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) === 0 ? 'text-red-400 border-red-400' : 'text-[#FFA500] border-[#FFA500]')
              }`}>
                {approvedTransactions.has(String(transaction.txNonce)) ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className={`h-4 w-4 ${((remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) === 0) ? 'text-red-400' : 'text-[#FFA500]'}`} />
                )}
                <span className="text-xs">
                  {approvedTransactions.has(String(transaction.txNonce))
                    ? 'Confirmed, waiting for sender\'s approval'
                    : ((remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) === 0 ? 'Request expired' : 'Waiting for your confirmation…')
                  }
                </span>
              </div>
            </div>
            {/* Confirm Button at the bottom - only show if not approved */}
            {!approvedTransactions.has(String(transaction.txNonce)) && (
              <div className="mt-4 flex flex-col items-center">
                <Button
                  onClick={() => handleApprove(transaction)}
                  disabled={!isWasmInitialized() || !primaryWallet || (remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) === 0}
                  className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium disabled:bg-gray-500 disabled:text-gray-300"
                >
                  {!isWasmInitialized() ? 'Connecting...' :
                   !primaryWallet ? 'Connect Wallet' :
                   ((remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) === 0 ? 'Expired' : 'Confirm')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
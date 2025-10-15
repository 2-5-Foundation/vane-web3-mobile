"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { hexToBytes } from "viem"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore";
import { TxStateMachine, TxStateMachineManager } from '@/lib/vane_lib/main';
import { toast } from "sonner";
import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ReceiverPending() {
  const { primaryWallet } = useDynamicContext()
  const { recvTransactions, receiverConfirmTransaction, isWasmInitialized } = useTransactionStore()
  
  // Use store transactions
  const displayTransactions = recvTransactions;
  
  console.log('ReceiverPending - recvTransactions:', recvTransactions);
  console.log('ReceiverPending - displayTransactions:', displayTransactions);
  const [approvedTransactions, setApprovedTransactions] = useState<Set<string>>(new Set());
  const [remainingByTx, setRemainingByTx] = useState<Record<string, number>>({});
  const [expiryByTx, setExpiryByTx] = useState<Record<string, number>>({});
  const INITIAL_SECONDS = 9 * 60 + 50; // 9:50
  const STORAGE_PREFIX = 'recvTimer:';

  const getExpiryFromStorage = (key: string): number | null => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_PREFIX + key) : null;
      if (!raw) return null;
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const setExpiryInStorage = (key: string, expiryMs: number) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(STORAGE_PREFIX + key, String(expiryMs));
    } catch {
      /* ignore */
    }
  };

  // Initialize timers for any new transactions (persist using localStorage expiry timestamps)
  useEffect(() => {
    if (!displayTransactions) return;
    setExpiryByTx(prev => {
      const next: Record<string, number> = { ...prev };
      for (const tx of displayTransactions) {
        const key = String(tx.txNonce);
        let expiry = getExpiryFromStorage(key);
        if (!expiry) {
          expiry = Date.now() + INITIAL_SECONDS * 1000;
          setExpiryInStorage(key, expiry);
        }
        next[key] = expiry;
      }
      return next;
    });

    setRemainingByTx(prev => {
      const next: Record<string, number> = { ...prev };
      for (const tx of displayTransactions) {
        const key = String(tx.txNonce);
        const stored = getExpiryFromStorage(key);
        const expiry = stored ?? (Date.now() + INITIAL_SECONDS * 1000);
        const baseRemaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        // If this tx existed before (has stored expiry), subtract 5s to compensate for refresh gap
        next[key] = Math.max(0, baseRemaining - (stored ? 5 : 0));
      }
      return next;
    });
  }, [displayTransactions, INITIAL_SECONDS]);

  // Tick down once per second
  useEffect(() => {
    const id = setInterval(() => {
      setRemainingByTx(prev => {
        const next: Record<string, number> = {};
        const keys = new Set<string>([
          ...Object.keys(prev),
          ...Object.keys(expiryByTx)
        ]);
        const now = Date.now();
        keys.forEach(key => {
          const expiry = expiryByTx[key] ?? getExpiryFromStorage(key);
          if (!expiry) {
            next[key] = INITIAL_SECONDS; // fallback
          } else {
            next[key] = Math.max(0, Math.floor((expiry - now) / 1000));
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiryByTx, INITIAL_SECONDS]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper function to convert wei to ETH (decimal format)
  const formatAmount = (amount: any): string => {
    if (!amount) return '0';
    
    let amountValue: bigint | number;
    
    if (typeof amount === 'bigint') {
      amountValue = amount;
    } else if (typeof amount === 'number') {
      amountValue = BigInt(Math.floor(amount));
    } else if (typeof amount === 'string') {
      amountValue = BigInt(amount);
    } else {
      return '0';
    }
    
    // Convert wei to ETH (divide by 10^18)
    const ethValue = Number(amountValue) / Math.pow(10, 18);
    
    // Format to remove unnecessary trailing zeros
    return ethValue.toString().replace(/\.?0+$/, '');
  };

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

      const signature = await primaryWallet.signMessage(transaction.receiverAddress);
      const txManager = new TxStateMachineManager(transaction);
      txManager.setReceiverSignature(hexToBytes(signature as `0x${string}`));
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
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm">Connecting to receive updates...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state when no pending transactions
  if (!displayTransactions || displayTransactions.length === 0) {
    return (
      <div className="space-y-3">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Connected and listening</span>
              </div>
              <p className="text-[#9EB2AD] text-sm">No pending transactions found • Try refreshing</p>
              </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isWasmInitialized() ? (
            <div className="flex items-center gap-1 text-green-400">
              <Wifi className="h-3 w-3" />
              <span className="text-xs">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-400">
              <WifiOff className="h-3 w-3" />
              <span className="text-xs">Connecting...</span>
            </div>
          )}
        </div>
        <span className="text-xs text-[#9EB2AD]">
          {displayTransactions.length} pending
        </span>
      </div>

      {/* Pending Transactions */}
      {displayTransactions.map((transaction) => (
        <Card key={transaction.txNonce} className="bg-[#0D1B1B] border-[#4A5853]/20 relative">
          <CardContent className="p-3 space-y-3 flex flex-col h-full justify-between">
            {/* Timer in top right corner */}
            <div className="absolute top-3 right-3">
              <div className={`px-2 py-0.5 rounded text-xs font-medium ${ (remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) > 0 ? 'text-[#7EDFCD] bg-[#7EDFCD]/10' : 'text-red-400 bg-red-500/10' }`}>
                {(remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) > 0 ?
                  formatTime(remainingByTx[String(transaction.txNonce)] ?? INITIAL_SECONDS) :
                  'Expired'}
              </div>
            </div>
            
            <div className="space-y-2">
              {/* Sender Address */}
              <div>
                <span className="text-xs text-[#9EB2AD] font-medium">Sender Address</span>
                <p className="font-mono text-xs text-white break-all">{transaction.senderAddress}</p>
              </div>
              
              {/* Receiver Address */}
              <div>
                <span className="text-xs text-[#9EB2AD] font-medium">Receiver Address</span>
                <p className="font-mono text-xs text-white break-all">{transaction.receiverAddress}</p>
              </div>
              
              {/* Networks Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Sender Network</span>
                  <p className="text-xs text-white font-medium">{transaction.senderAddressNetwork || 'Ethereum'}</p>
                </div>
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Receiver Network</span>
                  <p className="text-xs text-white font-medium">{transaction.receiverAddressNetwork || 'Ethereum'}</p>
                </div>
              </div>
              
              {/* Amount and Asset Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Amount</span>
                  <p className="text-sm text-white font-semibold">{formatAmount(transaction.amount)}</p>
                </div>
                <div>
                  <span className="text-xs text-[#9EB2AD] font-medium">Asset</span>
                  <p className="text-sm text-white font-semibold">ETH</p>
                </div>
              </div>
              
              {/* Codeword */}
              <div>
                <span className="text-xs text-[#9EB2AD] font-medium">Codeword</span>
                <p className="font-mono text-xs text-white mt-1">{transaction.codeWord}</p>
              </div>
              {/* Status Row */}
              <div className={`flex items-center gap-2 border rounded-lg px-2 py-1 mt-2 ${
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
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

// Skeleton loading component
const TransactionSkeleton = () => (
  <Card className="bg-[#0D1B1B] border-[#4A5853]/20 relative animate-pulse">
    <CardContent className="p-3 space-y-3 flex flex-col h-full justify-between">
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
        
        {/* Amount and Token Skeleton */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="h-3 w-12 bg-gray-600 rounded mb-1"></div>
            <div className="h-4 w-16 bg-gray-600 rounded"></div>
          </div>
          <div>
            <div className="h-3 w-8 bg-gray-600 rounded mb-1"></div>
            <div className="h-4 w-12 bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
      
      {/* Action Button Skeleton */}
      <div className="mt-4">
        <div className="h-10 w-full bg-gray-600 rounded"></div>
      </div>
    </CardContent>
  </Card>
);

export default function ReceiverPending() {
  const { primaryWallet } = useDynamicContext()
  const { recvTransactions, receiverConfirmTransaction, isWasmInitialized, fetchPendingUpdates } = useTransactionStore()

  // console.log('ReceiverPending - recvTransactions:', recvTransactions);
  const [approvedTransactions, setApprovedTransactions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);




  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowSkeleton(true);
    
    try {
      // Show skeleton for 1 second minimum
      await Promise.all([
        fetchPendingUpdates(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      console.log('recvTransactions', recvTransactions);
      toast.success('Transactions refreshed');
    } catch (e) {
      console.error('Error refreshing transactions:', e);
      toast.error('Failed to refresh transactions');
    } finally {
      setIsRefreshing(false);
      setShowSkeleton(false);
    }
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
      
      // Handle different signature formats from different wallets
      let signatureBytes: Uint8Array;
      if (typeof signature === 'string') {
        if (signature.startsWith('0x')) {
          // Standard hex format (Phantom)
          signatureBytes = hexToBytes(signature as `0x${string}`);
        } else {
          // Base64 or other format (MetaMask)
          try {
            // Try to decode as base64
            const decoded = atob(signature);
            signatureBytes = new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
          } catch {
            // If base64 fails, try to convert string to bytes directly
            signatureBytes = new TextEncoder().encode(signature);
          }
        }
      } else {
        // Already a Uint8Array
        signatureBytes = signature;
      }
      
      // Validate signature length - should be reasonable for any signature type
      if (signatureBytes.length < 32 || signatureBytes.length > 128) {
        toast.error(`Invalid signature format. Signature length: ${signatureBytes.length} bytes`);
        return;
      }
      
      txManager.setReceiverSignature(signatureBytes);
      const updatedTx = txManager.getTx();
      console.log('updatedTx signed by receiver', updatedTx.recvSignature);
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
  if (!recvTransactions || recvTransactions.length === 0) {
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
          className={`h-8 px-3 bg-transparent border border-[#4A5853]/40 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/50 ${isRefreshing ? 'animate-pulse' : ''}`}
          aria-label="Refresh pending transactions"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Pending Transactions */}
      {showSkeleton ? (
        <>
          {/* Show skeleton loading animation */}
          {[...Array(2)].map((_, index) => (
            <TransactionSkeleton key={`skeleton-${index}`} />
          ))}
        </>
      ) : recvTransactions.map((transaction, index) => (
        <Card key={`${transaction.txNonce}-${index}`} className="bg-[#0D1B1B] border-[#4A5853]/20 relative">
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
                  : 'text-[#FFA500] border-[#FFA500]'
              }`}>
                {approvedTransactions.has(String(transaction.txNonce)) ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#FFA500]" />
                )}
                <span className="text-xs">
                  {approvedTransactions.has(String(transaction.txNonce))
                    ? 'Confirmed, waiting for sender\'s approval'
                    : 'Waiting for your confirmation…'
                  }
                </span>
              </div>
            </div>
            {/* Confirm Button at the bottom - only show if not approved */}
            {!approvedTransactions.has(String(transaction.txNonce)) && (
              <div className="mt-4 flex flex-col items-center">
                <Button
                  onClick={() => handleApprove(transaction)}
                  disabled={!isWasmInitialized() || !primaryWallet}
                  className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium disabled:bg-gray-500 disabled:text-gray-300"
                >
                  {!isWasmInitialized() ? 'Connecting...' :
                   !primaryWallet ? 'Connect Wallet' :
                   'Confirm'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { hexToBytes } from "viem"
import { useDynamicContext, useTokenBalances } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { useTransactionStore } from "@/app/lib/useStore";
import { TxStateMachine, TxStateMachineManager, Token, ChainSupported } from '@/lib/vane_lib/main';
import { toast } from "sonner";
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { formatAmount, getTokenLabel} from "./sender-pending";
import bs58 from 'bs58';

import {usePhantomSignTransaction} from "./phantomSigning"
import {
  isPhantomRedirectConnector,
} from '@dynamic-labs/wallet-connector-core';


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
  const { tokenBalances } = useTokenBalances({
    includeFiat: true,
    includeNativeBalance: true
  });
  const userProfile = useTransactionStore((s) => s.userProfile);
  const { signMessage, errorCode, errorMessage, tx, signedMessage, messageErrorCode, messageErrorMessage } = usePhantomSignTransaction();

  // console.log('ReceiverPending - recvTransactions:', recvTransactions);
  const [approvedTransactions, setApprovedTransactions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [pendingTxNonce, setPendingTxNonce] = useState<string | null>(null);
  const phantomSignatureRef = useRef<string | undefined>(undefined);
  const phantomSignatureErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    phantomSignatureRef.current = signedMessage;
  }, [signedMessage]);

  useEffect(() => {
    phantomSignatureErrorRef.current = messageErrorMessage || messageErrorCode;
  }, [messageErrorCode, messageErrorMessage]);

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    return (
      window.innerWidth <= 768 ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    );
  }, []);

  const waitForPhantomSignature = async () => {
    const timeoutMs = 20000;
    const pollMs = 250;
    const startTime = Date.now();

    return new Promise<string>((resolve, reject) => {
      const checkSignature = () => {
        if (phantomSignatureErrorRef.current) {
          const errorMessage = phantomSignatureErrorRef.current;
          phantomSignatureErrorRef.current = undefined;
          reject(new Error(errorMessage || 'Failed to get signature from wallet'));
          return;
        }

        if (phantomSignatureRef.current) {
          const signature = phantomSignatureRef.current;
          phantomSignatureRef.current = undefined;
          resolve(signature);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          reject(new Error('Timed out waiting for Phantom signature'));
          return;
        }

        setTimeout(checkSignature, pollMs);
      };

      checkSignature();
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowSkeleton(true);
    
    try {
      // Show skeleton for 1 second minimum
      await Promise.all([
        fetchPendingUpdates(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
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
    if (!isWasmInitialized()) {
      toast.error('Connection not initialized. Please refresh the page.');
      return;
    }

    if (!primaryWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    const currentTxNonce = String(transaction.txNonce);
    setPendingTxNonce(currentTxNonce);

    try {

      // Check if this is an EVM chain transaction
      const isEVMChain = transaction.receiverAddressNetwork === ChainSupported.Ethereum ||
                        transaction.receiverAddressNetwork === ChainSupported.Bnb ||
                        transaction.receiverAddressNetwork === ChainSupported.Base ||
                        transaction.receiverAddressNetwork === ChainSupported.Optimism ||
                        transaction.receiverAddressNetwork === ChainSupported.Arbitrum ||
                        transaction.receiverAddressNetwork === ChainSupported.Polygon;
      
      const isSolanaChain = transaction.receiverAddressNetwork === ChainSupported.Solana;
      const isPhantomRedirect = isPhantomRedirectConnector(primaryWallet?.connector);
      
      // Check if wallet is Coinbase - Coinbase doesn't apply EIP-191 prefix automatically
      const isCoinbaseWallet = primaryWallet?.connector?.name?.toLowerCase().includes('coinbase') || 
                               primaryWallet?.connector?.metadata?.name?.toLowerCase().includes('coinbase');

      // For EVM chains, use primaryWallet.signMessage() directly - it handles EIP-191 formatting automatically
      // Exception: Coinbase wallet doesn't apply EIP-191 prefix, so we need to manually prefix the message
      // For Solana, use signer's signMessage to get proper 64-byte signature
      let signature: string | Uint8Array;
      
      if (isEVMChain && isEthereumWallet(primaryWallet)) {
        if (isCoinbaseWallet) {
          // Coinbase wallet doesn't apply EIP-191 prefix with primaryWallet.signMessage()
          // Use wallet client's signMessage which properly handles EIP-191 formatting
          try {
            const walletClient = await primaryWallet.getWalletClient();
            const account = walletClient.account;
            if (!account) {
              toast.error('Wallet account not available');
              return;
            }
            const result = await walletClient.signMessage({
              account,
              message: transaction.receiverAddress,
            });
            if (typeof result === 'string') {
              signature = result;
            } else if (result && typeof result === 'object' && 'signature' in result) {
              signature = (result as { signature: string }).signature;
            } else {
              signature = result as string | Uint8Array;
            }
          } catch (error) {
            // Check if user rejected the request
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (
              typeof errorMessage === 'string' &&
              (errorMessage.toLowerCase().includes('user rejected') ||
               errorMessage.toLowerCase().includes('user denied') ||
               errorMessage.toLowerCase().includes('rejected the request'))
            ) {
              toast.error('Signature request was cancelled');
              return;
            }
            // Fallback to primaryWallet.signMessage if wallet client fails
            try {
              signature = await primaryWallet.signMessage(transaction.receiverAddress);
            } catch (fallbackError) {
              const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              if (
                typeof fallbackMessage === 'string' &&
                (fallbackMessage.toLowerCase().includes('user rejected') ||
                 fallbackMessage.toLowerCase().includes('user denied') ||
                 fallbackMessage.toLowerCase().includes('rejected the request'))
              ) {
                toast.error('Signature request was cancelled');
                return;
              }
              throw fallbackError;
            }
          }
        } else {
          signature = await primaryWallet.signMessage(transaction.receiverAddress);
        }
      } else if (isSolanaChain && isSolanaWallet(primaryWallet)) {
        try {
          const messageBytes = new TextEncoder().encode(transaction.receiverAddress);

          if (isPhantomRedirect) {
            await signMessage(messageBytes);
            signature = await waitForPhantomSignature();
          } else {
            const signer = await primaryWallet.getSigner();
            const signedMessageResult = await signer.signMessage(messageBytes);
            signature = signedMessageResult.signature;
          }
        } catch (error) {
          // Check if user rejected the request (will be caught by outer catch block)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            typeof errorMessage === 'string' &&
            (errorMessage.toLowerCase().includes('user rejected') ||
             errorMessage.toLowerCase().includes('user denied') ||
             errorMessage.toLowerCase().includes('rejected the request') ||
             errorMessage.toLowerCase().includes('cancelled'))
          ) {
            toast.error('Signature request was cancelled');
            return;
          }
          throw error;
        }
      } else {
        signature = await primaryWallet.signMessage(transaction.receiverAddress);
      }
      
      
      if (!signature) {
        toast.error('Failed to get signature from wallet');
        return;
      }

      if (typeof signature === 'string') {
        const looksLikeMpcSignature =
          signature.length > 300 ||
          signature.includes('.') ||
          signature.startsWith('{') ||
          signature.startsWith('eyJ'); // base64-encoded JSON

        if (looksLikeMpcSignature) {
          toast.error('Coinbase MPC signatures are not supported yet. Please use the in-app browser or another wallet.');
          return;
        }
      }

      const txManager = new TxStateMachineManager(transaction);
      
      // Convert signature to bytes
      const isUint8Array = (value: unknown): value is Uint8Array => {
        return value instanceof Uint8Array;
      };
      
      let signatureBytes: Uint8Array;
      
      if (typeof signature === 'string') {
        if (!signature || signature.length === 0) {
          toast.error('Invalid signature: empty string');
          return;
        }
        if (signature.startsWith('0x')) {
          // Hex format (EVM chains)
          signatureBytes = hexToBytes(signature as `0x${string}`);
        } else if (isSolanaChain) {
          // Solana signatures are typically base58 encoded
          try {
            signatureBytes = new Uint8Array(bs58.decode(signature));
          } catch {
            // If base58 decode fails, try as raw bytes
            signatureBytes = new TextEncoder().encode(signature);
          }
        } else {
          signatureBytes = new TextEncoder().encode(signature);
        }
      } else if (isUint8Array(signature)) {
        signatureBytes = signature;
      } else {
        toast.error('Invalid signature format from wallet');
        return;
      }
      
      if (!signatureBytes || signatureBytes.length === 0) {
        toast.error('Invalid signature: signature bytes are empty');
        return;
      }
      
      // Validate and normalize signature length
      if (isEVMChain && signatureBytes.length !== 65) {
        toast.error(`Invalid EVM signature length: expected 65 bytes, got ${signatureBytes.length}`);
        return;
      }
      
      if (isSolanaChain) {
        if (signatureBytes.length < 64) {
          toast.error(`Invalid Solana signature length: expected at least 64 bytes, got ${signatureBytes.length}`);
          return;
        }
        // Some wallets return extra bytes, take only the first 64 bytes
        if (signatureBytes.length > 64) {
          signatureBytes = signatureBytes.slice(0, 64);
        }
      }
      
      txManager.setReceiverSignature(Array.from(signatureBytes));
      const updatedTx = txManager.getTx();
      await receiverConfirmTransaction(updatedTx);
      
      // Mark this transaction as approved
      setApprovedTransactions(prev => new Set(prev).add(String(transaction.txNonce)));
      
      toast.success('Transaction confirmed successfully');
      
    } catch (error) {
      console.error('Error approving transaction:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';

      // Handle user rejection/cancellation
      if (
        typeof errorMessage === 'string' &&
        (errorMessage.toLowerCase().includes('user rejected') ||
         errorMessage.toLowerCase().includes('user denied') ||
         errorMessage.toLowerCase().includes('rejected the request') ||
         errorName === 'UserRejectedRequestError')
      ) {
        toast.error('Signature request was cancelled');
        return;
      }

      // Handle already pending signature request
      if (
        typeof errorMessage === 'string' &&
        errorMessage.toLowerCase().includes('already pending') &&
        errorMessage.toLowerCase().includes('personal_sign')
      ) {
        toast.error('A signature request is already open in your wallet. Please complete or cancel it before confirming again.');
      } else {
        toast.error(`Failed to confirm transaction: ${errorMessage}`);
      }
    } finally {
      setPendingTxNonce(prev => (prev === currentTxNonce ? null : prev));
    }
  }

  // Show empty state when no pending transactions
  if (!recvTransactions || recvTransactions.length === 0) {
    return (
      <div className="space-y-3 pb-24">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-6">
            <div className="text-center">

              <p className="text-[#9EB2AD] text-sm inline-flex items-center gap-1 whitespace-nowrap">
                <span>No incoming transactions found •</span>
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
          tabIndex={0}
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
                  <p className="text-sm text-white font-semibold">
                    {formatAmount(transaction.amount, transaction.token)}
                  </p>
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
                  disabled={!isWasmInitialized() || !primaryWallet || pendingTxNonce === String(transaction.txNonce)}
                  className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium disabled:bg-gray-500 disabled:text-gray-300"
                >
                  {!isWasmInitialized() ? 'Connecting...' :
                   !primaryWallet ? 'Connect Wallet' :
                   pendingTxNonce === String(transaction.txNonce) ? 'Confirming…' :
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
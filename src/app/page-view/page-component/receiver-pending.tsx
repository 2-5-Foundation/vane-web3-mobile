"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { hexToBytes } from "viem"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore";
import { TxStateMachine, TxStateMachineManager } from "vane_lib";
import { useInitializeWebSocket } from "@/app/lib/helper";
import { toast } from "sonner";
import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function ReceiverPending() {
  const { primaryWallet } = useDynamicContext()
  const vaneClient = useTransactionStore(state => state.vaneClient)
  const recvPendingTransactions = useTransactionStore(state => state.recvTransactions)
  const [approvedTransactions, setApprovedTransactions] = useState<Set<string>>(new Set());
  
  // Use the same WebSocket hook instead of calling watchPendingTxUpdates directly
  const { isConnected } = useInitializeWebSocket();

  const handleApprove = async (transaction: TxStateMachine) => {
    try {
      if (!isConnected || !vaneClient) {
        toast.error('Please refresh the page.');
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
      await vaneClient.receiverConfirm(updatedTx);
      
      // Mark this transaction as approved
      setApprovedTransactions(prev => new Set(prev).add(String(transaction.txNonce)));
      
      toast.success('Transaction confirmed successfully');
      
    } catch (error) {
      console.error('Error approving transaction:', error);
      toast.error(`Failed to confirm transaction: ${error}`);
    }
  }

  // Show connection status if not connected
  if (!isConnected) {
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
  if (!recvPendingTransactions || recvPendingTransactions.length === 0) {
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
          {isConnected ? (
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
          {recvPendingTransactions.length} pending
        </span>
      </div>

      {/* Pending Transactions */}
      {recvPendingTransactions.map((transaction) => (
        <Card key={transaction.txNonce} className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-3 space-y-3 flex flex-col h-full justify-between">
            <div>
              {/* Address Row */}
              <div>
                <span className="text-xs text-[#9EB2AD]">From address</span>
                <p className="font-mono text-xs text-white break-all">{transaction.senderAddress}</p>
              </div>
              {/* Codeword Row */}
              <div>
                <span className="text-xs text-[#9EB2AD]">Codeword</span>
                <p className="font-mono text-xs text-white">{transaction.codeword}</p>
              </div>
              {/* Network/Amount Row */}
              <div className="flex justify-between gap-4">
                <div>
                  <span className="text-xs text-[#9EB2AD]">Network</span>
                  <p className="text-xs text-white">{transaction.network}</p>
                </div>
                <div>
                  <span className="text-xs text-[#9EB2AD]">Amount</span>
                  <p className="text-xs text-white">{transaction.amount} {transaction.token}</p>
                </div>
              </div>
              {/* Status Row */}
              <div className={`flex items-center gap-2 border rounded-lg px-2 py-1 mt-2 ${
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
                  disabled={!isConnected || !primaryWallet}
                  className="w-full h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium disabled:bg-gray-500 disabled:text-gray-300"
                >
                  {!isConnected ? 'Connecting...' : 
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
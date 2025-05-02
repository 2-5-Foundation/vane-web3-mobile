"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore"
import { TxStateMachine, TxStateMachineManager } from "vane_lib"
import { bytesToHex, hexToBytes } from 'viem';
import { useInitializeWebSocket } from "@/app/lib/helper";
import { toast } from "sonner"

export default function SenderPending() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConfirmingRevert, setIsConfirmingRevert] = useState(false)
  const removeTransaction = useTransactionStore(state => state.removeTransaction)
  const senderPendingTransactions = useTransactionStore(state => state.senderPendingTransactions)
  const vaneClient = useTransactionStore(state => state.vaneClient)
  // ------------- Wallet ---------------------------------------
  const {primaryWallet}  = useDynamicContext()
  
  const statusConfig = {
    awaiting: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Waiting for receiver confirmation..",
      color: "text-[#FFA500]"
    },
    confirmed: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "Receiver confirmed successfully",
      color: "text-[#7EDFCD]"
    },
    failed: {
      icon: <XCircle className="h-4 w-4" />,
      text: "Receiver failed to confirm",
      color: "text-red-500"
    },
    successful: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "Transaction successful",
      color: "text-[#7EDFCD]"
    }
  }

  const handleRevert = async (transaction: TxStateMachine) => {
    if (!isConfirmingRevert) {
      setIsConfirmingRevert(true)
      await vaneClient?.revertTransaction(transaction)
      setTimeout(() => setIsConfirmingRevert(false), 5000)
      return
    }
    removeTransaction(transaction.txNonce)
    toast.info(`Transaction to ${transaction.receiverAddress} Reverted Safely`)

  }

  const handleConfirm = async(transaction: TxStateMachine) => {
    // Handle confirm logic
    // sign the transaction payload & update the transaction state
    const signature = await primaryWallet?.signMessage(bytesToHex(transaction.callPayload))
    const txManager = new TxStateMachineManager(transaction);
    txManager.setSignedCallPayload(hexToBytes(`0x${signature}`));
    const updatedTransaction = txManager.getTx();

   await vaneClient?.senderConfirm(updatedTransaction)
  }

  const handleComplete = (transaction: TxStateMachine) => {
    // Remove the transaction from the store
    removeTransaction(transaction.txNonce)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    
    // Reset the animation after 1 second
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  // UseEffect hook
  useInitializeWebSocket();

  const renderActionButtons = (transaction: TxStateMachine) => {
    switch (transaction.status) {
      case {type: 'RecvAddrFailed'}:
        return (
          <Button 
            onClick={() => handleRevert(transaction)}
            variant="outline"
            className="w-full h-10 bg-transparent border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs"
          >
            Revert
          </Button>
        );
      
      case {type: 'RecvAddrConfirmed'}:
        return (
          <div className="flex gap-2">
            <Button 
              onClick={() => handleRevert(transaction)}
              variant={isConfirmingRevert ? "default" : "outline"}
              className={`flex-1 h-10 text-white transition-all duration-200 ${
                isConfirmingRevert 
                  ? 'bg-red-500 text-white hover:bg-red-600 hover:text-white' 
                  : 'bg-transparent border-red-500/20 text-white hover:bg-red-500/10'
              } text-xs font-medium`}
            >
              {isConfirmingRevert ? 'Click to confirm revert' : 'Revert'}
            </Button>
            <Button 
              onClick={() => handleConfirm(transaction)}
              className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs font-medium"
            >
              Confirm
            </Button>
          </div>
        );
      
      case {type:'TxSubmissionPassed'}:
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
      
      default:
        return (
          <div className="flex gap-2">
            <Button 
              onClick={() => handleRevert(transaction)}
              variant={isConfirmingRevert ? "default" : "outline"}
              className={`flex-1 h-10 text-white transition-all duration-200 ${
                isConfirmingRevert 
                  ? 'bg-red-500 text-white hover:bg-red-600 hover:text-white' 
                  : 'bg-transparent border-red-500/20 text-white hover:bg-red-500/10'
              } text-xs font-medium`}
            >
              {isConfirmingRevert ? 'Click to confirm revert' : 'Revert'}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      {senderPendingTransactions.map((transaction) => (
        <Card key={transaction.txNonce} className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-3 space-y-3">
            {/* Transaction Details */}
            <div className="space-y-3">
              <div className="flex">
                <div className="flex-1 space-y-0.5">
                  <span className="text-[#9EB2AD] text-[12px]">From address</span>
                  <p className="text-white font-mono text-sm">{transaction.receiverAddress}</p>
                </div>
                <div className="flex-1 text-right space-y-0.5">
                  <span className="text-[#9EB2AD] text-[12px]">Codeword</span>
                  <p className="text-white text-sm">{transaction.codeword}</p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-1 space-y-0.5">
                  <span className="text-[#9EB2AD] text-[12px]">Network</span>
                  <p className="text-white text-sm">{transaction.network}</p>
                </div>
                <div className="flex-1 text-right space-y-0.5">
                  <span className="text-[#9EB2AD] text-[12px]">Amount</span>
                  <p className="text-white text-sm">
                    {transaction.amount} {transaction.network}
                  </p>
                </div>
              </div>
            </div>

            {/* Status with Refresh Button */}
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${statusConfig[transaction.status.type].color}`}>
                {statusConfig[transaction.status.type].icon}
                <span className="text-sm">{statusConfig[transaction.status.type].text}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleRefresh}
                className="h-8 w-8 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10 transition-transform"
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Dynamic Action Buttons */}
            {renderActionButtons(transaction)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

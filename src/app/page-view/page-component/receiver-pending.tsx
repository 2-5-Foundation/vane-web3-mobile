"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { hexToBytes } from "viem"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTransactionStore } from "@/app/lib/useStore";
import { TxStateMachine, TxStateMachineManager } from "vane_lib";
import { useEffect } from "react";


export default function ReceiverPending() {
  const {primaryWallet} = useDynamicContext()
  const vaneClient = useTransactionStore(state => state.vaneClient)
  const recvPendingTransactions = useTransactionStore(state => state.recvTransactions)
  const watchPendingTxUpdates = useTransactionStore(state => state.watchPendingTxUpdates)

  const handleApprove = async (transaction: TxStateMachine) => {
    const signature = await primaryWallet?.signMessage(transaction.receiverAddress);
    const txManager = new TxStateMachineManager(transaction);
    txManager.setReceiverSignature(hexToBytes(`0x${signature}`));
    const updatedTx = txManager.getTx();
    await vaneClient?.receiverConfirm(updatedTx)
  }

  const handleReject = (transaction: TxStateMachine) => {
    // Handle reject logic
    console.log("Transaction rejected", transaction)
  }

  useEffect(() => {
    watchPendingTxUpdates(); 
  })

  return (
    <div className="space-y-3">
      {recvPendingTransactions.map((transaction) => (
        <Card key={transaction.txNonce} className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-3 space-y-3">
            {/* Transaction Details */}
            <div className="space-y-3">
              <div className="flex">
                <div className="flex-1 space-y-0.5">
                  <span className="text-[#9EB2AD] text-[12px]">From address</span>
                  <p className="text-white font-mono text-sm">{transaction.senderAddress}</p>
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

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={() => handleReject(transaction)}
                variant="outline"
                className="flex-1 h-10 bg-transparent border-[#4A5853]/20 text-white hover:bg-[#4A5853]/10 text-xs"
              >
                Reject
              </Button>
              <Button 
                onClick={() => handleApprove(transaction)}
                className="flex-1 h-10 bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 text-xs"
              >
                Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

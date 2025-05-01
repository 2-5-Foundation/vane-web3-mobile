"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import SenderPending from "./sender-pending"
import { useState } from "react"
import { useTransactionStore, TransferFormData, useStore } from "@/app/lib/useStore"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useInitializeWebSocket } from "@/app/lib/helper";
import { toast } from "sonner"

export default function TransferForm() {
  const setTransferStatus = useTransactionStore().setTransferStatus;
  const storeSetTransferFormData = useTransactionStore().storeSetTransferFormData;
  const {vaneClient} = useTransactionStore();
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [isInitiated, setIsInitiated] = useState(false);
  const setCurrentView = useStore(state => state.setCurrentView);

  const [formData, setFormData] = useState<TransferFormData>({
    recipient: '',
    amount: 0,
    asset: '',
    network: ''
  });

  const handleTransferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // TODO: resolve which wallet account to use and which token to display

    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value
    }));

   if (formData.amount > 0 && formData.recipient.trim() !== '') {
    console.log(formData);
    storeSetTransferFormData(formData);
   }
  };

  const handleAssetChange = (value: string) => {
    handleTransferFormChange({
      target: { name: 'asset', value }
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  const submitInitiateTx = async() => {
    try {
      if (!formData.recipient || !formData.amount) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      if (!primaryWallet) {
        toast.info('Please connect a wallet first');
        setShowAuthFlow(true);
        setCurrentView('wallet');
        return;
      }
      
      await vaneClient?.initiateTransaction(
        primaryWallet.address,
        formData.recipient,
        formData.amount,
        formData.asset,
        formData.network
      );
      
      setTransferStatus('pending');
      setIsInitiated(true);
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error('Transaction failed. Please try again.');
    }
  };

  // UseEffect hook
  useInitializeWebSocket();

  // ------------------------------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Fixed Transfer Form */}
      <div className="flex-none">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="pt-2 px-3 space-y-3">
            {/* Recipient Field */}
            <div className="space-y-1">
              <Label className="text-sm text-[#9EB2AD]">Recipient</Label>
              <Input 
                name="recipient"
                value={formData.recipient}
                onChange={handleTransferFormChange}
                placeholder="0x.." 
                className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] text-sm border-t-0 border-x-0 rounded-t-none"
              />
            </div>

            {/* Amount and Asset Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm text-[#9EB2AD]">Amount</Label>
                <Input 
                  name="amount"
                  type="number"
                  value={formData.amount || ''}
                  onChange={handleTransferFormChange}
                  placeholder="0.00"
                  className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-[#9EB2AD]">Asset</Label>
                <Select 
                  name="asset" 
                  value={formData.asset}
                  onValueChange={handleAssetChange}
                >
                  <SelectTrigger className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none">
                    <SelectValue placeholder="ETH" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B1B1C] border-[#4A5853]/20">
                    <SelectItem value="ETH" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">ETH</SelectItem>
                    <SelectItem value="USDC" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">USDC</SelectItem>
                    <SelectItem value="USDT" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Warning Message */}
            <div className="flex items-center gap-2 border border-[#424BDF] text-[#A0A6F5] bg-[#282A3D] p-2 rounded-lg">
              <AlertCircle className="h-4 w-4 text-[#424BDF]" />
              <p className="text-xs">Recipient will need to confirm the transaction</p>
            </div>

            {/* Submit Button */}
            <Button className="w-full h-10 bg-[#7EDFCD] text-[#0B1B1C] hover:bg-[#7EDFCD]/90"
              onClick={submitInitiateTx}
            >
              Initiate transfer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Gradient Separator */}
      <div className="relative h-[3px] mt-6 mb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4A5853]/20 to-transparent" />
      </div>

      {/* Scrollable Transaction Pending */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="space-y-2 pb-16">
            {isInitiated && <SenderPending />}
          </div>
        </div>
        
        {/* Bottom Shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0D1313] via-[#0D1313]/60 to-transparent pointer-events-none" />
      </div>
    </div>
  )
} 
"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import SenderPending from "./sender-pending"
import { useEffect, useState } from "react"
import { useTransactionStore, TransferFormData, useStore } from "@/app/lib/useStore"
import { TxStateMachine } from '@/lib/vane_lib/main'
import { TokenManager, ChainSupported } from '@/lib/vane_lib/primitives'
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { toast } from "sonner"

export default function TransferForm() {
  const setTransferStatus = useTransactionStore().setTransferStatus;
  const storeSetTransferFormData = useTransactionStore().storeSetTransferFormData;
  const { senderPendingTransactions, initiateTransaction, fetchPendingUpdates, isWasmInitialized } = useTransactionStore();
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  
  const [initiatedTransactions, setInitiatedTransactions] = useState<TxStateMachine[]>([]);
  const setCurrentView = useStore(state => state.setCurrentView);

  const [formData, setFormData] = useState<TransferFormData>({
    recipient: '',
    amount: 0,
    asset: 'ETH',
    network: 'Ethereum'
  });

  // WASM initialization is now handled at app level in page.tsx

  useEffect(() => {
    if (formData.amount > 0 && formData.recipient.trim() !== '') {
      console.log('Storing form data:', formData);
      storeSetTransferFormData(formData);
    }
  }, [formData, storeSetTransferFormData]);

  // Remove initiated transactions when they appear in the real transactions list
  useEffect(() => {
    if (senderPendingTransactions && senderPendingTransactions.length > 0) {
      setInitiatedTransactions(prev => 
        prev.filter(initiatedTx => 
          !senderPendingTransactions.some(realTx => 
            realTx.receiverAddress === initiatedTx.receiverAddress &&
            realTx.amount.toString() === initiatedTx.amount.toString()
          )
        )
      );
    }
  }, [senderPendingTransactions]);

  // Listen for custom events to remove initiated transactions
  useEffect(() => {
    const handleRemoveInitiated = (event: CustomEvent<{ index: number }>) => {
      setInitiatedTransactions(prev => {
        const newArray = [...prev];
        newArray.splice(event.detail.index, 1);
        return newArray;
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('removeInitiatedTx', handleRemoveInitiated as EventListener);
      return () => {
        window.removeEventListener('removeInitiatedTx', handleRemoveInitiated as EventListener);
      };
    }
  }, []);

  // Fetch pending transactions when WASM initializes
  useEffect(() => {
    if (isWasmInitialized()) {
      fetchPendingUpdates();
    }
  }, [isWasmInitialized, fetchPendingUpdates]);

  const handleTransferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log('handleTransferFormChange', name, value);
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value
    }));
  };

  const handleAssetChange = (value: string) => {
    console.log('handleAssetChange', value);
    setFormData(prev => ({ ...prev, asset: value }));
  };

  const handleNetworkChange = (value: string) => {
    console.log('handleNetworkChange', value);
    setFormData(prev => ({ ...prev, network: value }));
  };

  const submitInitiateTx = async() => {
    try {
      if (!formData.recipient || !formData.amount || !formData.asset || !formData.network) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      if (!primaryWallet) {
        toast.info('Please connect a wallet first');
        setShowAuthFlow(true);
        setCurrentView('wallet');
        return;
      }

      // Check WASM initialization before attempting transaction
      if (!isWasmInitialized()) {
        toast.error('Connection not initialized. Please wait or refresh the page.');
        return;
      }
      
      // Create token using TokenManager
      const token = formData.asset === 'ETH' 
        ? TokenManager.createNativeToken(ChainSupported.Ethereum)
        : TokenManager.createERC20Token(ChainSupported.Ethereum, formData.asset);
      
      // Call the actual initiateTransaction from vane_lib (matches test pattern)
      await initiateTransaction(
        primaryWallet.address,
        formData.recipient,
        BigInt(formData.amount),
        token,
        'Goated',
        ChainSupported.Ethereum,
        ChainSupported.Ethereum
      );

      setTransferStatus('Genesis');
      console.log("Transaction initiated successfully");
      
      // Clear form after successful submission
      setFormData({
        recipient: '',
        amount: 0,
        asset: 'ETH',
        network: 'Ethereum'
      });
      
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error(`Transaction failed: ${error}`);
    }
  };

  // Determine if form should be disabled
  const isFormDisabled = !isWasmInitialized() || !primaryWallet;

  return (
    <div className="flex flex-col h-full">
      <style>{`
        * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
        }
        .glass-pane {
          background: rgba(37, 54, 57, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-primary {
          background: #3d5a5e;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.15s ease;
          font-size: 13px;
        }
        .btn-primary:hover {
          background: #4a6569;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
        }
        .btn-secondary {
          background: #253639;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-weight: 500;
          transition: all 0.15s ease;
          font-size: 13px;
        }
        .btn-secondary:hover {
          background: #2d4044;
          border-color: rgba(255, 255, 255, 0.12);
        }
      `}</style>
      {/* Fixed Transfer Form */}
      <div className="flex-none">
        <Card className="bg-[#1a2628] border-white/10">
          <CardContent className="pt-2 px-3 space-y-3">

            {/* Recipient Field */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400 font-medium">Receiver Address</Label>
              <Input 
                name="recipient"
                value={formData.recipient}
                onChange={handleTransferFormChange}
                placeholder="0x..." 
                className="bg-[#1a2628] border-white/10 text-white placeholder-gray-500 rounded-lg h-9 text-sm"
              />
            </div>

            {/* Network Field */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400 font-medium">Receiver Network</Label>
              <Select 
                value={formData.network}
                onValueChange={handleNetworkChange}
              >
                <SelectTrigger className="bg-[#1a2628] border-white/10 text-white rounded-lg h-9">
                  <SelectValue placeholder="Ethereum" />
                </SelectTrigger>
                <SelectContent className="bg-[#253639] border-white/10">
                  <SelectItem value="Ethereum" className="text-white focus:bg-white/5">Ethereum</SelectItem>
                  <SelectItem value="Polygon" className="text-white focus:bg-white/5">Polygon</SelectItem>
                  <SelectItem value="Base" className="text-white focus:bg-white/5">Base</SelectItem>
                  <SelectItem value="Arbitrum" className="text-white focus:bg-white/5">Arbitrum</SelectItem>
                  <SelectItem value="Optimism" className="text-white focus:bg-white/5">Optimism</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount and Asset Fields */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400 font-medium">Amount</Label>
                <Input 
                  name="amount"
                  type="number"
                  value={formData.amount === 0 ? '' : formData.amount}
                  onChange={handleTransferFormChange}
                  placeholder="0.00"
                  className="bg-[#1a2628] border-white/10 text-white placeholder-gray-500 rounded-lg h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400 font-medium">Asset</Label>
                <Select 
                  value={formData.asset}
                  onValueChange={handleAssetChange}
                >
                  <SelectTrigger className="bg-[#1a2628] border-white/10 text-white rounded-lg h-9">
                    <SelectValue placeholder="ETH" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#253639] border-white/10">
                    <SelectItem value="Eth" className="text-white focus:bg-white/5">ETH</SelectItem>
                    <SelectItem value="UsdcEth" className="text-white focus:bg-white/5">USDC</SelectItem>
                    <SelectItem value="UsdtEth" className="text-white focus:bg-white/5">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Warning Message */}
            <div className="glass-pane rounded-lg p-2 flex items-center gap-2 text-xs border border-blue-500/20">
              <AlertCircle className="w-3 h-3 flex-shrink-0 text-blue-400" />
              <span className="text-blue-300 font-medium">Secure, requires confirmation from the receiver</span>
            </div>

            {/* Submit Button */}
            <Button 
              className="btn-primary w-full h-10 rounded-lg disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
              onClick={submitInitiateTx}
              disabled={
                isFormDisabled ||
                !formData.recipient ||
                !formData.amount
              }
            >
              {!primaryWallet ? 'Connect Wallet'
                : 'Initiate transfer'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Gradient Separator */}
      <div className="relative h-[3px] mt-6 mb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4A5853]/20 to-transparent" />
      </div>

      {/* Scrollable Transaction Pending */}
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto">
          <div className="space-y-2 pb-16">
            <SenderPending initiatedTransactions={initiatedTransactions} />
          </div>
        </div>
      </div>
    </div>
  )
}
"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Wifi, WifiOff } from "lucide-react"
import SenderPending from "./sender-pending"
import { useEffect, useState, useRef } from "react"
import { useTransactionStore, TransferFormData, useStore } from "@/app/lib/useStore"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useInitializeWebSocket } from "@/app/lib/helper";
import { toast } from "sonner"

export default function TransferForm() {
  const setTransferStatus = useTransactionStore().setTransferStatus;
  const storeSetTransferFormData = useTransactionStore().storeSetTransferFormData;
  const { vaneClient, senderPendingTransactions } = useTransactionStore();
  const fetchPendingTxUpdates = useTransactionStore(state => state.fetchPendingTxUpdates);
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  
  const [initiatedTransactions, setInitiatedTransactions] = useState<Array<{
    receiverAddress: string;
    amount: number;
    token: string;
    network: string;
    codeword: string;
  }>>([]);
  const setCurrentView = useStore(state => state.setCurrentView);

  const [formData, setFormData] = useState<TransferFormData>({
    recipient: '',
    amount: 0,
    asset: 'ETH',
    network: 'Ethereum'
  });

  // Initialize WebSocket and get connection status
  const { isConnected } = useInitializeWebSocket();
  // Registration state
  const [isRegistered, setIsRegistered] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user-registered') === 'true';
    }
    return false;
  });
  const [regCountdown, setRegCountdown] = useState(98);
  const regIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Registration timer effect
  useEffect(() => {
    if (isRegistered || isConnected || !primaryWallet) return;
    // Only run timer if not registered, not connected, and wallet is connected
    regIntervalRef.current = setInterval(() => {
      setRegCountdown(prev => {
        if (prev <= 1) {
          clearInterval(regIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (regIntervalRef.current) clearInterval(regIntervalRef.current);
    };
  }, [isRegistered, isConnected, primaryWallet]);

  // When websocket connects, set registration
  useEffect(() => {
    if (!isRegistered && isConnected) {
      setIsRegistered(true);
      localStorage.setItem('user-registered', 'true');
    }
  }, [isConnected, isRegistered]);

  // Format timer
  const regMM = String(Math.floor(regCountdown / 60)).padStart(2, '0');
  const regSS = String(regCountdown % 60).padStart(2, '0');

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
            realTx.amount.toString() === initiatedTx.amount.toString() &&
            realTx.token === initiatedTx.token &&
            realTx.network === initiatedTx.network &&
            realTx.codeword === initiatedTx.codeword
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

  // Fetch pending transactions when WebSocket connects
  useEffect(() => {
    if (isConnected) {
      fetchPendingTxUpdates();
    }
  }, [isConnected, fetchPendingTxUpdates]);

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

      // Check WebSocket connection before attempting transaction
      if (!isConnected || !vaneClient) {
        toast.error('WebSocket not connected. Please wait or refresh the page.');
        return;
      }
      
      // Add to initiated transactions immediately for better UX
      const newInitiatedTx = {
        receiverAddress: formData.recipient,
        amount: formData.amount,
        token: formData.asset,
        network: formData.network,
        codeword: 'Goated'
      };

      setInitiatedTransactions(prev => [...prev, newInitiatedTx]);
      
      await vaneClient.initiateTransaction(
        primaryWallet.address,
        formData.recipient,
        formData.amount,
        formData.asset,
        formData.network,
        'Goated'
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
      
      // Remove the failed transaction from initiated list
      setInitiatedTransactions(prev => 
        prev.filter(tx => 
          !(tx.receiverAddress === formData.recipient &&
            tx.amount === formData.amount &&
            tx.token === formData.asset &&
            tx.network === formData.network &&
            tx.codeword === 'Goated')
        )
      );
    }
  };

  // Determine if form should be disabled
  const isFormDisabled = !isConnected || !primaryWallet;

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Transfer Form */}
      <div className="flex-none">
        <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="pt-2 px-3 space-y-3">
            {/* Connection Status Indicator */}
            <div className="flex items-center justify-between mb-2">
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
              {/* Registration logic for status row */}
              {!isConnected && !isRegistered && (
                <span className="text-xs text-[#9EB2AD] flex items-center gap-2">
                  Please wait
                  <span className="ml-2 px-2 py-0.5 rounded bg-[#1A2A2A] text-[#7EDFCD] text-xs font-mono min-w-[44px] text-center">
                    {regMM}:{regSS}
                  </span>
                </span>
              )}
              {!isConnected && isRegistered && (
                <span className="text-xs text-[#9EB2AD]">Please wait</span>
              )}
            </div>

            {/* Recipient Field */}
            <div className="space-y-1">
              <Label className="text-sm text-[#9EB2AD]">Recipient</Label>
              <Input 
                name="recipient"
                value={formData.recipient}
                onChange={handleTransferFormChange}
                placeholder="0x.." 
                className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] text-xs border-t-0 border-x-0 rounded-t-none font-mono"
              />
            </div>

            {/* Network Field */}
            <div className="space-y-1">
              <Label className="text-sm text-[#9EB2AD]">Network</Label>
              <Select 
                value={formData.network}
                onValueChange={handleNetworkChange}
              >
                <SelectTrigger className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] text-sm font-mono">
                  <SelectValue placeholder="Ethereum" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1B1C] border-[#4A5853]/20">
                  <SelectItem value="Ethereum" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">Ethereum</SelectItem>
                  <SelectItem value="Polygon" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">Polygon</SelectItem>
                  <SelectItem value="Base" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">Base</SelectItem>
                  <SelectItem value="Arbitrum" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">Arbitrum</SelectItem>
                  <SelectItem value="Optimism" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">Optimism</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount and Asset Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm text-[#9EB2AD]">Amount</Label>
                <Input 
                  name="amount"
                  type="number"
                  value={formData.amount === 0 ? '' : formData.amount}
                  onChange={handleTransferFormChange}
                  placeholder="0.00"
                  className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-[#9EB2AD]">Asset</Label>
                <Select 
                  value={formData.asset}
                  onValueChange={handleAssetChange}
                >
                  <SelectTrigger className="h-8 bg-transparent border-[#4A5853]/20 text-[#FFFFFF] border-t-0 border-x-0 rounded-t-none font-mono">
                    <SelectValue placeholder="ETH" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B1B1C] border-[#4A5853]/20">
                    <SelectItem value="Eth" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">ETH</SelectItem>
                    <SelectItem value="UsdcEth" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">USDC</SelectItem>
                    <SelectItem value="UsdtEth" className="text-[#FFFFFF] focus:bg-[#7EDFCD]/5">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Warning Message */}
            <div className="flex items-center gap-2 border border-[#424BDF] text-[#A0A6F5] bg-[#282A3D] p-2 rounded-lg">
              <AlertCircle className="h-4 w-4 text-[#424BDF]" />
              <p className="text-xs">Secure, requires confirmation from the receiver</p>
            </div>

            {/* Submit Button */}
            <Button 
              className="w-full h-10 bg-[#7EDFCD] text-[#0B1B1C] hover:bg-[#7EDFCD]/90 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
              onClick={submitInitiateTx}
              disabled={
                (!isRegistered && !isConnected) || // registration in progress
                isFormDisabled ||
                !formData.recipient ||
                !formData.amount
              }
            >
              {!isRegistered && !isConnected ? 'One time activation process'
                : !isConnected ? 'Connecting...'
                : !primaryWallet ? 'Connect Wallet'
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
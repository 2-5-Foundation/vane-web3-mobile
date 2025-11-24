"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, ArrowLeft, ArrowRight, DollarSign } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTransactionStore, TransferFormData, useStore } from "@/app/lib/useStore"
import { TxStateMachine } from '@/lib/vane_lib/main'
import { TokenManager, ChainSupported } from '@/lib/vane_lib/primitives'
import { useDynamicContext, useWalletConnectorEvent } from "@dynamic-labs/sdk-react-core";
import { toast } from "sonner"
import { TokenBalance } from "@dynamic-labs/sdk-api-core"
import Image from "next/image";


interface TransferFormProps {
  tokenList: TokenBalance[]; // TokenBalance objects
}

// Helper function to convert network ID to ChainSupported
function getWalletNetworkFromId(networkId: number): ChainSupported {
  switch (networkId) {
    case 1:
      return ChainSupported.Ethereum;
    case 137:
      return ChainSupported.Polygon;
    case 8453:
      return ChainSupported.Base;
    case 10:
      return ChainSupported.Optimism;
    case 42161:
      return ChainSupported.Arbitrum;
    case 56:
      return ChainSupported.Bnb;
    case 101:
      return ChainSupported.Solana;
    default:
      console.warn(`Unknown network ID: ${networkId}, defaulting to Ethereum`);
      throw new Error(`Unknown network ID: ${networkId}`);
  }
}

// Helper function to determine if a token is native based on symbol and address
function isNativeTokenBySymbolAndAddress(symbol: string | undefined, address: string | undefined, network: ChainSupported): boolean {
  if (!symbol) return false;
  
  const upperSymbol = symbol.toUpperCase();
  
  // Check for native token symbols by network
  switch (network) {
    case ChainSupported.Ethereum:
    case ChainSupported.Base:
    case ChainSupported.Arbitrum:
    case ChainSupported.Optimism:
      // ETH is native on these networks
      return upperSymbol === 'ETH';
    case ChainSupported.Polygon:
      // POL is native on Polygon
      return upperSymbol === 'POL';
    case ChainSupported.Bnb:
      // BNB is native on BNB Smart Chain
      return upperSymbol === 'BNB';
    case ChainSupported.Solana:
      // SOL is native on Solana
      return upperSymbol === 'SOL';
    case ChainSupported.Tron:
      // TRX is native on TRON
      return upperSymbol === 'TRX';
    case ChainSupported.Polkadot:
      // DOT is native on Polkadot
      return upperSymbol === 'DOT';
    case ChainSupported.Bitcoin:
      // BTC is native on Bitcoin
      return upperSymbol === 'BTC';
    default:
      return false;
  }
}


function toBaseUnits8dp(input: string, tokenDecimals: number): bigint {
  // 1) validate: up to 8 decimals
  if (!/^\d+(\.\d{1,8})?$/.test(input.trim())) {
    throw new Error("Amount must have at most 8 decimal places");
  }

  // 2) micro-units integer (8 decimal places)
  const [i = "0", f = ""] = input.split(".");
  const micro = BigInt(i) * 100000000n + BigInt((f + "00000000").slice(0, 8));

  // 3) scale micro → base units
  // base = 10^tokenDecimals; micro = 10^8 ⇒ multiply by 10^(decimals-8)
  if (tokenDecimals >= 8) {
    const pow = BigInt(10) ** BigInt(tokenDecimals - 8);
    return micro * pow;
  } else {
    // Need to *round or reject* because base unit is coarser than 0.00000001
    // Here we reject if micro isn't divisible by 10^(8-decimals).
    const div = BigInt(10) ** BigInt(8 - tokenDecimals);
    if (micro % div !== 0n) throw new Error("Too many decimals for this token");
    return micro / div;
  }
}

export default function TransferForm({ tokenList }: TransferFormProps) {
  const setTransferStatus = useTransactionStore().setTransferStatus;
  const storeSetTransferFormData = useTransactionStore().storeSetTransferFormData;
  const { initiateTransaction, fetchPendingUpdates, isWasmInitialized } = useTransactionStore();
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  
  const setCurrentView = useStore(state => state.setCurrentView);

  const [formData, setFormData] = useState<TransferFormData>({
    recipient: '',
    amount: 0,
    asset: '',
    network: ''
  });

  const [currentStep, setCurrentStep] = useState<'recipient' | 'amount' | 'confirm'>('recipient');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [senderNetwork, setSenderNetwork] = useState<ChainSupported | null>(null);

  // Function to get USD price from token balances
  const getUsdPriceFromToken = (asset: string) => {
    if (!tokenList || tokenList.length === 0) return null;
    
    const token = tokenList.find(t => 
      t.symbol === asset || 
      t.name === asset ||
      t.address === asset
    );
    
    if (token && token.marketValue && token.balance) {
      // Calculate price per unit: marketValue / balance
      return token.marketValue / parseFloat(token.balance.toString());
    }
    
    return null;
  };


  useEffect(() => {
    const amountValue = parseFloat(formData.amount.toString());
    if (amountValue > 0 && formData.recipient.trim() !== '') {
      storeSetTransferFormData(formData);
    }
  }, [formData, storeSetTransferFormData]);

  // Fetch pending transactions when WASM initializes
  useEffect(() => {
    if (isWasmInitialized()) {
      fetchPendingUpdates();
    }
  }, [isWasmInitialized, fetchPendingUpdates]);

  const updateSenderNetwork = useCallback(async () => {
    if (!primaryWallet) {
      setSenderNetwork(null);
      return;
    }

    try {
      const walletNetworkId = await primaryWallet.getNetwork();
      const network = getWalletNetworkFromId(Number(walletNetworkId));
      setSenderNetwork(network);
      setFormData(prev => ({ ...prev, network }));
    } catch (error) {
      console.error('Error getting wallet network:', error);
    }
  }, [primaryWallet]);

  useEffect(() => {
    updateSenderNetwork();
  }, [updateSenderNetwork]);

  useWalletConnectorEvent(
    primaryWallet?.connector,
    'chainChange',
    () => {
      updateSenderNetwork();
    }
  );

  const handleTransferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log('handleTransferFormChange', name, value);
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty string
    if (value === '') {
      setFormData(prev => ({ ...prev, amount: '' }));
      return;
    }
    
    // Allow only numbers and decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      return; // Don't update if more than one decimal point
    }
    
    // Store the cleaned value (can be partial like "0." or ".90")
    setFormData(prev => ({ ...prev, amount: cleanValue }));
  };

  const handleNextStep = () => {
    if (currentStep === 'recipient') {
      if (formData.recipient.trim()) {
        setCurrentStep('amount');
      }
    } else if (currentStep === 'amount') {
      const amountValue = parseFloat(formData.amount.toString());
      if (amountValue > 0) {
        setCurrentStep('confirm');
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'amount') {
      setCurrentStep('recipient');
    } else if (currentStep === 'confirm') {
      setCurrentStep('amount');
    }
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
      setIsSubmitting(true);
      
      const amountValue = parseFloat(formData.amount.toString());
      if (!formData.recipient || !amountValue || amountValue <= 0 || !formData.asset || !formData.network) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }
      // Balance check: ensure user has enough of the selected token
      const selectedTokenForBalance = tokenList.find(t => t.symbol === formData.asset || t.name === formData.asset || t.address === formData.asset);
      if (selectedTokenForBalance) {
        const available = Number(selectedTokenForBalance.balance ?? 0);
        if (!Number.isFinite(available)) {
          toast.error('Unable to read token balance');
          setIsSubmitting(false);
          return;
        }
        if (amountValue > available) {
          toast.error('Insufficient balance for selected token');
          setIsSubmitting(false);
          return;
        }
      }
      
      // No need for custom ERC20 validation since we only show wallet tokens
      
      if (!primaryWallet) {
        toast.info('Please connect a wallet first');
        setShowAuthFlow(true);
        setCurrentView('wallet');
        setIsSubmitting(false);
        return;
      }

      // Check WASM initialization before attempting transaction
      if (!isWasmInitialized()) {
        toast.error('Please connect the node first. Go to Wallet page and click "Connect Node".');
        setIsSubmitting(false);
        return;
      }
      
      // Create token using TokenManager based on network and asset type
      let token;
      
      // Get the selected network
      const selectedNetwork = formData.network as ChainSupported;
      
      // Find the selected token from tokenList by symbol
      const selectedToken = tokenList.find(t => t.symbol === formData.asset);
      
      // Create token based on network and whether it's native
      const tokenName = selectedToken?.name || formData.asset;
      const tokenAddress = selectedToken?.address;
      const tokenSymbol = selectedToken?.symbol;
      const tokenDecimals = selectedToken?.decimals;
      
      // Check if it's a native token based on symbol and address patterns
      const isNativeToken = isNativeTokenBySymbolAndAddress(tokenSymbol, tokenAddress, selectedNetwork);
      
      if (isNativeToken) {
        token = TokenManager.createNativeToken(selectedNetwork);
      } else {
        // Has address, so it's a token standard token
        switch (selectedNetwork) {
          case ChainSupported.Ethereum:
          case ChainSupported.Base:
          case ChainSupported.Arbitrum:
          case ChainSupported.Polygon:
          case ChainSupported.Optimism:
            // All Ethereum-compatible chains use ERC20
            token = TokenManager.createERC20Token(selectedNetwork, tokenName, tokenAddress, tokenDecimals);
            break;
          case ChainSupported.Bnb:
            token = TokenManager.createBEP20Token(tokenName, tokenAddress, tokenDecimals);
            break;
          case ChainSupported.Solana:
            token = TokenManager.createSPLToken(tokenName, tokenAddress, tokenDecimals);
            break;
          case ChainSupported.Tron:
            token = TokenManager.createTRC20Token(tokenName, tokenAddress, tokenDecimals);
            break;
          default:
            throw new Error(`Unsupported network: ${selectedNetwork}`);
        }
      }
      
      // Get wallet network and convert to ChainSupported
      const walletNetworkId = await primaryWallet.getNetwork();
      const walletNetwork = getWalletNetworkFromId(Number(walletNetworkId));
      
      // Convert amount string to base units using token decimals
      const amountInBaseUnits = toBaseUnits8dp(formData.amount.toString(), tokenDecimals);
      
      // Call the actual initiateTransaction from vane_lib (matches test pattern)
      await initiateTransaction(
        primaryWallet.address,
        formData.recipient,
        amountInBaseUnits,
        token,
        primaryWallet.connector.metadata.name,
        walletNetwork, // sender network from wallet
        selectedNetwork // receiver network from user selection
      );

      setTransferStatus('Genesis');
      console.log("Transaction initiated successfully");
      toast.success('Check your outgoing pending transactions for updates');
      // Clear form after successful submission and reset to step 1
      setFormData({
        recipient: '',
        amount: 0,
        asset: '',
        network: ''
      });
      setCurrentStep('recipient');
      
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error(`Transaction initiation failed`);
    } finally {
      setIsSubmitting(false);
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
      {/* Progressive Transfer Form */}
      <div className="flex-none">
        <Card className="bg-[#1a2628] border-white/10">
          <CardContent className="pt-2 px-3 space-y-3">

            {/* Step 1: Recipient Information */}
            <div className="space-y-3">
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

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400 font-medium">Receiver Network</Label>
                <div className="bg-[#1a2628] border border-white/10 text-white rounded-lg h-9 px-3 flex items-center">
                  <span className="text-sm text-white">
                    {senderNetwork}
                  </span>
                </div>
                
              </div>

              {/* Note for Step 1 */}
              <div className="glass-pane rounded-lg p-2 flex items-center gap-2 text-xs border border-blue-500/20">
                <AlertCircle className="w-3 h-3 flex-shrink-0 text-blue-400" />
                <span className="text-blue-300 font-medium">Funds will only be transferred once the receiver confirms.</span>
              </div>

              {/* Step 1 Button - only show when on recipient step */}
              {currentStep === 'recipient' && (
                <Button 
                  className="w-full h-10 rounded-lg bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={handleNextStep}
                  disabled={!formData.recipient.trim() || !primaryWallet}
                >
                  {!primaryWallet ? 'Connect Wallet' : (
                    <>
                      Next: Enter Amount
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Step 2: Amount Information */}
            {currentStep === 'amount' && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 font-medium">Amount</Label>
                    <div className="relative">
                      <Input 
                        name="amount"
                        type="text"
                        value={formData.amount || ''}
                        onChange={handleAmountChange}
                        placeholder="0.00"
                        className="bg-[#1a2628] border-white/10 text-white placeholder-gray-500 rounded-lg h-9 text-sm pr-8"
                      />
                      {/* USD Tooltip */}
                      {parseFloat(formData.amount.toString()) > 0 && formData.asset && (() => {
                        const usdPrice = getUsdPriceFromToken(formData.asset);
                        return usdPrice ? (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
                            <DollarSign className="h-3 w-3" />
                            <span>{(parseFloat(formData.amount.toString()) * usdPrice).toFixed(2)}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400 font-medium">Asset</Label>
                    <Select 
                      value={formData.asset}
                      onValueChange={handleAssetChange}
                    >
                      <SelectTrigger className="bg-[#1a2628] border-white/10 text-white rounded-lg h-9">
                        <SelectValue placeholder="select token" className="text-white" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#253639] border-white/10">
                        {tokenList.length > 0 && tokenList.map((token) => (
                          <SelectItem
                            key={token.symbol ?? token.name ?? token.address}
                            value={token.symbol}
                            className="text-white focus:bg-white/5"
                          >
                            <span className="flex items-center gap-2">
                              {token.logoURI ? (
                                <Image
                                  src={token.logoURI}
                                  alt={`${token.symbol ?? token.name ?? 'token'} logo`}
                                  width={20}
                                  height={20}
                                  className="rounded-full"
                                />
                              ) : (
                                <span className="h-5 w-5 rounded-full bg-white/10" />
                              )}
                              <span className="text-xs uppercase tracking-wide">
                                {token.symbol ?? token.name ?? 'Token'}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Note for Step 2 */}
                <div className="glass-pane rounded-lg p-2 flex items-center gap-2 text-xs border border-green-500/20">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 text-green-400" />
                  <span className="text-green-300 font-medium">Your transaction is protected from any mistakes</span>
                </div>

                {/* Step 2 Buttons */}
                <div className="flex gap-2">
                  <Button 
                    className="h-10 w-10 rounded-lg bg-[#253639] border border-white/10 text-white hover:bg-[#2d4044] p-0"
                    onClick={handlePrevStep}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    className="flex-1 h-10 rounded-lg bg-[#7EDFCD] text-black hover:bg-[#7EDFCD]/90 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                    onClick={submitInitiateTx}
                      disabled={!formData.amount || parseFloat(formData.amount.toString()) <= 0 || isSubmitting || isFormDisabled}
                  >
                    {isSubmitting ? 'Processing...' : 'Initiate Transfer'}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Gradient Separator */}
      <div className="relative h-[3px] mt-6 mb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4A5853]/20 to-transparent" />
      </div>

      {/* Scrollable Transaction Pending */}
     
    </div>
  )
}
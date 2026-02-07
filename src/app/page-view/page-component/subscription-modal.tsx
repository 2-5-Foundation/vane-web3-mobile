"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { X, AlertCircle, Globe, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDynamicContext, useTokenBalances } from "@dynamic-labs/sdk-react-core";
import { ChainEnum, TokenBalance } from "@dynamic-labs/sdk-api-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { subscribeToVaneSafety } from "@/app/actions/subscriptionActions";
import { signClientAuth } from "@/app/actions/verificationAction";
import { prepareEvmSubscriptionPayment, getSolanaPaymentAddress } from "@/lib/server/tx/prepareSubscriptionPayment";
import { parseUnits } from "viem";
import { toast } from "sonner";

type BillingPeriod = "monthly" | "weekly";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBillingPeriod?: BillingPeriod;
}

const PRICES = { weekly: 2.49, monthly: 5.99 };

const isNativeToken = (symbol: string | undefined): boolean => {
  const s = symbol?.toUpperCase() || "";
  return ["ETH", "POL", "MATIC", "BNB", "SOL"].includes(s);
};

const SubscriptionModal = ({ isOpen, onClose, defaultBillingPeriod = "monthly" }: SubscriptionModalProps) => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(defaultBillingPeriod);
  const [step, setStep] = useState<"info" | "payment">("info");
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { primaryWallet } = useDynamicContext();
  const { tokenBalances } = useTokenBalances({ includeFiat: true, includeNativeBalance: true, chainName: ChainEnum.Evm });

  useEffect(() => {
    if (isOpen) {
      setBillingPeriod(defaultBillingPeriod);
      setStep("info");
      setSelectedToken(null);
    }
  }, [isOpen, defaultBillingPeriod]);

  const availableTokens = useMemo(() => {
    return tokenBalances?.filter((t) => t.balance > 0) || [];
  }, [tokenBalances]);

  const getTokenAmount = (token: TokenBalance): string => {
    const price = PRICES[billingPeriod];
    if (!token.price || token.price === 0) {
      if (["USDC", "USDT", "DAI"].includes(token.symbol?.toUpperCase() || "")) return price.toFixed(2);
      return "N/A";
    }
    return (price / token.price).toFixed(6);
  };

  const handlePayment = async () => {
    if (!primaryWallet || !selectedToken) return;

    const tokenAmount = getTokenAmount(selectedToken);
    if (tokenAmount === "N/A") {
      toast.error("Cannot determine token price");
      return;
    }

    setIsProcessing(true);
    try {
      const address = primaryWallet.address;
      const decimals = selectedToken.decimals ?? 18;
      const isNative = isNativeToken(selectedToken.symbol);

      if (isEthereumWallet(primaryWallet)) {
        const networkId = await primaryWallet.getNetwork();
        const walletClient = await primaryWallet.getWalletClient();
        const amountInUnits = parseUnits(tokenAmount, decimals);

        const prepareResult = await prepareEvmSubscriptionPayment({
          senderAddress: address,
          networkId: Number(networkId),
          tokenAddress: isNative ? null : selectedToken.address || null,
          amount: amountInUnits,
          decimals,
        });

        if (!prepareResult.success || !prepareResult.txFields) {
          toast.error(prepareResult.error || "Failed to prepare transaction");
          return;
        }

        const receipt = await walletClient.sendTransactionSync(prepareResult.txFields as any);
        if (!receipt.transactionHash) {
          toast.error("Transaction failed");
          return;
        }
        toast.success("Payment sent!");

      } else if (isSolanaWallet(primaryWallet)) {
        const paymentAddress = await getSolanaPaymentAddress();
        const signer = await primaryWallet.getSigner();
        const connection = await primaryWallet.getConnection();
        const { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } = await import("@solana/web3.js");

        const amountFloat = parseFloat(tokenAmount);
        const fromPubkey = new PublicKey(address);
        const toPubkey = new PublicKey(paymentAddress);
        const { blockhash } = await connection.getLatestBlockhash();

        if (isNative) {
          const lamports = BigInt(Math.floor(amountFloat * 1e9));
          const ix = SystemProgram.transfer({ fromPubkey, toPubkey, lamports });
          const msg = new TransactionMessage({ payerKey: fromPubkey, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
          const tx = new VersionedTransaction(msg);
          await signer.signAndSendTransaction(tx as any, { preflightCommitment: "confirmed" });
        } else {
          const { getAssociatedTokenAddress, createTransferCheckedInstruction, getMint, createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
          const mint = new PublicKey(selectedToken.address!);
          const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
          const toAta = await getAssociatedTokenAddress(mint, toPubkey);
          const instructions = [];
          const toAtaInfo = await connection.getAccountInfo(toAta);
          if (!toAtaInfo) instructions.push(createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, mint));
          const mintInfo = await getMint(connection, mint);
          const amount = BigInt(Math.floor(amountFloat * Math.pow(10, mintInfo.decimals)));
          instructions.push(createTransferCheckedInstruction(fromAta, mint, toAta, fromPubkey, amount, mintInfo.decimals));
          const msg = new TransactionMessage({ payerKey: fromPubkey, recentBlockhash: blockhash, instructions }).compileToV0Message();
          const tx = new VersionedTransaction(msg);
          await signer.signAndSendTransaction(tx as any, { preflightCommitment: "confirmed" });
        }
        toast.success("Payment sent!");

      } else {
        toast.error("Wallet not supported");
        return;
      }

      const sig = await signClientAuth(address);
      const sigBytes = Array.from(sig);
      const tier = billingPeriod === "weekly" ? 1 : 2;
      const result = await subscribeToVaneSafety(sigBytes, address, tier);

      if (result.success) {
        toast.success("Subscription activated!");
        onClose();
      } else {
        toast.error("Subscription failed. Contact support.");
      }
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || "";
      if (msg.includes("insufficient") || msg.includes("exceeds balance")) {
        toast.error("Insufficient balance");
      } else if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
        toast.error("Transaction cancelled");
      } else if (msg.includes("gas")) {
        toast.error("Not enough gas");
      } else {
        toast.error("Payment failed");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-[#0D1B1B] border border-white/10 rounded-xl overflow-hidden max-h-[90vh] overflow-y-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <Image src="/vane-logo-icon.png" alt="Vane" width={24} height={24} />
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
          </div>

          {step === "info" ? (
            <>
              <div className="p-4 space-y-4 flex-1">
                <div className="relative w-full rounded-xl overflow-hidden border border-white/20" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src="https://customer-x258fyyk87tqur69.cloudflarestream.com/00c3840b7c9bbfef168ea93f59850292/iframe?preload=true"
                    loading="lazy"
                    style={{ border: "none", position: "absolute", top: 0, left: 0, height: "100%", width: "100%" }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-[#0A1414] rounded-lg border border-white/5">
                    <AlertCircle className="w-5 h-5 text-orange-400 mb-2" />
                    <p className="text-2xl font-semibold text-white">$400K+</p>
                    <p className="text-[10px] text-gray-500 mt-1">Lost daily to wrong-address and address-poisoning attacks</p>
                  </div>
                  <div className="p-3 bg-[#0A1414] rounded-lg border border-white/5">
                    <Globe className="w-5 h-5 text-orange-400 mb-2" />
                    <p className="text-2xl font-semibold text-white">1M+</p>
                    <p className="text-[10px] text-gray-500 mt-1">Address-poisoning attempts occur daily across multiple networks</p>
                  </div>
                </div>

                <div className="bg-[#0A1414] border border-white/5 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-center gap-1 p-1 bg-[#0D1B1B] rounded-lg">
                    <button onClick={() => setBillingPeriod("monthly")} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${billingPeriod === "monthly" ? "bg-white text-black" : "text-gray-400"}`}>Monthly</button>
                    <button onClick={() => setBillingPeriod("weekly")} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${billingPeriod === "weekly" ? "bg-white text-black" : "text-gray-400"}`}>Weekly</button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-white font-medium text-2xl">${PRICES[billingPeriod].toFixed(2)}</span>
                    <span className="text-[10px] text-gray-500">{billingPeriod === "monthly" ? "per month" : "per week"}</span>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 pt-3 border-t border-white/10 space-y-2">
                <p className="text-[10px] text-gray-500 text-center">Vane is non-custodial. We never store your private keys.</p>
                <button onClick={() => setStep("payment")} className="w-full bg-[#7EDFCD] hover:bg-[#6BC9B7] text-[#0D1B1B] py-2.5 rounded-lg text-sm font-semibold">Protect My Transfers</button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 space-y-3 flex-1">
                {/* Plan Badge */}
                <div className="flex justify-center">
                  <span className="text-xs px-3 py-1 rounded-full bg-[#7EDFCD]/20 text-[#7EDFCD] border border-[#7EDFCD]/40">
                    {billingPeriod === "weekly" ? "Weekly $2.49" : "Monthly $5.99"}
                  </span>
                </div>

                {/* Token Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-medium">Pay with</label>
                  <div className="relative">
                    <button 
                      onClick={() => setShowTokenDropdown(!showTokenDropdown)} 
                      className="w-full bg-[#1a2628] border border-white/10 rounded-lg h-10 px-3 flex items-center justify-between hover:border-white/20 transition-colors"
                    >
                      {selectedToken ? (
                        <div className="flex items-center gap-2">
                          {selectedToken.logoURI?.startsWith("http") ? (
                            <img src={selectedToken.logoURI} alt="" width={20} height={20} className="rounded-full" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : (
                            <span className="h-5 w-5 rounded-full bg-white/10" />
                          )}
                          <span className="text-sm text-white uppercase tracking-wide">{selectedToken.symbol}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Select token</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTokenDropdown ? "rotate-180" : ""}`} />
                    </button>

                    <AnimatePresence>
                      {showTokenDropdown && (
                        <motion.div 
                          initial={{ opacity: 0, y: -4 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -4 }} 
                          className="absolute top-full left-0 right-0 mt-1 bg-[#253639] border border-white/10 rounded-lg z-10 max-h-48 overflow-y-auto"
                        >
                          {availableTokens.map((token, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setSelectedToken(token); setShowTokenDropdown(false); }} 
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white focus:bg-white/5"
                            >
                              {token.logoURI?.startsWith("http") ? (
                                <img src={token.logoURI} alt="" width={20} height={20} className="rounded-full" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              ) : (
                                <span className="h-5 w-5 rounded-full bg-white/10" />
                              )}
                              <span className="text-xs uppercase tracking-wide">{token.symbol}</span>
                              <span className="ml-auto text-[10px] text-gray-500">{token.balance.toFixed(4)}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Amount Display */}
                {selectedToken && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400 font-medium">You will pay</label>
                    <div className="bg-[#1a2628] border border-white/10 rounded-lg h-10 px-3 flex items-center justify-between">
                      <span className="text-sm text-white font-medium">{getTokenAmount(selectedToken)}</span>
                      <span className="text-xs text-gray-400 uppercase">{selectedToken.symbol}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 pt-3 border-t border-white/10 space-y-2">
                <button onClick={() => setStep("info")} className="w-full text-gray-400 hover:text-white py-2 text-sm">← Back</button>
                <button onClick={handlePayment} disabled={!selectedToken || isProcessing} className="w-full bg-[#7EDFCD] hover:bg-[#6BC9B7] disabled:bg-gray-600 text-[#0D1B1B] py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : "Confirm Payment"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SubscriptionModal;

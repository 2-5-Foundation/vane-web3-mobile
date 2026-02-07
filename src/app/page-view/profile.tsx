"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  TrendingUp,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTransactionStore } from "../lib/useStore";
import { useShallow } from "zustand/react/shallow";
import { useDynamicContext, useTokenBalances } from "@dynamic-labs/sdk-react-core";
import { isSubscriptionActive } from "@/app/actions/subscriptionActions";
import SubscriptionModal from "./page-component/subscription-modal";
import { getTokenLabel } from "./page-component/sender-pending";
import { getTokenDecimals } from "@/lib/vane_lib/primitives";

export default function Profile() {
  const { primaryWallet } = useDynamicContext();
  const vaneAuth = useTransactionStore(useShallow((state) => state.vaneAuth));
  const metricsTxList = useTransactionStore(useShallow((state) => state.metricsTxList));
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [activePlan, setActivePlan] = useState<"weekly" | "monthly" | null>(null);
  const [revertedTokens, setRevertedTokens] = useState<
    { symbol: string; amount: number }[]
  >([]);
  const [tokensExpanded, setTokensExpanded] = useState(false);

  const { tokenBalances } = useTokenBalances({
    includeFiat: true,
    includeNativeBalance: true,
  });

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (!primaryWallet || vaneAuth.length === 0) return;
      try {
        const address = primaryWallet.address;
        const sigBytes = Array.from(vaneAuth);
        const result = await isSubscriptionActive(sigBytes, address);
        if (result.tier === 1) {
          setActivePlan("weekly");
        } else if (result.tier === 2) {
          setActivePlan("monthly");
        }
      } catch (e) {
        console.error("Failed to check subscription:", e);
      }
    };
    checkSubscription();
  }, [primaryWallet, vaneAuth]);

  const handleSubscriptionClick = (plan?: "weekly" | "monthly") => {
    if (plan) setActivePlan(plan);
    setShowCheckout(true);
  };

  const handleBackToProfile = () => {
    setShowCheckout(false);
  };

  // Load profile data from store
  useEffect(() => {
    setIsLoading(true);

    const revertedTxs = metricsTxList.filter((tx) => tx.status?.type === "Reverted");

    if (!revertedTxs.length) {
      setStats({ protected_amount: 0, largest_recovery: 0, total_transactions: metricsTxList.length });
      setRevertedTokens([]);
      setIsLoading(false);
      return;
    }

    // Aggregate token amounts
    const tokenMap: Record<string, number> = {};
    revertedTxs.forEach((tx) => {
      const tokenSymbol = getTokenLabel(tx.token);
      if (!tokenSymbol) return;
      const decimals = getTokenDecimals(tx.token) || 18;
      const tokenAmount = Number(BigInt(tx.amount)) / Math.pow(10, decimals);
      tokenMap[tokenSymbol.toUpperCase()] = (tokenMap[tokenSymbol.toUpperCase()] || 0) + tokenAmount;
    });

    setRevertedTokens(Object.entries(tokenMap).map(([symbol, amount]) => ({ symbol, amount })));

    if (!tokenBalances?.length) {
      setStats({ protected_amount: 0, largest_recovery: 0, total_transactions: metricsTxList.length });
      setIsLoading(false);
      return;
    }

    let protectedAmount = 0;
    let largestRecovery = 0;

    for (const [symbol, amount] of Object.entries(tokenMap)) {
      const balance = tokenBalances.find(
        (b: any) =>
          b.symbol?.toUpperCase() === symbol ||
          b.name?.toUpperCase() === symbol
      );
      if (balance) {
        const pricePerToken =
          balance.price ||
          (balance.marketValue && balance.balance > 0
            ? balance.marketValue / balance.balance
            : 0);
        const value = amount * pricePerToken;
        protectedAmount += value;
        largestRecovery = Math.max(largestRecovery, value);
      }
    }

    setStats({
      protected_amount: protectedAmount,
      largest_recovery: largestRecovery,
      total_transactions: metricsTxList.length,
    });

    setIsLoading(false);
  }, [metricsTxList, tokenBalances]);

  return (
    <>
      <div className="space-y-3 max-w-sm mx-auto px-4">
        <style>{`
          * {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
          }
          .glass-pane {
            background: rgba(37, 54, 57, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
        `}</style>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto glass-pane rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-300" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">
              Protected by VaneWeb3
            </p>
          </div>
        </div>

        {!isLoading && (
          <>
            {/* Protected & Recovered Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0D1B1B] rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">
                  Protected & Recovered
                </span>
              </div>
              {revertedTokens.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(tokensExpanded ? revertedTokens : revertedTokens.slice(0, 3)).map(({ symbol, amount }) => (
                    <span
                      key={symbol}
                      className="text-[10px] bg-[#1a2628] text-gray-300 px-1.5 py-0.5 rounded"
                    >
                      {Math.ceil(amount)} {symbol}
                    </span>
                  ))}
                  {revertedTokens.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setTokensExpanded(!tokensExpanded)}
                      className="text-[10px] text-[#7EDFCD]"
                    >
                      {tokensExpanded ? "Show less" : `+${revertedTokens.length - 3} more`}
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {/* Total Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0D1B1B] rounded-lg p-2.5"
            >
              <TrendingUp className="w-3 h-3 text-gray-400 mb-1" />
              <p className="text-gray-400 text-[9px] font-medium mb-1 uppercase tracking-wide">
                Total Transactions
              </p>
              <p className="text-sm font-light text-white">
                {stats?.total_transactions || "0"}
              </p>
            </motion.div>

            {/* Subscription Type - Clickable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0D1B1B] rounded-lg p-2.5 cursor-pointer hover:bg-[#0F2020] transition-colors"
              onClick={() => handleSubscriptionClick()}
              onKeyDown={(e) => e.key === "Enter" && handleSubscriptionClick()}
              role="button"
              tabIndex={0}
              aria-label="View subscription options"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400 text-[9px] font-medium uppercase tracking-wide">
                    Subscription
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscriptionClick("weekly");
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-colors ${
                    activePlan === "weekly"
                      ? "bg-[#7EDFCD]/20 text-[#7EDFCD] border border-[#7EDFCD]/40"
                      : "bg-[#7EDFCD]/10 text-[#7EDFCD] border border-[#7EDFCD]/20 hover:bg-[#7EDFCD]/20"
                  }`}
                  aria-label="Select weekly plan"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activePlan === "weekly" ? "bg-[#7EDFCD]" : "bg-[#7EDFCD]/40"
                    }`}
                  />
                  Weekly $2.49
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscriptionClick("monthly");
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-colors ${
                    activePlan === "monthly"
                      ? "bg-[#7EDFCD]/20 text-[#7EDFCD] border border-[#7EDFCD]/40"
                      : "bg-[#7EDFCD]/10 text-[#7EDFCD] border border-[#7EDFCD]/20 hover:bg-[#7EDFCD]/20"
                  }`}
                  aria-label="Select monthly plan"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activePlan === "monthly" ? "bg-[#7EDFCD]" : "bg-[#7EDFCD]/40"
                    }`}
                  />
                  Monthly $5.99
                </button>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-1.5 cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500/40" />
                  Pay as you go
                </span>
              </div>
              <p className="text-[8px] text-gray-600 mt-1.5">
                * Pay as you go available only for Solana
              </p>
            </motion.div>
          </>
        )}
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showCheckout}
        onClose={handleBackToProfile}
        defaultBillingPeriod={activePlan || "monthly"}
      />
    </>
  );
}

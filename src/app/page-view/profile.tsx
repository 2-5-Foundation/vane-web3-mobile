"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  User,
  TrendingUp,
  DollarSign,
  CreditCard,
  ChevronRight,
  X,
  AlertCircle,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTransactionStore } from "../lib/useStore";
import { StorageExportManager } from "@/lib/vane_lib/main";
import { useTokenBalances } from "@dynamic-labs/sdk-react-core";
import { TokenBalance, ChainEnum } from "@dynamic-labs/sdk-api-core";
import {
  Token,
  getTokenDecimals,
  ChainSupported,
} from "@/lib/vane_lib/primitives";
import { getTokenLabel } from "./page-component/sender-pending";

// Map ChainSupported to networkId
const CHAIN_TO_NETWORK_ID: Record<ChainSupported, number> = {
  [ChainSupported.Ethereum]: 1,
  [ChainSupported.Polygon]: 137,
  [ChainSupported.Base]: 8453,
  [ChainSupported.Optimism]: 10,
  [ChainSupported.Arbitrum]: 42161,
  [ChainSupported.Bnb]: 56,
  [ChainSupported.Solana]: 101,
  [ChainSupported.Polkadot]: 0,
  [ChainSupported.Tron]: 0,
  [ChainSupported.Bitcoin]: 0,
};

const EVM_NETWORK_IDS = [1, 56, 10, 42161, 137, 8453];

export default function Profile() {
  const exportStorageData = useTransactionStore(
    (state) => state.exportStorageData,
  );
  const isWasmInitialized = useTransactionStore(
    (state) => state.isWasmInitialized,
  );
  const isWasmCorrupted = useTransactionStore((state) => state.isWasmCorrupted);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryNetworkId, setPrimaryNetworkId] = useState<number | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSubscriptionClick = () => {
    setShowCheckout(true);
  };

  const handleBackToProfile = () => {
    setShowCheckout(false);
  };

  // One-time cleanup of any persisted storage export to avoid reapplying corrupted data
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        !localStorage.getItem("vane-storage-export-cleared")
      ) {
        localStorage.removeItem("vane-storage-export");
        localStorage.setItem("vane-storage-export-cleared", "true");
        console.log(
          "Cleared persisted vane-storage-export once (profile page)",
        );
      }
    } catch (e) {
      console.warn("Unable to clear persisted storage export", e);
    }
  }, [isWasmInitialized]);

  useEffect(() => {
    if (isWasmInitialized()) {
      async function checkWasmCorrupted() {
        const isCorrupted = await isWasmCorrupted();
        if (isCorrupted) {
          return;
        }
      }
      checkWasmCorrupted();
    }
  }, [isWasmInitialized, isWasmCorrupted]);

  // Get token balances with network-specific parameters
  const tokenBalanceArgs = useMemo(() => {
    const base = { includeFiat: true, includeNativeBalance: true };
    if (primaryNetworkId === 101) return { ...base, chainName: ChainEnum.Sol };
    if (EVM_NETWORK_IDS.includes(primaryNetworkId!))
      return { ...base, chainName: ChainEnum.Evm, networkId: primaryNetworkId };
    return base;
  }, [primaryNetworkId]);

  const { tokenBalances } = useTokenBalances(tokenBalanceArgs);

  // Calculate USD value for a transaction
  const calculateTransactionValue = useCallback(
    (
      amount: bigint,
      token: Token,
      balances: TokenBalance[] | undefined,
    ): number => {
      if (!balances?.length) return 0;

      const tokenSymbol = getTokenLabel(token);
      if (!tokenSymbol) return 0;

      const balance = balances.find(
        (b) =>
          b.symbol?.toUpperCase() === tokenSymbol.toUpperCase() ||
          b.name?.toUpperCase() === tokenSymbol.toUpperCase(),
      );
      if (!balance) return 0;

      const decimals = balance.decimals || getTokenDecimals(token);
      const tokenAmount = Number(amount) / Math.pow(10, decimals);
      const pricePerToken =
        balance.price ||
        (balance.marketValue && balance.balance > 0
          ? balance.marketValue / balance.balance
          : 0);

      return tokenAmount * pricePerToken;
    },
    [],
  );

  // Load profile data and determine network
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!isWasmInitialized()) return;
        const storageExport = await exportStorageData();
        if (!storageExport) return;

        const storageManager = new StorageExportManager(storageExport);
        const metrics = storageManager.getSummary();
        const allTransactions = [
          ...(storageExport.failed_transactions || []),
          ...(storageExport.success_transactions || []),
        ];

        // Determine primary network (most common sender_network)
        if (allTransactions.length > 0 && !primaryNetworkId) {
          const networkCounts = new Map<ChainSupported, number>();
          allTransactions.forEach((tx) => {
            networkCounts.set(
              tx.sender_network,
              (networkCounts.get(tx.sender_network) || 0) + 1,
            );
          });

          const mostCommonNetwork = Array.from(networkCounts.entries()).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0];

          if (mostCommonNetwork) {
            const networkId = CHAIN_TO_NETWORK_ID[mostCommonNetwork];
            if (networkId) setPrimaryNetworkId(networkId);
          }
        }

        // Calculate transaction values
        const calculateValues = (
          transactions: typeof storageExport.failed_transactions,
        ) => {
          let total = 0;
          let largest = 0;
          transactions?.forEach((tx) => {
            const value = calculateTransactionValue(
              BigInt(tx.amount),
              tx.token,
              tokenBalances,
            );
            total += value;
            largest = Math.max(largest, value);
          });
          return { total, largest };
        };

        const failed = calculateValues(storageExport.failed_transactions);
        const success = calculateValues(storageExport.success_transactions);

        setStats({
          protected_amount: success.total,
          largest_recovery: success.largest,
          total_transactions: metrics.totalTransactions,
          total_volume: success.total + failed.total,
          failed_amount: failed.total,
        });
      } catch (error) {
        console.error("Error loading profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [
    exportStorageData,
    tokenBalances,
    calculateTransactionValue,
    primaryNetworkId,
    isWasmInitialized,
  ]);

  // Billing Toggle Component - isolated state to prevent parent re-renders
  const BillingToggle = () => {
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "weekly">(
      "monthly",
    );

    return (
      <div className="bg-[#0A1414] border border-white/5 rounded-lg p-3 space-y-3">
        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-1 p-1 bg-[#0D1B1B] rounded-lg">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              billingPeriod === "monthly"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            }`}
            aria-label="Select monthly billing"
            tabIndex={0}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("weekly")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              billingPeriod === "weekly"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            }`}
            aria-label="Select weekly billing"
            tabIndex={0}
          >
            Weekly
          </button>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-white font-medium text-2xl tracking-tight">
            {billingPeriod === "monthly" ? "$4.99" : "$1.49"}
          </span>
          <span className="text-[10px] text-gray-500">
            {billingPeriod === "monthly"
              ? "per month"
              : "per week"}
          </span>
        </div>

        {/* Description */}
        <p className="text-[9px] text-gray-600 leading-relaxed text-center">
          Coverage includes: All EVM networks, Tron, and Bitcoin.
        </p>
      </div>
    );
  };

  // Checkout Modal Component
  const CheckoutModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 bg-black/60 backdrop-blur-sm"
      onClick={handleBackToProfile}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm bg-[#0D1B1B] border border-white/10 rounded-xl overflow-hidden max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Image
              src="/vane-logo-icon.png"
              alt="Vane"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <button
              onClick={handleBackToProfile}
              className="text-gray-500 hover:text-white transition-colors p-1"
              aria-label="Close checkout"
              tabIndex={0}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1">
          {/* Video Container */}
          <div className="relative w-full rounded-xl overflow-hidden border border-white/20 shadow-lg" style={{ paddingTop: "56.25%" }}>
            <iframe
              src="https://customer-x258fyyk87tqur69.cloudflarestream.com/00c3840b7c9bbfef168ea93f59850292/iframe?preload=true&poster=https%3A%2F%2Fcustomer-x258fyyk87tqur69.cloudflarestream.com%2F00c3840b7c9bbfef168ea93f59850292%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600"
              loading="lazy"
              style={{ border: "none", position: "absolute", top: 0, left: 0, height: "100%", width: "100%" }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title="Vane security video"
            />
          </div>

          {/* Stats */}
          <div className="space-y-2">
            {/* $400K+ Stat */}
            <div className="p-3 bg-[#0A1414] rounded-lg border border-white/5">
              <AlertCircle className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-2xl font-semibold text-white tracking-tight">
                $400K+
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
                Lost daily to wrong-address and address-poisoning attacks
              </p>
            </div>

            {/* 1M+ Stat */}
            <div className="p-3 bg-[#0A1414] rounded-lg border border-white/5">
              <Globe className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-2xl font-semibold text-white tracking-tight">
                1M+
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
                Address-poisoning attempts occur daily across multiple networks
              </p>
            </div>
          </div>

          {/* Billing Toggle - Isolated Component */}
          <BillingToggle />

        </div>

        {/* Bottom CTA - Separate from scrollable content */}
        <div className="px-4 pb-4 pt-3 border-t border-white/10 bg-[#0D1B1B] space-y-2">
          <p className="text-[10px] text-gray-500 text-center">
            Vane is non-custodial. We never store your private keys.
          </p>
          <button
            className="w-full bg-[#7EDFCD] hover:bg-[#6BC9B7] text-[#0D1B1B] py-2.5 rounded-lg text-sm font-semibold transition-all"
            aria-label="Protect my transfers"
            tabIndex={0}
          >
            Protect My Transfers
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

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
              <div className="text-lg font-light text-white mb-2">
                ${stats?.protected_amount?.toLocaleString() || "0"}
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                <span className="text-gray-400">Largest Recovery:</span>
                <span className="text-gray-200 font-medium">
                  ${stats?.largest_recovery?.toLocaleString() || "0"}
                </span>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
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
                <p className="text-[9px] text-gray-500 mt-0.5">Last 30 days</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#0D1B1B] rounded-lg p-2.5"
              >
                <DollarSign className="w-3 h-3 text-gray-400 mb-1" />
                <p className="text-gray-400 text-[9px] font-medium mb-1 uppercase tracking-wide">
                  Total Volume
                </p>
                <p className="text-sm font-light text-white">
                  ${stats?.total_volume?.toLocaleString() || "0"}
                </p>
              </motion.div>
            </div>

            {/* Subscription Type - Clickable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0D1B1B] rounded-lg p-2.5 cursor-pointer hover:bg-[#0F2020] transition-colors"
              onClick={handleSubscriptionClick}
              onKeyDown={(e) => e.key === "Enter" && handleSubscriptionClick()}
              role="button"
              tabIndex={0}
              aria-label="View subscription options"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400 text-[9px] font-medium uppercase tracking-wide">
                    Subscription
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-300">
                    Protection plan
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Checkout Modal Overlay */}
      {showCheckout && <CheckoutModal />}
    </>
  );
}

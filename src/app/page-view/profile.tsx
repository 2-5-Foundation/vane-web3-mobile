"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  User,
  TrendingUp,
  CreditCard,
  ChevronRight,
  Settings,
  Wifi,
  Stethoscope,
  X,
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
  const userProfile = useTransactionStore(useShallow((state) => state.userProfile));
  const isWasmInitialized = useTransactionStore((state) => state.isWasmInitialized);
  const isWatchingUpdates = useTransactionStore((state) => state.isWatchingUpdates);
  const isWasmCorrupted = useTransactionStore((state) => state.isWasmCorrupted);
  const backendConnected = useTransactionStore((state) => state.backendConnected);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [activePlan, setActivePlan] = useState<"weekly" | "monthly" | null>(null);
  const [revertedTokens, setRevertedTokens] = useState<
    { symbol: string; amount: number }[]
  >([]);
  const [tokensExpanded, setTokensExpanded] = useState(false);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{
    ok: boolean;
    issues: string[];
  } | null>(null);
  const [diagnoseSendCopied, setDiagnoseSendCopied] = useState(false);
  const [combinedStatus, setCombinedStatus] = useState<{
    connectionOn: boolean;
    wasm:
      | { variant: "not_init" }
      | { variant: "healthy" }
      | { variant: "unhealthy" }
      | { variant: "error"; message: string };
  } | null>(null);

  const { tokenBalances } = useTokenBalances({
    includeFiat: true,
    includeNativeBalance: true,
  });

  const tokenBalancesRef = useRef(tokenBalances);
  tokenBalancesRef.current = tokenBalances;

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (!primaryWallet?.address || vaneAuth.length === 0) return;
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

  const getConnectionIsOn = (): boolean => {
    return backendConnected;
  };

  const collectDiagnosticIssues = useCallback(async (): Promise<string[]> => {
    const issues: string[] = [];
    if (!primaryWallet?.address) issues.push("No wallet connected.");
    if (vaneAuth.length === 0) issues.push("Vane authentication is not loaded.");
    if (!userProfile.account || !userProfile.network) {
      issues.push("User profile is incomplete (account or network missing).");
    }
    if (!process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL) {
      issues.push("Relay URL is not configured in the environment.");
    }
    if (!isWasmInitialized()) {
      issues.push(
        "WASM node is not initialized — open Wallets and complete setup.",
      );
    } else {
      try {
        const corrupted = await isWasmCorrupted();
        if (corrupted) {
          issues.push(
            "WASM health check failed — try refreshing the app.",
          );
        }
      } catch {
        issues.push("Could not complete WASM health check.");
      }
      if (!isWatchingUpdates) {
        issues.push("Live transaction updates are off.");
      }
    }
    return issues;
  }, [
    primaryWallet,
    vaneAuth,
    userProfile.account,
    userProfile.network,
    isWasmInitialized,
    isWatchingUpdates,
    isWasmCorrupted,
  ]);

  const handleRunStatusCheck = async () => {
    setStatusCheckLoading(true);
    setCombinedStatus(null);
    try {
      const connectionOn = getConnectionIsOn();
      if (!isWasmInitialized()) {
        setCombinedStatus({ connectionOn, wasm: { variant: "not_init" } });
        return;
      }
      const corrupted = await isWasmCorrupted();
      if (corrupted) {
        setCombinedStatus({ connectionOn, wasm: { variant: "unhealthy" } });
        return;
      }
      setCombinedStatus({ connectionOn, wasm: { variant: "healthy" } });
    } catch (error) {
      setCombinedStatus({
        connectionOn: getConnectionIsOn(),
        wasm: {
          variant: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } finally {
      setStatusCheckLoading(false);
    }
  };

  const buildDiagnoseSendPayload = (): string => {
    if (!diagnoseResult) return "";
    const header = `Vane Web3 — Diagnose\n${new Date().toISOString()}\n\n`;
    if (diagnoseResult.ok) return `${header}No issues detected.`;
    return `${header}${diagnoseResult.issues.map((i) => `• ${i}`).join("\n")}`;
  };

  const handleSendDiagnose = async () => {
    if (!diagnoseResult) return;
    const text = buildDiagnoseSendPayload();
    try {
      await navigator.clipboard.writeText(text);
      setDiagnoseSendCopied(true);
      window.setTimeout(() => setDiagnoseSendCopied(false), 2000);
    } catch {
      const subject = encodeURIComponent("Vane Web3 diagnose");
      const body = encodeURIComponent(text);
      window.open(`mailto:?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleSendDiagnoseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleSendDiagnose();
    }
  };

  const handleRunDiagnose = async () => {
    setDiagnoseLoading(true);
    setDiagnoseResult(null);
    setDiagnoseSendCopied(false);
    try {
      const issues = await collectDiagnosticIssues();
      setDiagnoseResult({ ok: issues.length === 0, issues });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  const settingsActionClass =
    "text-[10px] px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-400 border border-gray-600/25 hover:bg-gray-500/15 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-40";

  const settingsCloseButtonClass =
    "p-1 rounded-md text-gray-500 hover:text-gray-400 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25";

  const settingsSendTextClass =
    "inline-block text-[9px] font-medium text-[#7EDFCD]/90 hover:text-[#7EDFCD] px-0 pt-1 pb-0.5 text-left bg-transparent border-0 border-b-2 border-[#7EDFCD]/45 hover:border-[#7EDFCD] rounded-none cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7EDFCD]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0D1B1B]";

  const settingsCollapsiblePanelClass = "mt-1.5 pl-4 border-l border-white/[0.06]";

  const handleCloseConnectionPanel = () => {
    setCombinedStatus(null);
  };

  const handleCloseConnectionPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCloseConnectionPanel();
    }
  };

  const handleCloseDiagnosePanel = () => {
    setDiagnoseResult(null);
    setDiagnoseSendCopied(false);
  };

  const handleCloseDiagnosePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCloseDiagnosePanel();
    }
  };

  // Load profile data from store (tokenBalances via ref: Dynamic often returns a new array
  // reference every render, which would retrigger this effect infinitely if listed in deps.)
  useEffect(() => {
    setIsLoading(true);

    const balances = tokenBalancesRef.current;

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

    if (!balances?.length) {
      setStats({ protected_amount: 0, largest_recovery: 0, total_transactions: metricsTxList.length });
      setIsLoading(false);
      return;
    }

    let protectedAmount = 0;
    let largestRecovery = 0;

    for (const [symbol, amount] of Object.entries(tokenMap)) {
      const balance = balances.find(
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
  }, [metricsTxList]);

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
              Protected by VaneNetwork
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

            {/* Settings — same card shell as Total Transactions; no extra borders / teal frame */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-[#0D1B1B] rounded-lg p-2.5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-3 h-3 text-gray-400 shrink-0" aria-hidden />
                <p className="text-gray-400 text-[9px] font-medium uppercase tracking-wide leading-none">
                  Settings
                </p>
              </div>

              <div className="space-y-0 divide-y divide-white/[0.06]">
                {/* Connection + WASM */}
                <div className="pt-1 pb-2 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Wifi className="w-3 h-3 text-gray-500 shrink-0" aria-hidden />
                      <span className="text-[10px] text-gray-500 truncate">
                        Connection and WASM status
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRunStatusCheck()}
                      disabled={statusCheckLoading}
                      className={settingsActionClass}
                      aria-label="Run connection and WASM check"
                    >
                      {statusCheckLoading ? "…" : combinedStatus ? "Again" : "check"}
                    </button>
                  </div>
                  {(statusCheckLoading || combinedStatus) && (
                    <div className={settingsCollapsiblePanelClass}>
                      {!statusCheckLoading && combinedStatus && (
                        <div className="flex justify-end -mr-1 mb-1">
                          <button
                            type="button"
                            onClick={handleCloseConnectionPanel}
                            onKeyDown={handleCloseConnectionPanelKeyDown}
                            className={settingsCloseButtonClass}
                            aria-label="Hide connection and WASM details"
                          >
                            <X className="w-3 h-3" aria-hidden />
                          </button>
                        </div>
                      )}
                      {statusCheckLoading && (
                        <p className="text-[9px] text-gray-600">Checking…</p>
                      )}
                      {!statusCheckLoading && combinedStatus && (
                        <div className="space-y-1">
                          <p className="text-[9px] text-gray-500 leading-relaxed flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                combinedStatus.connectionOn
                                  ? "bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.2)]"
                                  : "bg-red-400 shadow-[0_0_0_2px_rgba(248,113,113,0.2)]"
                              }`}
                              aria-hidden
                            />
                            Connection: {combinedStatus.connectionOn ? "On" : "Off"}
                          </p>
                          <p className="text-[9px] text-gray-500 leading-relaxed flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                combinedStatus.wasm.variant === "healthy"
                                  ? "bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.2)]"
                                  : "bg-red-400 shadow-[0_0_0_2px_rgba(248,113,113,0.2)]"
                              }`}
                              aria-hidden
                            />
                            WASM:{" "}
                            {combinedStatus.wasm.variant === "healthy"
                              ? "Healthy"
                              : combinedStatus.wasm.variant === "not_init"
                                ? "Not initialized"
                                : combinedStatus.wasm.variant === "unhealthy"
                                  ? "Corrupted"
                                  : "Error"}
                          </p>
                          {!combinedStatus.connectionOn && (
                            <p className="text-[9px] text-gray-600 leading-relaxed">
                              Restart the page. If issue persists, send the diagnosis.
                            </p>
                          )}
                          {(combinedStatus.wasm.variant === "not_init" ||
                            combinedStatus.wasm.variant === "unhealthy") && (
                            <p className="text-[9px] text-gray-600 leading-relaxed">
                              Unlink and relink your wallet to reconnect.
                            </p>
                          )}
                          {combinedStatus.wasm.variant === "error" && (
                            <p className="text-[9px] text-gray-600 leading-relaxed break-words">
                              {combinedStatus.wasm.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Diagnose */}
                <div className="pt-2 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Stethoscope className="w-3 h-3 text-gray-500 shrink-0" aria-hidden />
                      <span className="text-[10px] text-gray-500 truncate">
                        diganose transaction issue
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRunDiagnose()}
                      disabled={diagnoseLoading}
                      className={settingsActionClass}
                      aria-label="Run diagnostics"
                    >
                      {diagnoseLoading ? "…" : diagnoseResult ? "Again" : "check"}
                    </button>
                  </div>
                  {(diagnoseLoading || diagnoseResult) && (
                    <div className={`${settingsCollapsiblePanelClass} space-y-1`}>
                      {!diagnoseLoading && diagnoseResult && (
                        <div className="flex justify-end -mr-1">
                          <button
                            type="button"
                            onClick={handleCloseDiagnosePanel}
                            onKeyDown={handleCloseDiagnosePanelKeyDown}
                            className={settingsCloseButtonClass}
                            aria-label="Hide diagnostics"
                          >
                            <X className="w-3 h-3" aria-hidden />
                          </button>
                        </div>
                      )}
                      {diagnoseLoading && (
                        <p className="text-[9px] text-gray-600">Running…</p>
                      )}
                      {!diagnoseLoading && diagnoseResult?.ok && (
                        <p className="text-[9px] text-gray-500 leading-relaxed">
                          No issues detected.
                        </p>
                      )}
                      {!diagnoseLoading && diagnoseResult && !diagnoseResult.ok && (
                        <ul className="space-y-1 list-none">
                          {diagnoseResult.issues.map((issue) => (
                            <li
                              key={issue}
                              className="text-[9px] text-gray-600 leading-relaxed"
                            >
                              {issue}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!diagnoseLoading && diagnoseResult && (
                        <div className="flex justify-start mt-2 pt-1 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => void handleSendDiagnose()}
                            onKeyDown={handleSendDiagnoseKeyDown}
                            className={settingsSendTextClass}
                            aria-label="Copy diagnose results"
                          >
                            {diagnoseSendCopied ? "Copied" : "Send"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
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

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import TransferForm from "../page-view/page-component/transfer-form";
import TransferReceive from "./page-component/transfer-receive";
import {
  useDynamicContext,
  useTokenBalances,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTransactionStore } from "@/app/lib/useStore";
import { useShallow } from "zustand/react/shallow";
import {
  Rocket,
  Download,
  TrendingUp,
  ArrowLeft,
  User,
  Send,
} from "lucide-react";
import { ChainEnum, TokenBalance } from "@dynamic-labs/sdk-api-core";
import { Button } from "@/components/ui/button";
import { getTokenDecimals } from "@/lib/vane_lib/primitives";
import { getTokenLabel } from "./page-component/sender-pending";

// Supported network IDs
const SOLANA_NETWORK_ID = 101;
const EVM_NETWORK_IDS = [1, 56, 10, 42161, 137, 8453]; // Ethereum, BNB, Optimism, Arbitrum, Polygon, Base

export default function Transfer() {
  const [activeTab, setActiveTab] = useState<"transfer" | "receive">(
    "transfer",
  );
  const [balance, setBalance] = useState("0");
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [currentNetworkId, setCurrentNetworkId] = useState<number | null>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferType, setTransferType] = useState<"self" | "external" | null>(
    null,
  );
  const [failedTransactionsValue, setFailedTransactionsValue] =
    useState<number>(0);
  const [failedTransactionCount, setFailedTransactionCount] =
    useState<number>(0);
  const [revertedTokens, setRevertedTokens] = useState<
    { symbol: string; amount: number }[]
  >([]);
  const [tokensExpanded, setTokensExpanded] = useState(false);

  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const metricsTxList = useTransactionStore(useShallow((s) => s.metricsTxList));
  const isWasmInitialized = useTransactionStore((s) => s.isWasmInitialized);
  const initializeWasm = useTransactionStore((s) => s.initializeWasm);
  const startWatching = useTransactionStore((s) => s.startWatching);
  const [isInitializing, setIsInitializing] = useState(false);
  const syncNetworkIdOnce = useCallback(async () => {
    if (!primaryWallet) return;

    try {
      const rawNetwork = await primaryWallet.getNetwork();
      let networkId = Number(rawNetwork);

      // If Dynamic returns a non-numeric value (e.g. "solana"), default to Ethereum (1)
      if (Number.isNaN(networkId)) {
        console.warn(
          "Non-numeric network from Dynamic, defaulting to Ethereum:",
          rawNetwork,
        );
        networkId = 1;
      }

      setCurrentNetworkId(networkId);
    } catch (error) {
      console.error("Error syncing network for balances:", error);
    }
  }, [primaryWallet]);

  // Get token balances with network-specific parameters (same pattern as total balance)
  // Get token balances with network-specific parameters (same pattern as total balance)
  const tokenBalanceArgs = useMemo(() => {
    const base = { includeFiat: true, includeNativeBalance: true };

    // If we don't have a network yet, fall back to default balances (usually Ethereum)
    if (!currentNetworkId) {
      return base;
    }

    // Solana
    if (currentNetworkId === SOLANA_NETWORK_ID) {
      return { ...base, chainName: ChainEnum.Sol };
    }

    // EVM chains: Ethereum (1), BNB (56), Optimism (10), Arbitrum (42161), Polygon (137), Base (8453)
    if (EVM_NETWORK_IDS.includes(currentNetworkId)) {
      return { ...base, chainName: ChainEnum.Evm, networkId: currentNetworkId };
    }

    // Fallback to base if unsupported
    return base;
  }, [currentNetworkId]);

  const { tokenBalances } = useTokenBalances(tokenBalanceArgs);

  useEffect(() => {
    if (tokenBalances === undefined) {
      // Keep previous balance while fetching
      return;
    }

    if (tokenBalances.length === 0) {
      setBalance("0");
      setAvailableTokens([]);
      return;
    }

    const totalValue = tokenBalances.reduce((sum: number, token: any) => {
      return sum + (token.marketValue || 0);
    }, 0);

    setBalance(totalValue.toString());
    setAvailableTokens(tokenBalances as any[]);
  }, [tokenBalances]);

  // Derive network ID from Dynamic SDK for token balances (with fallback)
  useEffect(() => {
    const syncNetworkId = async () => {
      if (!primaryWallet) {
        setCurrentNetworkId(null);
        return;
      }

      try {
        const rawNetwork = await primaryWallet.getNetwork();
        let networkId = Number(rawNetwork);

        if (Number.isNaN(networkId)) {
          console.warn(
            "Non-numeric network from Dynamic in poll, defaulting to Ethereum:",
            rawNetwork,
          );
          networkId = 1;
        }

        setCurrentNetworkId(networkId);
      } catch (error) {
        console.error("Error fetching network from Dynamic:", error);
      }
    };

    // Sync immediately when primaryWallet changes / component mounts
    syncNetworkId();

    // Poll for network changes (important for redirect mode where page may reload)
    const pollInterval = setInterval(() => {
      if (primaryWallet) {
        syncNetworkId();
      }
    }, 1500); // Poll every 1.5 seconds

    return () => clearInterval(pollInterval);
  }, [primaryWallet]);

  // Ensure current network is synced when wallet connects or form opens
  useEffect(() => {
    syncNetworkIdOnce();
  }, [primaryWallet, syncNetworkIdOnce]);

  // Calculate total value and count of reverted transactions from store
  useEffect(() => {
    if (!metricsTxList.length) {
      setFailedTransactionsValue(0);
      setFailedTransactionCount(0);
      setRevertedTokens([]);
      return;
    }

    const revertedTxs = metricsTxList.filter((tx) => tx.status?.type === "Reverted");
    setFailedTransactionCount(revertedTxs.length);

    if (!revertedTxs.length) {
      setFailedTransactionsValue(0);
      setRevertedTokens([]);
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

    // Calculate USD value if tokenBalances available
    if (!tokenBalances?.length) {
      setFailedTransactionsValue(0);
      return;
    }

    let totalValue = 0;
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
        totalValue += amount * pricePerToken;
      }
    }

    setFailedTransactionsValue(totalValue);
  }, [metricsTxList, tokenBalances]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-2 px-4 max-w-sm mx-auto"
    >
      {/* Balance Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1 mb-3"
      >
        <p className="text-gray-400 text-xs font-medium">
          Total Available Balance
        </p>
        <p className="text-2xl font-light text-white">
          ${parseFloat(balance).toFixed(4)}
        </p>
      </motion.div>

      {/* Tabs */}
      <Tabs
        defaultValue="transfer"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="mb-6"
      >
        <TabsList className="grid grid-cols-2 bg-[#1a2628] p-0.5 h-auto">
          <TabsTrigger
            value="transfer"
            className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
          >
            <Rocket className="h-4 w-4" /> Transfer
          </TabsTrigger>
          <TabsTrigger
            value="receive"
            className="flex items-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
          >
            <Download className="h-4 w-4" /> Verifiable Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="mt-4">
          {!showTransferForm ? (
            <div className="space-y-4">
              {/* Selection Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#0D1B1B] rounded-lg p-4 flex flex-col space-y-3"
              >
                <TrendingUp className="w-3 h-3 text-gray-400 mb-1" />
                <p className="text-gray-300 text-base font-medium mb-1 tracking-wide">
                  Total funds protected by Vane
                </p>
                <p className="text-xs text-gray-500">
                  These funds could have been lost due to transactional
                  mistakes.
                </p>
                {revertedTokens.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {(tokensExpanded ? revertedTokens : revertedTokens.slice(0, 3)).map(({ symbol, amount }) => (
                      <span
                        key={symbol}
                        className="text-xs bg-[#1a2628] text-gray-300 px-2 py-1 rounded"
                      >
                        {Math.ceil(amount)} {symbol}
                      </span>
                    ))}
                    {revertedTokens.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setTokensExpanded(!tokensExpanded)}
                        className="text-xs text-[#7EDFCD]"
                      >
                        {tokensExpanded ? "Show less" : `+${revertedTokens.length - 3} more`}
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-end">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-400">Safe Reverts</p>
                    <p className="text-lg font-light text-gray-300">
                      {failedTransactionCount}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    // Check if wallet list has more than 1 wallet
                    if (userWallets.length <= 1) {
                      toast.error("Wallet linked should be more than 1");
                      return;
                    }

                    await syncNetworkIdOnce();
                    setTransferType("self");
                    setShowTransferForm(true);

                    // Initialize node once (skip if already initialized)
                    if (
                      !isWasmInitialized() &&
                      primaryWallet &&
                      !isInitializing
                    ) {
                      setIsInitializing(true);
                      try {
                        await initializeWasm(
                          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
                          primaryWallet.address,
                          primaryWallet.chain,
                          false, // self_node: false for now
                          true, // live: true
                        );
                        await startWatching();
                      } catch (error) {
                        console.error("Failed to initialize node:", error);
                      } finally {
                        setIsInitializing(false);
                      }
                    }
                  }}
                  className="flex-1 h-20 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg text-xs font-medium ml-2 flex flex-col items-center justify-center gap-1"
                >
                  <User className="h-5 w-5" />
                  Safe Self Transfer
                </Button>
                <Button
                  onClick={async () => {
                    await syncNetworkIdOnce();
                    setTransferType("external");
                    setShowTransferForm(true);

                    // Initialize node once (skip if already initialized)
                    if (
                      !isWasmInitialized() &&
                      primaryWallet &&
                      !isInitializing
                    ) {
                      setIsInitializing(true);
                      try {
                        await initializeWasm(
                          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
                          primaryWallet.address,
                          primaryWallet.chain,
                          false, // self_node: false
                          true, // live: true
                        );
                        await startWatching();
                      } catch (error) {
                        console.error("Failed to initialize node:", error);
                      } finally {
                        setIsInitializing(false);
                      }
                    }
                  }}
                  className="flex-1 h-20 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg text-xs font-medium mr-2 flex flex-col items-center justify-center gap-1"
                >
                  <Send className="h-5 w-5" />
                  Safe External Transfer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Back Button with Breadcrumb */}
              <Button
                onClick={() => {
                  setShowTransferForm(false);
                  setTransferType(null);
                }}
                variant="ghost"
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-2 p-0 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs">
                  Transfer {transferType && ">"}{" "}
                  {transferType === "self"
                    ? "Self Transfer"
                    : transferType === "external"
                      ? "External Transfer"
                      : ""}
                </span>
              </Button>
              <TransferForm
                tokenList={availableTokens}
                transferType={transferType}
                userWallets={userWallets}
                onNetworkChange={(id) => setCurrentNetworkId(id)}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="receive" className="mt-4">
          <TransferReceive />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

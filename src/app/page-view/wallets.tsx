"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useDynamicContext,
  useUserWallets,
  IsBrowser,
  useWalletConnectorEvent,
  useDynamicModals,
  DynamicMultiWalletPromptsWidget,
  useSwitchWallet,
} from "@dynamic-labs/sdk-react-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTransactionStore } from "@/app/lib/useStore";
import { Copy, Plus, X, MoreVertical, Settings, Wifi, Stethoscope } from "lucide-react";
import Image from "next/image";
import { signClientAuth } from "../actions/verificationAction";
import { fetchTxJsonBySender } from "../actions/txActions";

export default function Wallets() {
  const { primaryWallet, handleLogOut, removeWallet, setShowAuthFlow } =
    useDynamicContext();
  const userWallets = useUserWallets();
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const switchWallet = useSwitchWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [longPressedWallet, setLongPressedWallet] = useState<string | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpenWallet, setMenuOpenWallet] = useState<string | null>(null);
  const isWasmInitialized = useTransactionStore((s) => s.isWasmInitialized);
  const initializeWasm = useTransactionStore((s) => s.initializeWasm);
  const startWatching = useTransactionStore((s) => s.startWatching);
  const addAccount = useTransactionStore((s) => s.addAccount);
  const setUserProfile = useTransactionStore((s) => s.setUserProfile);
  const setVaneAuth = useTransactionStore((s) => s.setVaneAuth);
  const setMetricsTxList = useTransactionStore((s) => s.setMetricsTxList);
  const captureTrackerContext = useTransactionStore((s) => s.captureTrackerContext);
  const recordTrackerEvent = useTransactionStore((s) => s.recordTrackerEvent);
  const userProfile = useTransactionStore((s) => s.userProfile);
  const exportStorageData = useTransactionStore((s) => s.exportStorageData);
  const vaneAuth = useTransactionStore((s) => s.vaneAuth);
  const isWatchingUpdates = useTransactionStore((s) => s.isWatchingUpdates);
  const isWasmCorrupted = useTransactionStore((s) => s.isWasmCorrupted);
  const backendConnected = useTransactionStore((s) => s.backendConnected);
  const txTracker = useTransactionStore((s) => s.txTracker);
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

  // Hard reload app function - reloads page when all wallets are unlinked
  const hardReloadApp = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);
  const [isInitializing, setIsInitializing] = useState(false);
  const prevWalletsRef = useRef<Set<string>>(new Set());
  const hasCheckedStorageRef = useRef<boolean>(false);

  const handleWalletSelect = async (address: string) => {
    // Check if this wallet is already the primary wallet
    if (primaryWallet && primaryWallet.address === address) {
      // Already selected, don't do anything
      return;
    }

    // Find the wallet by address
    const targetWallet = userWallets.find((w) => w.address === address);
    if (!targetWallet) {
      toast.error("Wallet not found");
      return;
    }

    // Double-check we're not already on this wallet
    if (primaryWallet && primaryWallet.id === targetWallet.id) {
      return;
    }

    try {
      // Switch to the selected wallet using its ID
      await switchWallet(targetWallet.id);
      recordTrackerEvent("wallet_connection", {
        stage: "wallet selected",
        success: true,
        details: `wallet_selected:${targetWallet.connector?.name ?? "unknown"}:${targetWallet.address}`,
      });
      // update the user profile
      setUserProfile({
        account: targetWallet.address,
        network: targetWallet.chain,
      });
      // Note: primaryWallet will update via useEffect when Dynamic SDK updates it
    } catch (error) {
      recordTrackerEvent("wallet_connection", {
        stage: "wallet selected",
        success: false,
        details: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to switch wallet");
      console.error("Switch wallet error:", error);
    }
  };

  const handleLinkNewWallet = async () => {
    recordTrackerEvent("wallet_connection", {
      stage: "wallet link requested",
      success: true,
      details: "link_new_wallet_clicked",
    });
    setShowLinkNewWalletModal(true);
    // Note: addAccount will be called automatically via useEffect when new wallet is detected
  };

  const handleCopyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const handleDisconnectWallet = async (
    walletId: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setLongPressedWallet(null);
    setMenuOpenWallet(null);

    const walletToRemove = userWallets.find((w) => w.id === walletId);

    if (!walletToRemove) {
      toast.error("Wallet not found");
      return;
    }

    const isPrimaryWallet =
      primaryWallet && walletToRemove.address === primaryWallet.address;

    try {
      // If it's the primary wallet, disconnect first using handleLogOut
      if (isPrimaryWallet && handleLogOut) {
        try {
          await handleLogOut();
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (disconnectError) {
          toast.error("Failed to disconnect primary wallet");
          return;
        }
      }

      // For non-primary wallets or after primary disconnect, remove the wallet
      if (!removeWallet) {
        toast.error("Remove wallet function not available");
        return;
      }

      // Remove the wallet by ID
      await removeWallet(walletId);
      recordTrackerEvent("wallet_connection", {
        stage: "wallet unlinked",
        success: true,
        details: `wallet_unlinked:${walletToRemove.connector?.name ?? "unknown"}:${walletToRemove.address}`,
      });

      // Check if wallet was removed
      const checkInterval = setInterval(() => {
        if (!userWallets.find((w) => w.id === walletId)) {
          clearInterval(checkInterval);
          toast.success("Wallet unlinked successfully");
        }
      }, 200);

      // Stop checking after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (userWallets.find((w) => w.id === walletId)) {
          toast.error(
            "Wallet removal may have failed. Please refresh the page.",
          );
        }
      }, 5000);
    } catch (error) {
      recordTrackerEvent("wallet_connection", {
        stage: "wallet unlinked",
        success: false,
        details: error instanceof Error ? error.message : String(error),
      });
      toast.error(
        `Failed to unlink wallet: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handleLongPressStart = (walletId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedWallet(walletId);
    }, 500); // 500ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (longPressedWallet) {
        const target = e.target as HTMLElement;
        // Check if click is outside the tooltip
        if (!target.closest("[data-tooltip]")) {
          setLongPressedWallet(null);
        }
      }
      if (menuOpenWallet) {
        const target = e.target as HTMLElement;
        // Check if click is outside the menu
        if (!target.closest("[data-menu]")) {
          setMenuOpenWallet(null);
        }
      }
    };

    if (longPressedWallet || menuOpenWallet) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [longPressedWallet, menuOpenWallet]);

  // Sync selected wallet and user profile when primary wallet changes
  // Hard reload app when primary wallet is disconnected (all wallets unlinked)
  useEffect(() => {
    if (primaryWallet) {
      void captureTrackerContext({
        walletName: primaryWallet.connector?.name ?? "unknown",
        walletAddress: primaryWallet.address,
        walletConnected: true,
        networkInfo: primaryWallet.chain,
      });
      recordTrackerEvent("wallet_connection", {
        stage: "wallet connected",
        success: true,
        details: `primary_wallet_connected:${primaryWallet.connector?.name ?? "unknown"}:${primaryWallet.address}`,
      });
      setSelectedWallet(primaryWallet.address);
      setUserProfile({
        account: primaryWallet.address,
        network: primaryWallet.chain,
      });
      console.log("Primary wallet updated:", primaryWallet.address);
      return;
    }

    recordTrackerEvent("wallet_connection", {
      stage: "wallet disconnected",
      success: true,
      details: "primary_wallet_disconnected",
    });
    // Clear profile when no primary wallet
    setSelectedWallet(null);
    setUserProfile({
      account: "",
      network: "",
    });

    // If WASM is initialized but no primary wallet (all wallets unlinked), hard reload app
    if (isWasmInitialized()) {
      console.log("Primary wallet disconnected, hard reloading app...");
      hardReloadApp();
    }
  }, [
    primaryWallet,
    setUserProfile,
    isWasmInitialized,
    hardReloadApp,
    captureTrackerContext,
    recordTrackerEvent,
  ]);

  useWalletConnectorEvent(
    primaryWallet?.connector,
    "accountChange",
    ({ accounts }, connector) => {},
  );

  // Initialize prevWalletsRef on mount to avoid treating existing wallets as new
  useEffect(() => {
    if (prevWalletsRef.current.size === 0 && userWallets.length > 0) {
      prevWalletsRef.current = new Set(userWallets.map((w) => w.address));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect new wallets and call addAccount (only when a new wallet is actually added)
  useEffect(() => {
    const checkAndAddNewWallets = async () => {
      if (!isWasmInitialized() || !userProfile.network) return;

      const currentWalletAddresses = new Set(userWallets.map((w) => w.address));
      const prevWalletAddresses = prevWalletsRef.current;

      // Find new wallets (only those not in previous set)
      const newWallets = userWallets.filter(
        (w) => !prevWalletAddresses.has(w.address),
      );

      if (newWallets.length > 0) {
        try {
          // Fetch storage to check if accounts are already registered
          const storage = await exportStorageData();

          // Get registered accounts from storage
          const registeredAccounts = new Set<string>();
          if (storage?.user_account?.accounts) {
            storage.user_account.accounts.forEach(([address]) => {
              registeredAccounts.add(address.toLowerCase());
            });
          }

          // Call addAccount only for wallets not already in storage
          for (const wallet of newWallets) {
            const walletAddressLower = wallet.address.toLowerCase();
            if (!registeredAccounts.has(walletAddressLower)) {
              try {
                await addAccount(wallet.address, userProfile.network);
              } catch (error) {
                console.error("Error adding account:", error);
              }
            } else {
              console.log(
                `Account ${wallet.address} already registered in storage, skipping`,
              );
            }
          }
        } catch (error) {
          console.error("Error fetching storage data:", error);
          // If storage fetch fails, still try to add accounts (fallback behavior)
          for (const wallet of newWallets) {
            try {
              await addAccount(wallet.address, userProfile.network);
            } catch (addError) {
              console.error("Error adding account:", addError);
            }
          }
        }

        // Update ref after processing new wallets
        prevWalletsRef.current = currentWalletAddresses;
      }
    };

    checkAndAddNewWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWallets, userProfile.network]);

  // Check storage and register missing accounts after node is connected (runs only once)
  useEffect(() => {
    const checkAndRegisterAccounts = async () => {
      // Only run if WASM is initialized and we haven't checked yet
      console.log("Checking storage and registering accounts");
      if (
        !isWasmInitialized() ||
        hasCheckedStorageRef.current ||
        userWallets.length === 0
      ) {
        return;
      }
      console.log("Checking storage and registering accounts 2");

      // Mark as checked immediately to prevent concurrent runs
      hasCheckedStorageRef.current = true;

      try {
        // Fetch storage data
        const storage = await exportStorageData();

        if (!storage) {
          console.log("No storage data found, registering all wallets");
          // If no storage, register all wallets
          for (const wallet of userWallets) {
            try {
              await addAccount(wallet.address, wallet.chain);
            } catch (error) {
              console.error(`Error adding account ${wallet.address}:`, error);
            }
          }
          return;
        }

        // Get registered accounts from storage
        const registeredAccounts = new Set<string>();
        if (storage.user_account?.accounts) {
          storage.user_account.accounts.forEach(([address]) => {
            registeredAccounts.add(address.toLowerCase());
          });
        }

        // Check each wallet and register if not in storage
        for (const wallet of userWallets) {
          const walletAddressLower = wallet.address.toLowerCase();
          if (!registeredAccounts.has(walletAddressLower)) {
            try {
              console.log(
                `Registering missing account: ${wallet.address} on ${wallet.chain}`,
              );
              await addAccount(wallet.address, wallet.chain);
            } catch (error) {
              console.error(`Error adding account ${wallet.address}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error checking storage for accounts:", error);
        // Reset the ref on error so it can be retried
        hasCheckedStorageRef.current = false;
      }
    };

    checkAndRegisterAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWasmInitialized(), userWallets.length]);

  const handleConnectWallet = () => {
    recordTrackerEvent("wallet_connection", {
      stage: "wallet connect requested",
      success: true,
      details: "connect_wallet_clicked",
    });
    setShowAuthFlow(true);
  };

  const getConnectionIsOn = (): boolean => backendConnected;

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
          issues.push("WASM health check failed — try refreshing the app.");
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
      if (vaneAuth.length === 0) {
        setCombinedStatus({ connectionOn: false, wasm: { variant: "unhealthy" } });
        return;
      }
      if (!isWasmInitialized()) {
        setCombinedStatus({ connectionOn, wasm: { variant: "not_init" } });
        return;
      }
      const corrupted = await isWasmCorrupted();
      if (corrupted) {
        setCombinedStatus({ connectionOn: false, wasm: { variant: "unhealthy" } });
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
    console.log("[tx-tracker] full tracking snapshot", txTracker);
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

  // Initialize WASM when wallet is connected and WASM is not initialized
  useEffect(() => {
    const initializeWasmOnWalletConnect = async () => {
      if (!primaryWallet || isWasmInitialized() || isInitializing) {
        return;
      }

      setIsInitializing(true);
      try {
        const vaneAuth = await signClientAuth(primaryWallet.address);
        setVaneAuth(vaneAuth);

        // Fetch metrics tx list
        const txResult = await fetchTxJsonBySender(primaryWallet.address);
        if (txResult.success) setMetricsTxList(txResult.txList);

        await initializeWasm(
          process.env.NEXT_PUBLIC_VANE_RELAY_NODE_URL!,
          primaryWallet.address,
          primaryWallet.chain,
          false, // self_node: false (default for wallet connection)
          true, // live: true
        );
        await startWatching();
        console.log("WASM initialized after wallet connection");
      } catch (error) {
        console.error(
          "Failed to initialize WASM after wallet connection:",
          error,
        );
      } finally {
        setIsInitializing(false);
      }
    };

    initializeWasmOnWalletConnect();
  }, [
    primaryWallet,
    isWasmInitialized,
    initializeWasm,
    startWatching,
    isInitializing,
    setVaneAuth,
    setMetricsTxList
  ]);

  return (
    <IsBrowser>
      <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
        {/* Link Wallet */}
        <div className="mb-4 flex items-center justify-start">
          <Button
            onClick={handleLinkNewWallet}
            disabled={!primaryWallet}
            className={`bg-transparent border text-white rounded-lg px-3 py-1 h-7 text-xs font-bold flex items-center gap-1.5 transition-all duration-150 ${
              !primaryWallet
                ? "border-[#4A5853] text-[#4A5853] cursor-not-allowed opacity-50"
                : "border-[#7EDFCD] hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black"
            }`}
          >
            <Plus className="h-2.5 w-2.5 stroke-[2.5]" />
            Link New Wallet
          </Button>
        </div>

        {/* Select Wallet Section */}
        <div className="space-y-3">
          <div className="space-y-2">
            <RadioGroup
              value={primaryWallet?.address || undefined}
              onValueChange={handleWalletSelect}
            >
              {userWallets.map((wallet) => (
                <div key={wallet.address} className="relative">
                  <Card
                    className="bg-[#0D1B1B] border-transparent relative cursor-pointer active:bg-[#0D1B1B]/80 transition-colors"
                    onMouseDown={() => handleLongPressStart(wallet.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(wallet.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem
                          checked={primaryWallet?.address === wallet.address}
                          value={wallet.address}
                          id={wallet.address}
                          className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                          onClick={(e) => {
                            if (
                              longPressedWallet === wallet.id ||
                              menuOpenWallet === wallet.id
                            ) {
                              e.stopPropagation();
                            }
                            // Debug: Log what's being clicked vs what's primary
                            console.log("RadioGroupItem clicked:", {
                              clickedAddress: wallet.address,
                              primaryWalletAddress: primaryWallet?.address,
                            });
                          }}
                        />
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {wallet.connector?.metadata?.icon ? (
                              <Image
                                src={wallet.connector.metadata.icon}
                                alt={wallet.connector?.name || "Wallet icon"}
                                width={20}
                                height={20}
                                className="rounded"
                                unoptimized
                              />
                            ) : (
                              <span className="text-white text-sm">
                                {wallet.connector?.name || "Unknown"}
                              </span>
                            )}
                            <span className="text-[#4A5853] text-xs">
                              {wallet.address.slice(0, 13)}...
                              {wallet.address.slice(-13)}
                            </span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenWallet(
                                  menuOpenWallet === wallet.id
                                    ? null
                                    : wallet.id,
                                );
                              }}
                              className="h-4 w-4 flex items-center justify-center hover:bg-[#4A5853]/20 rounded transition-colors flex-shrink-0"
                              aria-label="Wallet options"
                              tabIndex={0}
                            >
                              <MoreVertical className="h-3 w-3 text-[#7EDFCD]" />
                            </button>

                            {/* Menu Dropdown */}
                            {menuOpenWallet === wallet.id && (
                              <div
                                data-menu
                                className="absolute right-0 top-6 z-30 bg-[#0D1B1B] border border-[#4A5853]/40 rounded-xl shadow-xl min-w-[160px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    handleCopyAddress(wallet.address, e);
                                    setMenuOpenWallet(null);
                                  }}
                                  className="w-full text-left text-white hover:bg-[#7EDFCD]/40 hover:text-black text-sm font-medium px-4 py-2.5 first:rounded-t-xl transition-all duration-200 flex items-center gap-2.5"
                                  aria-label="Copy address"
                                >
                                  <Copy className="h-4 w-4 text-[#7EDFCD]" />
                                  Copy address
                                </button>
                                <button
                                  onClick={(e) => {
                                    handleDisconnectWallet(wallet.id, e);
                                    setMenuOpenWallet(null);
                                  }}
                                  className="w-full text-left text-red-400 hover:text-red-500 hover:bg-[#7EDFCD]/30 text-sm font-medium px-4 py-2.5 last:rounded-b-xl transition-all duration-200 flex items-center gap-2.5"
                                  aria-label="Unlink wallet"
                                >
                                  <X className="h-4 w-4" />
                                  Unlink wallet
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Long Press Tooltip - Disconnect Button */}
                  {longPressedWallet === wallet.id && (
                    <div
                      data-tooltip
                      className="absolute -top-9 right-0 z-20 bg-[#0D1B1B] border border-red-500/60 rounded-md shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleDisconnectWallet(wallet.id, e)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[10px] font-medium px-2.5 py-1.5 rounded transition-colors"
                        aria-label="Unlink wallet"
                      >
                        Unlink
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </RadioGroup>

            {!primaryWallet && (
              <Button
                type="button"
                onClick={handleConnectWallet}
                className="w-full h-10 bg-transparent border border-[#7EDFCD] text-white hover:bg-[#7EDFCD]/10 active:bg-[#7EDFCD] active:text-black active:scale-[0.92] active:translate-y-0.5 active:shadow-inner transition-all duration-150 rounded-lg"
              >
                Connect Wallet
              </Button>
            )}

          </div>
        </div>
        <div className="bg-[#0D1B1B] rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-3 h-3 text-gray-400 shrink-0" aria-hidden />
            <p className="text-gray-400 text-[9px] font-medium uppercase tracking-wide leading-none">
              Diagnosis
            </p>
          </div>
          <p className="text-[9px] text-gray-500 leading-relaxed mb-2">
            Your funds are always safe with Vane in your wallet. These diagnostics help identify app issues like missing updates or delayed notifications — they only analyze performance, never touch your funds.
          </p>
          <div className="relative h-[2px] mb-2">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4A5853]/25 to-transparent" />
          </div>

          <div className="space-y-0 divide-y divide-white/[0.06]">
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
                              ? "Disconnected"
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
        </div>
        <DynamicMultiWalletPromptsWidget />
      </div>
    </IsBrowser>
  );
}

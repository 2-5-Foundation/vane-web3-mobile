"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User, Shield, TrendingUp, DollarSign, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { useTransactionStore } from "../lib/useStore";
import { StorageExportManager } from "@/lib/vane_lib/main";
import { useTokenBalances } from '@dynamic-labs/sdk-react-core';
import { TokenBalance, ChainEnum } from "@dynamic-labs/sdk-api-core";
import { Token, getTokenDecimals, ChainSupported } from "@/lib/vane_lib/primitives";
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
  const { exportStorageData, isWasmInitialized } = useTransactionStore();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryNetworkId, setPrimaryNetworkId] = useState<number | null>(null);

  // One-time cleanup of any persisted storage export to avoid reapplying corrupted data
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('vane-storage-export-cleared')) {
        localStorage.removeItem('vane-storage-export');
        localStorage.setItem('vane-storage-export-cleared', 'true');
        console.log('Cleared persisted vane-storage-export once (profile page)');
      }
    } catch (e) {
      console.warn('Unable to clear persisted storage export', e);
    }
  }, [isWasmInitialized]);

  // Get token balances with network-specific parameters
  const tokenBalanceArgs = useMemo(() => {
    const base = { includeFiat: true, includeNativeBalance: true };
    if (primaryNetworkId === 101) return { ...base, chainName: ChainEnum.Sol };
    if (EVM_NETWORK_IDS.includes(primaryNetworkId!)) return { ...base, chainName: ChainEnum.Evm, networkId: primaryNetworkId };
    return base;
  }, [primaryNetworkId]);

  const { tokenBalances } = useTokenBalances(tokenBalanceArgs);

  // Calculate USD value for a transaction
  const calculateTransactionValue = useCallback((amount: bigint, token: Token, balances: TokenBalance[] | undefined): number => {
    if (!balances?.length) return 0;

    const tokenSymbol = getTokenLabel(token);
    if (!tokenSymbol) return 0;

    const balance = balances.find(b => 
      b.symbol?.toUpperCase() === tokenSymbol.toUpperCase() || 
      b.name?.toUpperCase() === tokenSymbol.toUpperCase()
    );
    if (!balance) return 0;

    const decimals = balance.decimals || getTokenDecimals(token);
    const tokenAmount = Number(amount) / Math.pow(10, decimals);
    const pricePerToken = balance.price || (balance.marketValue && balance.balance > 0 ? balance.marketValue / balance.balance : 0);
    
    return tokenAmount * pricePerToken;
  }, []);

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
          ...(storageExport.success_transactions || [])
        ];

        // Determine primary network (most common sender_network)
        if (allTransactions.length > 0 && !primaryNetworkId) {
          const networkCounts = new Map<ChainSupported, number>();
          allTransactions.forEach(tx => {
            networkCounts.set(tx.sender_network, (networkCounts.get(tx.sender_network) || 0) + 1);
          });
          
          const mostCommonNetwork = Array.from(networkCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0];
          
          if (mostCommonNetwork) {
            const networkId = CHAIN_TO_NETWORK_ID[mostCommonNetwork];
            if (networkId) setPrimaryNetworkId(networkId);
          }
        }

        // Calculate transaction values
        const calculateValues = (transactions: typeof storageExport.failed_transactions) => {
          let total = 0;
          let largest = 0;
          transactions?.forEach(tx => {
            const value = calculateTransactionValue(BigInt(tx.amount), tx.token, tokenBalances);
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
          failed_amount: failed.total
        });
      } catch (error) {
        console.error('Error loading profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [exportStorageData, tokenBalances, calculateTransactionValue, primaryNetworkId, isWasmInitialized]);

  return (
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
          <p className="text-xs text-gray-400 font-medium">Protected by VaneWeb3</p>
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
              <Shield className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Protected & Recovered</span>
            </div>
            <div className="text-lg font-light text-white mb-2">
              ${stats?.protected_amount?.toLocaleString() || '0'}
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
              <span className="text-gray-400">Largest Recovery:</span>
              <span className="text-gray-200 font-medium">${stats?.largest_recovery?.toLocaleString() || '0'}</span>
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
              <p className="text-gray-400 text-[9px] font-medium mb-1 uppercase tracking-wide">Total Transactions</p>
              <p className="text-sm font-light text-white">{stats?.total_transactions || '0'}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Last 30 days</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0D1B1B] rounded-lg p-2.5"
            >
              <DollarSign className="w-3 h-3 text-gray-400 mb-1" />
              <p className="text-gray-400 text-[9px] font-medium mb-1 uppercase tracking-wide">Total Volume</p>
              <p className="text-sm font-light text-white">${stats?.total_volume?.toLocaleString() || '0'}</p>
            </motion.div>
          </div>

          {/* Subscription Type */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#0D1B1B] rounded-lg p-2.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400 text-[9px] font-medium uppercase tracking-wide">Subscription</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-sm font-medium text-white">
                Pay as you go
              </span>
            </div>
            <div className="mt-1">
              <p className="text-[9px] text-gray-500">
                $0.1 per protected transaction
              </p>
              <p className="text-[9px] text-gray-500 mt-0.5">
                Current plan: Free
              </p>
            </div>
          </motion.div>

        </>
      )}
    </div>
  );
}

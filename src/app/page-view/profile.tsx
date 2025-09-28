"use client"

import React, { useState, useEffect } from "react";
import { User, Shield, TrendingUp, DollarSign, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionType, setSubscriptionType] = useState('monthly');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      // Mock data for now - replace with actual API calls
      const mockStats = {
        protected_amount: 127.5,
        largest_recovery: 45,
        total_transactions: 12,
        total_volume: 1250.75
      };
      setStats(mockStats);
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-sm font-medium text-white">Anonymous User</h2>
          <p className="text-xs text-gray-400 font-medium">Protected by VaneWeb3</p>
        </div>
      </div>

      {!isLoading && (
        <>
          {/* Protected & Recovered Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="glass-pane rounded-lg p-3"
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
              className="glass-pane rounded-lg p-2.5"
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
              className="glass-pane rounded-lg p-2.5"
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
            className="glass-pane rounded-lg p-2.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400 text-[9px] font-medium uppercase tracking-wide">Subscription</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${subscriptionType === 'monthly' ? 'bg-[#7EDFCD]' : 'bg-gray-500'}`}></div>
                <span className="text-sm font-medium text-white">
                  {subscriptionType === 'monthly' ? 'Monthly Plan' : 'Pay as you go'}
                </span>
              </div>
              <button 
                onClick={() => setSubscriptionType(subscriptionType === 'monthly' ? 'paygo' : 'monthly')}
                className="text-xs text-[#7EDFCD] hover:text-[#7EDFCD]/80 transition-colors"
              >
                Switch
              </button>
            </div>
            <div className="mt-1">
              <p className="text-[9px] text-gray-500">
                {subscriptionType === 'monthly' 
                  ? 'Unlimited transactions • $9.99/month' 
                  : 'Pay per transaction • $0.50 per transfer'
                }
              </p>
            </div>
          </motion.div>

        </>
      )}
    </div>
  );
}

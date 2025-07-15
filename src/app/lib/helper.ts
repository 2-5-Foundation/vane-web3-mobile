'use client'

import { useEffect, useRef } from "react";
import { useTransactionStore } from "./useStore";

export const useInitializeWebSocket = () => {
    const wsUrl = useTransactionStore(state => state.wsUrl);
    const vaneClient = useTransactionStore(state => state.vaneClient);
    const isWebSocketConnected = useTransactionStore(state => state.isWebSocketConnected);
    const watchPendingTxUpdates = useTransactionStore(state => state.watchPendingTxUpdates);
    
    // Use ref to track if we've already attempted connection
    const hasAttemptedConnection = useRef(false);
  
    useEffect(() => {
        // Only attempt connection if:
        // 1. We have a WebSocket URL
        // 2. We're not already connected
        // 3. We haven't already attempted connection in this render cycle
        if (wsUrl && !isWebSocketConnected && !hasAttemptedConnection.current) {
            hasAttemptedConnection.current = true;
            
            console.log('Initializing WebSocket connection...');
            watchPendingTxUpdates()
                .then(() => {
                    console.log('WebSocket initialized successfully');
                })
                .catch((error) => {
                    console.error("Failed to initialize WebSocket:", error);
                    // Reset the flag so we can try again if needed
                    hasAttemptedConnection.current = false;
                });
        }
    }, [wsUrl, isWebSocketConnected, watchPendingTxUpdates]);

    // Reset connection flag when wsUrl changes (new account)
    useEffect(() => {
        hasAttemptedConnection.current = false;
    }, [wsUrl]);
  
    // DON'T disconnect on unmount - let the connection persist
    // This is the key difference from your original - we want Postman-like behavior
    // where the connection stays alive throughout the session
    
    return {
        isConnected: isWebSocketConnected,
        hasClient: !!vaneClient
    };
}
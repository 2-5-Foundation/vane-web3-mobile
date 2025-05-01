'use client'

import { useEffect } from "react";
import { useTransactionStore } from "./useStore";
import { UserProfile } from "@dynamic-labs/sdk-react-core";
import { keccak256, toHex } from "viem";


export const useInitializeWebSocket = () => {
    const wsUrl = useTransactionStore(state => state.wsUrl);
    const vaneClient = useTransactionStore(state => state.vaneClient);
    const watchPendingTxUpdates = useTransactionStore(state => state.watchPendingTxUpdates);
  
    useEffect(() => {
        if (!vaneClient && wsUrl) {
            try {
                watchPendingTxUpdates();
            } catch (error) {
                console.error("Failed to initialize WebSocket:", error);
            }
        }
    }, [vaneClient, wsUrl, watchPendingTxUpdates]);
  
    // Cleanup function to close the WebSocket connection when the component unmounts
    useEffect(() => {
        return () => {
            if (vaneClient) {
                vaneClient.disconnect();
            }
        };
    }, [vaneClient]);
  };

  export const registerUserAirtableWrapper = (args:UserProfile) => {
    const registerUserAirtable = useTransactionStore.getState().registerUserAirtable; 
    
    const key = keccak256(toHex('airtable_user_id'));
    const keyExist = localStorage.getItem(key) !== null;
    if (!keyExist && args.newUser) {
        registerUserAirtable(
        args.verifiedCredentials[0].address,
        args.verifiedCredentials[0].chain,
        args.email
        );
    }
  }
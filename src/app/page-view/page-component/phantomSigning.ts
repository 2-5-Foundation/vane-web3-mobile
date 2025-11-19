import { useState, useEffect } from 'react';

import {
  VersionedTransaction,
  Transaction,
} from '@solana/web3.js';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { ISolana, isSolanaWallet } from '@dynamic-labs/solana-core';
import {
  isPhantomRedirectConnector,
  SignAndSendTransactionListener,
  SignTransactionListener,
} from '@dynamic-labs/wallet-connector-core';

export const usePhantomSignTransaction = () => {
  const { primaryWallet } = useDynamicContext();

  const [tx, setTx] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!isPhantomRedirectConnector(primaryWallet?.connector)) return;
    const handler: SignTransactionListener = (response) => {
      if (response.transaction) {
        setTx(response.transaction);
      } else {
        setErrorCode(response.errorCode);
        setErrorMessage(response.errorMessage);
      }
    };

    primaryWallet.connector.on('signTransaction', handler);
    return () => {
      if (!isPhantomRedirectConnector(primaryWallet?.connector)) return;
      primaryWallet.connector.off('signTransaction', handler);
    };
  }, [primaryWallet?.connector]);

  const execute = async (transaction: VersionedTransaction) => {
    if (!primaryWallet) return;
    if (!isSolanaWallet(primaryWallet)){
        return;
    }
    const signer = await primaryWallet.getSigner();
    await signer.signTransaction(transaction as any);
  };

  return { errorCode, errorMessage, execute, tx };
};
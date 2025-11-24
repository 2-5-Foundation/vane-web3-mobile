import { useState, useEffect } from 'react';

import {
  VersionedTransaction,
  Transaction,
} from '@solana/web3.js';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { ISolana, isSolanaWallet } from '@dynamic-labs/solana-core';
import {
  isPhantomRedirectConnector,
  SignMessageListener,
  SignTransactionListener,
} from '@dynamic-labs/wallet-connector-core';

export const usePhantomSignTransaction = () => {
  const { primaryWallet } = useDynamicContext();

  const [tx, setTx] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [signedMessage, setSignedMessage] = useState<string | undefined>(
    undefined,
  );
  const [messageErrorCode, setMessageErrorCode] = useState<string | undefined>(
    undefined,
  );
  const [messageErrorMessage, setMessageErrorMessage] = useState<
    string | undefined
  >(undefined);

  const connector = primaryWallet?.connector;

  useEffect(() => {
    if (!connector) return;
    if (!isPhantomRedirectConnector(connector)) return;
    const handleSignTransaction: SignTransactionListener = (response) => {
      if (response.transaction) {
        setTx(response.transaction);
      } else {
        setErrorCode(response.errorCode);
        setErrorMessage(response.errorMessage);
      }
    };

    const handleSignMessage: SignMessageListener = (response) => {
      if (response.signature) {
        setSignedMessage(response.signature);
        return;
      }
      setMessageErrorCode(response.errorCode);
      setMessageErrorMessage(response.errorMessage);
    };

    connector.on('signTransaction', handleSignTransaction);
    connector.on('signMessage', handleSignMessage);
    return () => {
      if (!isPhantomRedirectConnector(connector)) return;
      connector.off('signTransaction', handleSignTransaction);
      connector.off('signMessage', handleSignMessage);
    };
  }, [connector]);

  const execute = async (transaction: VersionedTransaction) => {
    if (!primaryWallet) return;
    if (!isSolanaWallet(primaryWallet)){
        return;
    }
    const signer = await primaryWallet.getSigner();
    await signer.signTransaction(transaction as any);
  };

  const signMessage = async (message: Uint8Array) => {
    if (!primaryWallet) return;
    if (!isSolanaWallet(primaryWallet)){
        return;
    }
    const signer = await primaryWallet.getSigner();
    await signer.signMessage(message);
  };

  return {
    errorCode,
    errorMessage,
    execute,
    signMessage,
    messageErrorCode,
    messageErrorMessage,
    signedMessage,
    tx,
  };
};
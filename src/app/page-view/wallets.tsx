"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
import { toast } from "sonner";

interface TokenBalance {
  symbol: string;
  balance: string;
  isSelected?: boolean;
  walletAddresses: string[]; // Track which wallets hold this token
}

interface WalletInfo {
  name: string;
  address: string;
  isConnected: boolean;
  isSelected?: boolean;
  tokens: TokenBalance[];
}

export default function Wallets() {
  const { setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Process wallets and combine token balances
  const processedWallets: WalletInfo[] = userWallets.map(wallet => ({
    name: wallet.connector?.name || 'Unknown',
    address: wallet.address,
    isConnected: true,
    tokens: [
      { symbol: 'ETH', balance: '0.00', walletAddresses: [wallet.address] },
      { symbol: 'USDC', balance: '0.00', walletAddresses: [wallet.address] },
      { symbol: 'USDT', balance: '0.00', walletAddresses: [wallet.address] }
    ]
  }));

  // Combine token balances for matching tokens across wallets
  const combinedTokens = processedWallets.reduce((acc: TokenBalance[], wallet) => {
    wallet.tokens.forEach(token => {
      const existingToken = acc.find(t => t.symbol === token.symbol);
      if (existingToken) {
        // Add wallet address to existing token
        existingToken.walletAddresses.push(wallet.address);
        // Sum balances (convert from string to number and back)
        const total = (parseFloat(existingToken.balance) + parseFloat(token.balance)).toFixed(2);
        existingToken.balance = total;
      } else {
        acc.push({ ...token });
      }
    });
    return acc;
  }, []);

  const handleWalletSelect = (address: string) => {
    setSelectedWallet(address);
  };

  const handleConnectWallet = () => {
    try {
      setShowAuthFlow(true);
    } catch (error) {
      toast.error(`Failed wallet conection ${error}`);
    }
  };

  return (
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Select Wallet Section */}
      <div className="space-y-3">
        <h2 className="text-[#9EB2AD] text-sm">Select wallet</h2>
        <div className="space-y-2">
          <RadioGroup value={selectedWallet || undefined} onValueChange={handleWalletSelect}>
            {processedWallets.map((wallet) => (
              <Card key={wallet.address} className="bg-[#0D1B1B] border-[#4A5853]/20">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value={wallet.address}
                      id={wallet.address}
                      className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-white">{wallet.name}</span>
                        <span className="text-[#4A5853] text-xs">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                      </div>
                      <span className="text-[#7EDFCD]">Connected</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>

          <Button 
            onClick={handleConnectWallet}
            className="w-full h-10 bg-transparent border border-dashed border-[#7EDFCD]/20 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40"
          >
            + Add Wallet or Signup
          </Button>
        </div>
      </div>

      {/* Tokens Section */}
      <div className="space-y-2">
        <h2 className="text-[#9EB2AD] text-sm">{selectedWallet && 'Balances'}</h2>
        {(selectedWallet ? 
          processedWallets.find(w => w.address === selectedWallet)?.tokens : 
          combinedTokens
        ).map((token) => (
          <Card 
            key={token.symbol} 
            className="bg-[#0D1B1B] border-[#4A5853]/20"
          >
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4A5853]" />
                  <span className="text-white">{token.symbol}</span>
                  <span className="text-[#4A5853] text-xs">
                    {token.walletAddresses.length > 1 ? `${token.walletAddresses.length} wallets` : '1 wallet'}
                  </span>
                </div>
                <span className="text-white">${token.balance}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


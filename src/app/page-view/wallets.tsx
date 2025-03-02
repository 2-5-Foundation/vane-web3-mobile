"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

interface TokenBalance {
  symbol: string;
  balance: string;
  isSelected?: boolean;
}

interface WalletInfo {
  name: string;
  icon: string;
  isConnected: boolean;
  isSelected?: boolean;
}

export default function Wallets() {
  const { setShowAuthFlow } = useDynamicContext();
  
  // Mock data - replace with actual wallet data
  const tokens: TokenBalance[] = [
    { symbol: 'ETH', balance: '$1,250.00', isSelected: true },
    { symbol: 'USDC', balance: '$750.00' },
    { symbol: 'USDT', balance: '$2,300.00' }
  ];

  const wallets: WalletInfo[] = [
    { name: 'Metamask', icon: '/metamask-logo.png', isConnected: true},
  ];

  return (
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Select Wallet Section */}
      <div className="space-y-3">
        <h2 className="text-[#9EB2AD] text-sm">Select wallet</h2>
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <Card key={wallet.name} className="bg-[#0D1B1B] border-[#4A5853]/20">
              <CardContent className="p-3">
                <RadioGroup defaultValue={wallet.isSelected ? wallet.name : undefined}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value={wallet.name} 
                      id={wallet.name}
                      className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-white">{wallet.name}</span>
                      </div>
                      <span className="text-[#7EDFCD]">Connected</span>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <Button 
            onClick={() => setShowAuthFlow(true)}
            className="w-full h-10 bg-transparent border border-dashed border-[#7EDFCD]/20 text-[#4A5853] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40"
          >
            + Add Wallet or Signup
          </Button>
        </div>
      </div>

      {/* Tokens Section */}
      <div className="space-y-2">
      <h2 className="text-[#9EB2AD] text-sm">Balances</h2>
        {tokens.map((token) => (
          <Card 
            key={token.symbol} 
            className={`bg-[#0D1B1B] border-[#4A5853]/20 ${token.isSelected ? 'ring-1 ring-[#7EDFCD]' : ''}`}
          >
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${token.isSelected ? 'bg-[#7EDFCD]' : 'bg-[#4A5853]'}`} />
                  <span className="text-white">{token.symbol}</span>
                </div>
                <span className="text-white">{token.balance}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


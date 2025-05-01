"use client"

//import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDynamicContext, useUserWallets, useTokenBalances, IsBrowser, DynamicConnectButton, useWalletConnectorEvent } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
// import { toast } from "sonner";
import Image from "next/image"

export default function Wallets() {
  const {  primaryWallet,handleLogOut } = useDynamicContext();
  const { tokenBalances, isLoading} = useTokenBalances();
  const userWallets = useUserWallets();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleWalletSelect = (address: string) => {
    setSelectedWallet(address);
  };

  useWalletConnectorEvent(
    primaryWallet?.connector,
    'accountChange',
    ({ accounts }, connector) => {
      console.group('accountChange');
      console.log('accounts', accounts);
      console.log('connector that emitted', connector);
      console.groupEnd();
    },
  );
  // const handleConnectWallet = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   e.preventDefault();
  //   try {
  //     // setShowAuthFlow(true);
  //     console.log("Connecting wallet...");
  //   } catch (error) {
  //     // toast.error(`Failed wallet connection: ${error}`);
  //     console.log(error);
  //   }
  // };

  // if (isError) {
  //   //@ts-expect-error - Error object structure from Dynamic SDK is not fully typed
  //   //toast.error(error.message);
  //   console.log(error.message);
  // }

  return (
    <IsBrowser>
    <div className="pt-2 px-4 space-y-6 max-w-sm mx-auto">
      {/* Select Wallet Section */}
      <div className="space-y-3">
        <div className="space-y-2">
          <RadioGroup value={selectedWallet || undefined} onValueChange={handleWalletSelect}>
            
            {userWallets.map((wallet) => (
              <Card key={wallet.address} className="bg-[#0D1B1B] border-[#4A5853]/20">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      defaultChecked
                      onClick={() => handleLogOut()}
                      value={wallet.address}
                      id={wallet.address}
                      className="border-[#4A5853] data-[state=checked]:border-[#7EDFCD] data-[state=checked]:bg-[#7EDFCD]"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-white">{wallet.connector?.name || 'Unknown'}</span>
                        <span className="text-[#4A5853] text-xs">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>

          <DynamicConnectButton buttonContainerClassName="w-full h-10 flex justify-center items-center bg-transparent border border-dashed border-[#7EDFCD]/20 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40">Add Wallet</DynamicConnectButton>
{/* 
          <Button 
            onClick={handleConnectWallet}
            className="w-full h-10 bg-transparent border border-dashed border-[#7EDFCD]/20 text-[#9EB2AD] hover:text-[#7EDFCD] hover:border-[#7EDFCD]/40"
          >
            + Add Wallet
          </Button> */}
        </div>
      </div>

      {/* Tokens Section */}
      <div className="space-y-2">
        <h2 className="text-[#9EB2AD] text-sm">{selectedWallet && 'Balances'}</h2>
        {isLoading ? (
          <div className="text-center py-4 text-[#9EB2AD]">Loading balances...</div>
        ) : (
          tokenBalances.map((token) => (
            <Card 
              key={token.address || token.symbol}
              className="bg-[#0D1B1B] border-[#4A5853]/20"
            >
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {token.logoURI ? (
                      <Image 
                        src={token.logoURI} 
                        alt={token.symbol} 
                        width={20} 
                        height={20} 
                        className="w-5 h-5 rounded-full" 
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#4A5853]" />
                    )}
                    <span className="text-white">{token.symbol}</span>
                    <span className="text-[#4A5853] text-xs">{token.name}</span>
                  </div>
                  <span className="text-white">{token.balance}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
    </IsBrowser>
  );
}


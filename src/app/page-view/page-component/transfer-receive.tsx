"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core"
import { useState, useEffect } from "react"
import { toast } from "sonner"

interface NetworkAddress {
  network: string;
  address: string;
  copied: boolean;
}

export default function TransferReceive() {
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const [addresses, setAddresses] = useState<NetworkAddress[]>([]);

  useEffect(() => {
    // Extract addresses for different networks
    const networkAddresses: NetworkAddress[] = [];
    
    // Find wallets for each network
    userWallets.forEach(wallet => {
      const chain = wallet.chain?.toLowerCase() || '';
      
      // Check if this is a network we want to display
      if (
        chain.includes('ethereum') || 
        chain.includes('solana') || 
        chain.includes('tron')
      ) {
        // Check if we already have this network
        const existingNetwork = networkAddresses.find(
          na => na.network.toLowerCase() === chain
        );
        
        if (!existingNetwork) {
          networkAddresses.push({
            network: wallet.chain || 'Unknown',
            address: wallet.address,
            copied: false
          });
        }
      }
    });
    
    // If we don't have all three networks but have at least one wallet,
    // add placeholder entries for missing networks
    const networks = ['Ethereum', 'Solana', 'Tron'];
    networks.forEach(network => {
      const hasNetwork = networkAddresses.some(
        na => na.network.toLowerCase().includes(network.toLowerCase())
      );
      
      if (!hasNetwork) {
        networkAddresses.push({
          network,
          address: 'Not connected',
          copied: false
        });
      }
    });
    
    setAddresses(networkAddresses);
  }, [userWallets]);

  const handleCopyAddress = (index: number) => {
    const address = addresses[index].address;
    
    if (address === 'Not connected') {
      toast.error(`Please connect a ${addresses[index].network} wallet first`);
      return;
    }
    
    navigator.clipboard.writeText(address);
    
    // Update copied state
    const newAddresses = [...addresses];
    newAddresses[index].copied = true;
    setAddresses(newAddresses);
    
    // Reset copied state after 2 seconds
    setTimeout(() => {
      const resetAddresses = [...addresses];
      resetAddresses[index].copied = false;
      setAddresses(resetAddresses);
    }, 2000);
    
    toast.success('Address copied to clipboard');
  };

  const handleConnectWallet = () => {
    setShowAuthFlow(true);
  };

  return (
    <div className="space-y-2">
      {/* Network Address Cards */}
      {addresses.map((item, index) => (
        <Card key={item.network} className="bg-[#0D1B1B] border-[#4A5853]/20">
          <CardContent className="p-1.5 space-y-1">
            <div className="flex justify-between items-center">
              <h3 className="text-[#9EB2AD] text-xs">{item.network}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-[#7EDFCD] hover:text-[#7EDFCD] hover:bg-[#7EDFCD]/10"
                onClick={() => handleCopyAddress(index)}
              >
                {item.copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <p className="text-white font-mono text-xs break-all">
              {item.address === 'Not connected' ? (
                <span className="text-[#4A5853]">{item.address}</span>
              ) : (
                item.address
              )}
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Connect Wallet Button (if no wallets connected) */}
      {!primaryWallet && (
        <Button
          onClick={handleConnectWallet}
          className="w-full h-8 mt-2 bg-[#7EDFCD] text-[#0B1B1C] hover:bg-[#7EDFCD]/90 text-xs"
        >
          Connect Wallet
        </Button>
      )}
    </div>
  );
} 
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Clock } from "lucide-react"

export default function TransferReceive() {
  return (
    <div className="space-y-2">
      {/* Coming Soon Card */}
      <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Clock className="h-12 w-12 text-[#7EDFCD] stroke-[1.5]" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Coming Soon</h3>
              <p className="text-sm text-[#9EB2AD] leading-relaxed">
              Make payments to any site with verifiable proof that the funds will be received correctly—no mistakes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
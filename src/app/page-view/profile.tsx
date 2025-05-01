"use client"

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Activity, DollarSign, ChevronDown, ChevronUp } from "lucide-react"

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  subtitle?: string
  additionalStats?: { label: string; value: string }[]
}

function StatCard({ icon, title, value, subtitle, additionalStats }: StatCardProps) {
  return (
    <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
      <div className="p-5 space-y-4">
        {/* Icon and Main Content */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-[#7EDFCD]">
              {icon}
            </div>
            <p className="text-[#9EB2AD] text-xs tracking-wider">{title}</p>
          </div>
          <h2 className="text-[25px] font-medium text-white leading-none">{value}</h2>
          {subtitle && <p className="text-[#9EB2AD] text-sm mt-1">{subtitle}</p>}
        </div>

        {/* Additional Stats with Line Separator */}
        {additionalStats && (
          <>
            <div className="h-[1px] bg-[#4A5853]/20" />
            <div className="grid grid-cols-2 gap-x-8">
              {additionalStats.map((stat, index) => (
                <div key={index} className="flex justify-between items-center">
                  <p className="text-[#9EB2AD] text-sm">{stat.label}</p>
                  <p className="text-white text-sm">{stat.value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

interface Transaction {
  id: string
  type: 'sent' | 'received'
  amount: string
  currency: string
  date: string
  address: string
}

export default function Profile() {
  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(false)

  const recentTransactions: Transaction[] = []

  return (
    <div className="space-y-3 p-4 max-w-md mx-auto">
      {/* Protected & Recovered Stats */}
      <StatCard
        icon={<Shield className="w-5 h-5 text-[#7EDFCD]" />}
        title="PROTECTED & RECOVERED"
        value="$0"
        subtitle="" // 29 transactions safeguarded
        additionalStats={[
          { label: "Largest Recovery:", value: "$0" }
        ]}
      />

      {/* Total Transactions */}
      <StatCard
        icon={<Activity className="w-5 h-5 text-[#7EDFCD]" />}
        title="TOTAL TRANSACTIONS"
        value="0"
        subtitle="Last 30 days"
      />

      {/* Total Volume */}
      <StatCard
        icon={<DollarSign className="w-5 h-5 text-[#7EDFCD]" />}
        title="TOTAL VOLUME"
        value="$0"
        subtitle="" //Avg. $396.86 per transaction
      />

      {/* Recent Activities */}
      <div className="space-y-2 mt-4">
        <Button
          variant="ghost"
          onClick={() => setIsActivitiesExpanded(!isActivitiesExpanded)}
          className="w-full flex items-center justify-between text-[#9EB2AD] hover:text-white px-1"
        >
          <span className="text-sm font-medium">Recent Activities</span>
          {isActivitiesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {isActivitiesExpanded && (
          <Card className="bg-[#0D1B1B] border-[#4A5853]/20">
            <div className="p-4 space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#4A5853]/10 last:border-0">
                  <div>
                    <p className="text-sm text-white">{tx.type === 'sent' ? 'Sent' : 'Received'}</p>
                    <p className="text-xs text-[#9EB2AD]">{tx.address}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${tx.type === 'sent' ? 'text-red-400' : 'text-[#7EDFCD]'}`}>
                      {tx.type === 'sent' ? '-' : '+'}{tx.amount} {tx.currency}
                    </p>
                    <p className="text-xs text-[#9EB2AD]">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

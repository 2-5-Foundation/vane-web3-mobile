"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import SenderPending from "./page-component/sender-pending";
import ReceiverPending from "./page-component/receiver-pending";

export default function Pending() {
  const [activeTab, setActiveTab] = useState<"outgoing" | "incoming">(
    "outgoing",
  );

  return (
    <div className="pt-2 px-4 max-w-sm mx-auto">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="mb-6"
      >
        <TabsList className="flex bg-[#1a2628] p-0.5 h-auto">
          <TabsTrigger
            value="outgoing"
            className="flex-1 flex items-center justify-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
            aria-label="View outgoing pending transfers"
          >
            <ArrowUpRight className="h-4 w-4" /> Sender Outgoing
          </TabsTrigger>
          <TabsTrigger
            value="incoming"
            className="flex-1 flex items-center justify-center gap-2 py-2 data-[state=active]:bg-[#7EDFCD] data-[state=active]:text-[#0B1B1C] data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#9EB2AD]"
            aria-label="View incoming pending transfers"
          >
            <ArrowDownLeft className="h-4 w-4" /> Receiver Incoming
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outgoing" className="mt-4">
          <SenderPending />
        </TabsContent>
        <TabsContent value="incoming" className="mt-4">
          <ReceiverPending />
        </TabsContent>
      </Tabs>
    </div>
  );
}

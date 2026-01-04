"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAProvider() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const registerServiceWorker = () => {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          console.error("Failed to register service worker", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
      return () => {
        window.removeEventListener("load", registerServiceWorker);
      };
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-[#0D1B1B] border border-[#4A5853]/20 rounded-lg p-4 flex items-center justify-between md:left-auto md:right-4 md:w-80">
      <div className="flex items-center gap-3">
        <Image
          src="/vane-logo.png"
          alt="Vane Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <div>
          <h3 className="text-white text-sm font-medium">Install Vane Web3</h3>
          <p className="text-[#9EB2AD] text-xs">
            Add to home screen for quick access
          </p>
        </div>
      </div>
      <button
        onClick={handleInstall}
        className="text-[#7EDFCD] text-sm hover:text-[#7EDFCD]/80"
      >
        Install
      </button>
    </div>
  );
}

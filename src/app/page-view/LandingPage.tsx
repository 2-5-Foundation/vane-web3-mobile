// components/LandingPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Lock } from "lucide-react";
import Image from "next/image";

interface LandingPageProps {
  onLaunch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const [currentTweetIndex, setCurrentTweetIndex] = useState(0);
  const [fetchedTweets, setFetchedTweets] = useState<{ html: string }[]>([]);
  const [isLoadingTweets, setIsLoadingTweets] = useState(true);

  const tweetLinks = [
    "https://twitter.com/autismcapital/status/1786415766394527979?s=46",
    "https://twitter.com/realscamsniffer/status/1786374327740543464?s=46",
    "https://twitter.com/alexjmingolla/status/1781425355947233507?s=46",
    "https://x.com/realScamSniffer/status/1915710745423339792?s=46",
    "https://twitter.com/coinfessions/status/1819538679318384885?s=46",
    "https://twitter.com/naiivememe/status/1870547032722591762?s=46",
  ];

  useEffect(() => {
    const loadTweets = async () => {
      setIsLoadingTweets(true);
      // Example: fetch tweets from API using tweetLinks
      const response = await fetch("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: tweetLinks }),
      });
      const data = await response.json();
      setFetchedTweets(data.tweets || []);
      setIsLoadingTweets(false);
    };

    loadTweets();
  }, []);

  // Initialize Twitter widgets once when tweets are loaded
  useEffect(() => {
    if (fetchedTweets.length > 0 && typeof window !== "undefined") {
      // Check if Twitter widgets script is already loaded
      if ((window as any).twttr?.widgets) {
        (window as any).twttr.widgets.load();
      } else {
        // Load Twitter widgets script
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        document.body.appendChild(script);

        script.onload = () => {
          // Wait a bit for Twitter to initialize
          setTimeout(() => {
            if ((window as any).twttr?.widgets) {
              (window as any).twttr.widgets.load();
            }
          }, 100);
        };
      }
    }
  }, [fetchedTweets]);

  const nextTweet = useCallback(() => {
    setCurrentTweetIndex((prev) =>
      prev === fetchedTweets.length - 1 ? 0 : prev + 1
    );
  }, [fetchedTweets.length]);

  const prevTweet = useCallback(() => {
    setCurrentTweetIndex((prev) =>
      prev === 0 ? fetchedTweets.length - 1 : prev - 1
    );
  }, [fetchedTweets.length]);

  // Auto-advance carousel
  useEffect(() => {
    if (fetchedTweets.length <= 1) return;

    const interval = setInterval(() => {
      nextTweet();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchedTweets.length, nextTweet]);

  // Re-initialize Twitter widgets when tweet changes
  useEffect(() => {
    if (fetchedTweets.length > 0 && (window as any).twttr?.widgets) {
      setTimeout(() => {
        (window as any).twttr.widgets.load();
      }, 100);
    }
  }, [currentTweetIndex, fetchedTweets.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1313] to-[#1a2628] overflow-y-auto">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 mb-16">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/vane-logo-icon.png"
                alt="Vane Logo"
                width={48}
                height={48}
                className="h-12 w-auto"
              />
              <h1 className="text-5xl sm:text-6xl font-bold text-white">
                Vane
              </h1>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
            <span className="bg-gradient-to-r from-[#7EDFCD] via-[#6AD4C1] to-[#5BC4B0] bg-clip-text text-transparent">
              The Safest Home for Your Crypto Assets
            </span>
          </h2>

          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed font-light">
            Effortless transfers, intelligent management, and military-grade
            security—all in one beautiful wallet.
          </p>

          <div className="pt-6">
            <h3 className="text-lg sm:text-xl font-semibold tracking-wide text-center uppercase max-w-xs mx-auto leading-tight">
              <span className="bg-gradient-to-r from-[#7EDFCD] to-[#5BC4B0] bg-clip-text text-transparent drop-shadow-lg">
                Sleep Easy Knowing You're Protected From:
              </span>
            </h3>
          </div>
        </div>

        {/* Enhanced Tweet Carousel */}
        <div className="w-full max-w-2xl mx-auto mb-16">
          <div className="relative bg-gradient-to-br from-[#10191A] to-[#0D1313] rounded-3xl p-8 border border-[#7EDFCD]/20 shadow-2xl">
            {/* Navigation Arrows */}
            {fetchedTweets.length > 1 && (
              <>
                <button
                  onClick={prevTweet}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-[#1a2628]/80 hover:bg-[#7EDFCD]/10 rounded-full flex items-center justify-center text-[#7EDFCD] hover:text-[#7EDFCD] transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-[#4A5853]/30 z-10"
                  aria-label="Previous tweet"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={nextTweet}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-[#1a2628]/80 hover:bg-[#7EDFCD]/10 rounded-full flex items-center justify-center text-[#7EDFCD] hover:text-[#7EDFCD] transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-[#4A5853]/30 z-10"
                  aria-label="Next tweet"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Tweet Display */}
            <div className="flex justify-center items-center min-h-[300px]">
              {isLoadingTweets ? (
                // Enhanced Skeleton Loader
                <div className="w-full max-w-[350px] mx-auto">
                  <div className="bg-[#1a2628] rounded-2xl p-6 animate-pulse">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-[#4A5853]/30 rounded-full"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-[#4A5853]/30 rounded w-1/3"></div>
                        <div className="h-3 bg-[#4A5853]/30 rounded w-1/4"></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-[#4A5853]/30 rounded"></div>
                      <div className="h-4 bg-[#4A5853]/30 rounded w-5/6"></div>
                      <div className="h-4 bg-[#4A5853]/30 rounded w-2/3"></div>
                    </div>
                    <div className="flex space-x-4 mt-4">
                      <div className="h-4 bg-[#4A5853]/30 rounded w-16"></div>
                      <div className="h-4 bg-[#4A5853]/30 rounded w-16"></div>
                      <div className="h-4 bg-[#4A5853]/30 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ) : fetchedTweets.length > 0 ? (
                <div className="w-full flex justify-center">
                  <div
                    className="max-w-[400px] w-full transform transition-all duration-500 ease-in-out"
                    key={currentTweetIndex}
                    dangerouslySetInnerHTML={{
                      __html: fetchedTweets[currentTweetIndex]?.html || "",
                    }}
                  />
                </div>
              ) : (
                // Fallback when no tweets are available
                <div className="text-center text-gray-400">
                  <p>Security testimonials coming soon...</p>
                </div>
              )}
            </div>

            {/* Carousel Indicators */}
            {fetchedTweets.length > 1 && (
              <div className="flex justify-center space-x-3 mt-6">
                {fetchedTweets.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTweetIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentTweetIndex
                        ? "bg-[#7EDFCD] scale-125"
                        : "bg-[#4A5853]/50 hover:bg-[#7EDFCD]/70"
                    }`}
                    aria-label={`Go to tweet ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* How it works section */}
        <div className="w-full max-w-2xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#7EDFCD] mb-2 uppercase tracking-wide">
              How it works
            </h3>
            <p className="text-[#C7D1CC] text-lg font-light">
              Simple, Secure, Seamless
            </p>
          </div>

          {/* Enhanced Vertical Stepper */}
          <div className="bg-gradient-to-br from-[#10191A] to-[#0D1313] rounded-3xl p-8 border border-[#7EDFCD]/20 shadow-2xl">
            {[
              {
                icon: (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M22 2L11 13"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 2L15 22L11 13L2 9L22 2Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Initiate Transaction",
                description:
                  "Start your transaction as usual through your preferred wallet",
              },
              {
                icon: (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path
                      d="M9.5 12.5l2 2l3-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Receiver Verification",
                description:
                  "Receiver signs a message verifying address correctness",
              },
              {
                icon: (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path
                      d="M9.5 12.5l2 2l3-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Confirmation",
                description:
                  "Sender confirms the transaction details and state",
              },
              {
                icon: (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path
                      d="M12 8v8M12 16l4-4-4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Safe Arrival",
                description:
                  "Funds arrive safely at their intended destination",
              },
            ].map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                {/* Step */}
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7EDFCD] to-[#5BC4B0] shadow-lg mb-4 transform hover:scale-105 transition-transform duration-200">
                  <div className="text-[#0D1313]">{step.icon}</div>
                </div>

                {/* Content */}
                <div className="text-center mb-8">
                  <h4 className="text-white text-xl font-bold mb-2">
                    {step.title}
                  </h4>
                  <p className="text-[#C7D1CC] text-sm leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </div>

                {/* Connector (except last step) */}
                {index < 3 && (
                  <div className="w-1 h-12 bg-gradient-to-b from-[#7EDFCD] to-[#5BC4B0] rounded-full mb-8 opacity-60"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guarantees Section */}
        <div className="w-full max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#7EDFCD] mb-2 uppercase tracking-wide">
              Our Guarantees
            </h3>
            <p className="text-[#C7D1CC] text-lg font-light">
              Built with your security in mind
            </p>
          </div>

          {/* Enhanced Guarantees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3l8 4v5c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V7l8-4z" />
                    <path
                      d="M9 12l2 2l4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Address Verification",
                description:
                  "Confirms the receiver address before any transaction, ensuring your funds go exactly where intended.",
              },
              {
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36 6.36l-2.12-2.12M6.36 6.36l2.12 2.12m0 6.12l-2.12 2.12m10.6-10.6l-2.12 2.12" />
                  </svg>
                ),
                title: "Network Protection",
                description:
                  "Automatically verifies the correct network and prevents cross-chain losses.",
              },
              {
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path
                      d="M9.5 12.5l2 2l3-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Ownership Confirmation",
                description:
                  "Verifies the receiver can actually access the funds interactively.",
              },
              {
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="10" width="12" height="8" rx="2" />
                    <path d="M12 16v-2" />
                    <circle cx="12" cy="13" r="1" />
                    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
                  </svg>
                ),
                title: "ZK Proofed",
                description:
                  "Receiver confirmation attestation is cryptographically programmable and provable.",
              },
            ].map((guarantee, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-[#10191A] to-[#0D1313] rounded-2xl p-6 border border-[#7EDFCD]/20 hover:border-[#7EDFCD]/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7EDFCD] to-[#5BC4B0] flex items-center justify-center text-[#0D1313] flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    {guarantee.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white text-lg font-bold mb-2 group-hover:text-[#7EDFCD] transition-colors duration-300">
                      {guarantee.title}
                    </h4>
                    <p className="text-[#C7D1CC] text-sm leading-relaxed">
                      {guarantee.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto py-8 mb-16">
          <div className="bg-[#0D1B1B]/50 p-6 rounded-2xl border border-[#4A5853]/20 hover:border-[#7EDFCD]/30 transition-all duration-300 hover:scale-105">
            <Shield className="w-12 h-12 text-[#7EDFCD] mx-auto mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2 text-center">
              Bank-Level Security
            </h3>
            <p className="text-gray-300 text-sm text-center">
              Advanced encryption and multi-layer protection for your digital
              assets
            </p>
          </div>

          <div className="bg-[#0D1B1B]/50 p-6 rounded-2xl border border-[#4A5853]/20 hover:border-[#7EDFCD]/30 transition-all duration-300 hover:scale-105">
            <Zap className="w-12 h-12 text-[#7EDFCD] mx-auto mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2 text-center">
              Lightning Fast
            </h3>
            <p className="text-gray-300 text-sm text-center">
              Instant transfers and seamless trading with minimal fees
            </p>
          </div>

          <div className="bg-[#0D1B1B]/50 p-6 rounded-2xl border border-[#4A5853]/20 hover:border-[#7EDFCD]/30 transition-all duration-300 hover:scale-105">
            <Lock className="w-12 h-12 text-[#7EDFCD] mx-auto mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2 text-center">
              Full Control
            </h3>
            <p className="text-gray-300 text-sm text-center">
              Your keys, your crypto. Complete ownership and privacy
            </p>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="text-center space-y-6 pt-8">
          <Button
            onClick={onLaunch}
            className="bg-gradient-to-r from-[#7EDFCD] to-[#5BC4B0] hover:from-[#6AD4C1] hover:to-[#4AB8A0] text-[#0D1313] font-bold py-6 px-12 rounded-2xl text-lg transition-all duration-200 transform hover:scale-105 hover:shadow-2xl"
            size="lg"
          >
            Launch App
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Optimized for mobile devices. Available on all your devices with
              seamless sync.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

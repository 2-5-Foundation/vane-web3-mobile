import React, { useEffect } from 'react';

interface LandingOverlayProps {
  show: boolean;
  onClose: () => void;
  fetchedTweets: { html: string }[];
}

const LandingOverlay: React.FC<LandingOverlayProps> = ({ show, onClose, fetchedTweets }) => {
  useEffect(() => {
    // Debug: fetch a single tweet oEmbed and log the result
    fetch('https://publish.twitter.com/oembed?url=https://twitter.com/autismcapital/status/1786415766394527979')
      .then(res => res.json())
      .then(data => {
        console.log('Single tweet oEmbed:', data);
      })
      .catch(err => console.error('oEmbed fetch error:', err));
  }, []);

  useEffect(() => {
    if (fetchedTweets.length > 0) {
      // @ts-expect-error: twttr is not typed on window
      if (window.twttr && window.twttr.widgets) {
        // @ts-expect-error: twttr is not typed on window
        window.twttr.widgets.load();
      } else {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [fetchedTweets]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-[#0D1313]/90 backdrop-blur-lg h-full min-h-screen overflow-y-auto py-6">
      {/* Fading top dark gradient overlay */}
      <div className="absolute top-0 left-0 w-full h-[10vh] pointer-events-none z-0 bg-gradient-to-b from-[#10191A]/80 to-transparent" />
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-50 text-white bg-black/40 rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-[#7EDFCD]"
        aria-label="Close landing overlay"
        tabIndex={0}
        onClick={onClose}
      >
        <svg className="w-6 h-6" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center pb-32 pt-[10vh] relative z-10">
        <h2 className="relative text-2xl sm:text-3xl md:text-4xl font-sans font-bold tracking-wider text-center mb-8 uppercase max-w-xs mx-auto leading-tight">
            <span className="bg-gradient-to-r from-[#7EDFCD] to-[#5BC4B0] bg-clip-text text-transparent drop-shadow-lg">
                we are protecting you from
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-[#7EDFCD] to-[#5BC4B0] bg-clip-text text-transparent blur-sm opacity-50 -z-10">
                we are protecting you from
            </span>
        </h2>
        {/* Tweets as images or HTML */}
        <div className="flex gap-4 overflow-x-auto w-full mb-8 pb-2 scrollbar-thin scrollbar-thumb-[#7EDFCD]/30 scrollbar-track-transparent">
          {fetchedTweets.length > 0 ? (
            fetchedTweets.map((tweet, idx) => (
              <div key={idx} className="min-w-[260px] max-w-[300px] rounded-lg shadow-md p-2 bg-transparent" dangerouslySetInnerHTML={{ __html: tweet.html }} />
            ))
          ) : (
            // Skeleton loader while tweets are loading
            [...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="min-w-[260px] max-w-[300px] h-[180px] rounded-lg bg-[#222] animate-pulse"
              />
            ))
          )}
        </div>
        {/* How it works header and subhead */}
        <div className="w-full flex flex-col items-center mb-2">
          <h3 className="text-base sm:text-lg font-sans font-normal tracking-normal text-[#7EDFCD] mb-0.5 uppercase">How it works</h3>
          <div className="text-[#C7D1CC] text-sm font-medium">Simply</div>
        </div>
        {/* How it works - vertical stepper */}
        <div className="w-full bg-[#10191A]/80 rounded-xl p-3 mb-4 flex flex-col items-center">
          {/* Step 1 */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full border border-[#7EDFCD] flex items-center justify-center mb-1">
              {/* Paper plane icon */}
              <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-white text-base font-semibold mb-0.5 text-center">Initiate Transaction</div>
            <div className="text-[#C7D1CC] text-xs text-center mb-2">Initiate your transaction as usual through your preferred wallet</div>
          </div>
          {/* Arrow + Divider */}
          <div className="flex flex-col items-center">
            <div className="h-6 w-px bg-gradient-to-b from-[#7EDFCD]/60 to-transparent" />
            <svg className="w-4 h-4 text-[#7EDFCD] my-[-2px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 6v12M12 18l4-4M12 18l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="h-6 w-px bg-gradient-to-b from-transparent to-[#7EDFCD]/60" />
          </div>
          {/* Step 2 */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full border border-[#7EDFCD] flex items-center justify-center mb-1">
              {/* User check icon */}
              <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M9.5 12.5l2 2l3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-white text-base font-semibold mb-0.5 text-center">Receiver Verification</div>
            <div className="text-[#C7D1CC] text-xs text-center mb-2">Receiver signs a message verifying address correctness</div>
          </div>
          {/* Arrow + Divider */}
          <div className="flex flex-col items-center">
            <div className="h-6 w-px bg-gradient-to-b from-[#7EDFCD]/60 to-transparent" />
            <svg className="w-4 h-4 text-[#7EDFCD] my-[-2px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 6v12M12 18l4-4M12 18l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="h-6 w-px bg-gradient-to-b from-transparent to-[#7EDFCD]/60" />
          </div>
          {/* Step 3 */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full border border-[#7EDFCD] flex items-center justify-center mb-1">
              {/* Checkmark icon */}
              <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M9.5 12.5l2 2l3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-white text-base font-semibold mb-0.5 text-center">Confirmation</div>
            <div className="text-[#C7D1CC] text-xs text-center mb-2">Sender confirms the transaction details and state</div>
          </div>
          {/* Arrow + Divider */}
          <div className="flex flex-col items-center">
            <div className="h-6 w-px bg-gradient-to-b from-[#7EDFCD]/60 to-transparent" />
            <svg className="w-4 h-4 text-[#7EDFCD] my-[-2px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 6v12M12 18l4-4M12 18l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="h-6 w-px bg-gradient-to-b from-transparent to-[#7EDFCD]/60" />
          </div>
          {/* Step 4 */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full border border-[#7EDFCD] flex items-center justify-center mb-1">
              {/* Arrow icon */}
              <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v8M12 16l4-4-4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-white text-base font-semibold mb-0.5 text-center">Safe Arrival</div>
            <div className="text-[#C7D1CC] text-xs text-center">Funds arrive safely at their intended destination</div>
          </div>
        </div>
        {/* Guarantees */}
        <div className="w-full flex flex-col items-center mt-8">
          <h3 className="text-base sm:text-lg font-sans font-normal tracking-normal text-[#7EDFCD] mb-2 uppercase">Guarantees</h3>
          <div className="flex flex-col gap-4 w-full items-center">
            {/* Card 1: Address Verification */}
            <div className="border border-[#7EDFCD]/30 rounded-xl p-3 bg-[#10191A]/60 h-40 min-h-[10rem] w-full max-w-xs mx-auto flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                {/* Shield icon */}
                <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 3l8 4v5c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V7l8-4z" />
                  <path d="M9 12l2 2l4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-sm text-white font-semibold uppercase tracking-tight">Address Verification</div>
              </div>
              <div className="text-[#C7D1CC] text-xs">Confirms the receiver address before any transaction, ensuring your funds go exactly where intended.</div>
            </div>
            {/* Card 2: Network Protection */}
            <div className="border border-[#7EDFCD]/30 rounded-xl p-3 bg-[#10191A]/60 h-40 min-h-[10rem] w-full max-w-xs mx-auto flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                {/* Network icon */}
                <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36 6.36l-2.12-2.12M6.36 6.36l2.12 2.12m0 6.12l-2.12 2.12m10.6-10.6l-2.12 2.12" />
                </svg>
                <div className="text-sm text-white font-semibold uppercase tracking-tight">Network Protection</div>
              </div>
              <div className="text-[#C7D1CC] text-xs">Automatically verifies the correct network and prevents cross-chain losses.</div>
            </div>
            {/* Card 3: Ownership Confirmation */}
            <div className="border border-[#7EDFCD]/30 rounded-xl p-3 bg-[#10191A]/60 h-40 min-h-[10rem] w-full max-w-xs mx-auto flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                {/* User check icon */}
                <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M9.5 12.5l2 2l3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-sm text-white font-semibold uppercase tracking-tight">Ownership Confirmation</div>
              </div>
              <div className="text-[#C7D1CC] text-xs">Verifies the receiver can actually access the funds interactively.</div>
            </div>
            {/* Card 4: ZK Proofed */}
            <div className="border border-[#7EDFCD]/30 rounded-xl p-3 bg-[#10191A]/60 h-40 min-h-[10rem] w-full max-w-xs mx-auto flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                {/* ZK Proof icon (lock with check) */}
                <svg className="w-5 h-5 text-[#7EDFCD]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="6" y="10" width="12" height="8" rx="2" />
                  <path d="M12 16v-2" />
                  <circle cx="12" cy="13" r="1" />
                  <path d="M9 10V7a3 3 0 0 1 6 0v3" />
                </svg>
                <div className="text-sm text-white font-semibold uppercase tracking-tight">ZK Proofed</div>
              </div>
              <div className="text-[#C7D1CC] text-xs">Receiver confirmation attestation is cryptographically programmable and provable.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingOverlay; 
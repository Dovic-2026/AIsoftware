"use client";
import { useState } from "react";
import { useInstallPwa } from "@/hooks/useInstallPwa";

export default function InstallBanner() {
  const { state, install } = useInstallPwa();
  const [dismissed, setDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  if (dismissed || state === "installed" || state === "none") return null;

  return (
    <>
      {/* Install Banner */}
      <div className="mx-3 mb-2 rounded-2xl bg-gradient-to-r from-[#128C7E] to-[#25D366] px-4 py-3 flex items-center gap-3 shadow-lg animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-extrabold text-[13px]">Install DOVIC App</div>
          <div className="text-white/80 text-[11px]">Add to home screen for quick access</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { state === "ios" ? setShowIosModal(true) : install(); }}
            className="bg-white text-[#128C7E] text-[12px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all"
          >
            {state === "ios" ? "How?" : "Install"}
          </button>
          <button onClick={() => setDismissed(true)} className="text-white/60 text-[18px] leading-none px-1">×</button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end animate-fade-in" onClick={() => setShowIosModal(false)}>
          <div className="bg-white w-full rounded-t-[28px] px-5 pt-3 pb-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="text-[18px] font-extrabold text-gray-900 mb-1">Add to Home Screen</div>
            <div className="text-[12px] text-gray-500 mb-5">Install DOVIC on your iPhone in 3 steps</div>
            {[
              { icon: "⬆️", text: 'Tap the Share button at the bottom of Safari' },
              { icon: "➕", text: 'Scroll down and tap "Add to Home Screen"' },
              { icon: "✅", text: 'Tap "Add" — the app icon will appear on your home screen' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">{step.icon}</div>
                <div className="flex-1 pt-1">
                  <div className="text-[13px] text-gray-800 leading-relaxed">{step.text}</div>
                </div>
              </div>
            ))}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3 mb-5">
              <span className="text-xl">💡</span>
              <div className="text-[12px] text-gray-600">Use <strong>Safari</strong> browser — Chrome on iOS does not support Add to Home Screen</div>
            </div>
            <button onClick={() => setShowIosModal(false)} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#128C7E] to-[#25D366] text-white text-[15px] font-bold">
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

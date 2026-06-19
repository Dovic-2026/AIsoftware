"use client";
import { useEffect, useState } from "react";

export type InstallState = "ready" | "ios" | "installed" | "none";

export function useInstallPwa() {
  const [prompt, setPrompt] = useState<any>(null);
  const [state, setState] = useState<InstallState>("none");

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // iOS detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) { setState("installed"); return; }
    if (isIos) { setState("ios"); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setState("ready");
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setState("installed"));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") setState("installed");
  };

  return { state, install };
}

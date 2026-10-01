"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios] = useState(isIosDevice);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || window.localStorage.getItem("calace-pwa-dismissed") === "1") {
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = window.setTimeout(() => {
      if (isIosDevice()) setVisible(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem("calace-pwa-dismissed", "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }

  return (
    <div className="pwa-install-banner mb-4 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary p-2 text-primary-foreground">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install CAL ACE on this phone</p>
          {ios ? (
            <p className="mt-1 text-xs text-muted-foreground">
              On iPhone or iPad: tap <Share className="inline h-3 w-3" aria-hidden /> Share, then{" "}
              <strong>Add to Home Screen</strong>. This installs the web app. It is not an App Store download.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Install the web app on Android for a full-screen Home Screen shortcut. Time Clock still needs an internet
              connection.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {deferred ? (
              <Button type="button" size="sm" onClick={install}>
                Install app
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={dismiss} aria-label="Dismiss install prompt">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

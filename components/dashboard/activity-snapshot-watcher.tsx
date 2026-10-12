"use client";

import { useEffect, useRef } from "react";
import { randomActivitySnapshotDelayMs } from "@/lib/activity-snapshot";

export function ActivitySnapshotWatcher({ enabled }: { enabled: boolean }) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function captureAndSend() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try {
          const status = await fetch("/api/activity-snapshot", { cache: "no-store" });
          const flag = (await status.json()) as { enabled?: boolean };
          if (flag.enabled) {
            const { toJpeg } = await import("html-to-image");
            const target = document.querySelector("main") ?? document.body;
            const image = await toJpeg(target as HTMLElement, {
              quality: 0.55,
              pixelRatio: 1,
              backgroundColor: "#ffffff",
              cacheBust: true,
              filter: (node) => {
                if (node instanceof HTMLInputElement && node.type === "password") return false;
                if (node instanceof HTMLElement && node.dataset.noActivitySnapshot === "true") return false;
                return true;
              },
            });
            if (image && image.length > 80 && image.length < 1_800_000) {
              await fetch("/api/activity-snapshot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image, path: window.location.pathname }),
              });
            }
          }
        } catch {
          /* skip this interval */
        }
      }
      if (!cancelled) {
        timer.current = window.setTimeout(captureAndSend, randomActivitySnapshotDelayMs());
      }
    }

    timer.current = window.setTimeout(captureAndSend, randomActivitySnapshotDelayMs());
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled]);

  return null;
}

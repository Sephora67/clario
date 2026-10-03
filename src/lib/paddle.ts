import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

declare global {
  interface Window { Paddle: any }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let ready: Promise<void> | null = null;
export function initializePaddle(onEvent?: (e: { name?: string }) => void) {
  if (!clientToken) return Promise.reject(new Error("Payments are not configured"));
  if (!ready) ready = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken, eventCallback: (e: { name?: string }) => window.dispatchEvent(new CustomEvent("clario-paddle", { detail: e })) });
      resolve();
    };
    s.onerror = () => { ready = null; reject(new Error("Checkout failed to load")); };
    document.head.appendChild(s);
  });
  void onEvent;
  return ready;
}

export function getPaddlePriceId(priceId: string) {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}

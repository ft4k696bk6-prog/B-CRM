"use client";

import { BellRing, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type State = "hidden" | "checking" | "required" | "blocked" | "unsupported" | "working" | "error";
type Config = { publicKey?: string; subscriptions?: Array<{ enabled: boolean }>; error?: string };

function keyBytes(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function supported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function verifiedKey(userId: string) {
  return `bcrm:push-verified:${userId}`;
}

function wasVerifiedThisSession(userId: string) {
  try {
    return window.sessionStorage.getItem(verifiedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markVerifiedThisSession(userId: string) {
  try {
    window.sessionStorage.setItem(verifiedKey(userId), "1");
  } catch {
    // sessionStorage may be unavailable in restricted browser modes.
  }
}

export function MandatoryPushGate() {
  const [state, setState] = useState<State>("hidden");
  const [publicKey, setPublicKey] = useState("");
  const [message, setMessage] = useState("");
  const checkingUserRef = useRef<string | null>(null);

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token || null, []);

  const register = useCallback(async (key: string) => {
    const accessToken = await token();
    if (!accessToken) throw new Error("Sesja wygasła.");
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    }
    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!p256dh || !auth) throw new Error("Brak kluczy urządzenia push.");
    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth, notification_time: "09:00", enabled: true })
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(body.error || "Nie udało się zapisać powiadomień.");
  }, [token]);

  const check = useCallback(async () => {
    setMessage("");
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return setState("hidden");

    const userId = session.user.id;
    if (wasVerifiedThisSession(userId) || checkingUserRef.current === userId) return setState("hidden");
    checkingUserRef.current = userId;
    setState("checking");

    try {
      const { data: profile } = await supabase.from("profiles").select("crm_environment").eq("id", userId).maybeSingle();
      if (!profile || profile.crm_environment !== "production") return setState("hidden");

      const response = await fetch("/api/push/subscriptions", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as Config;
      if (!response.ok || !body.publicKey) {
        setMessage(body.error || "Nie udało się sprawdzić powiadomień.");
        return setState("error");
      }
      setPublicKey(body.publicKey);
      if ((body.subscriptions || []).some((item) => item.enabled)) {
        markVerifiedThisSession(userId);
        return setState("hidden");
      }
      if (!supported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      if (Notification.permission === "granted") {
        try {
          setState("working");
          await register(body.publicKey);
          markVerifiedThisSession(userId);
          return setState("hidden");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Nie udało się aktywować powiadomień.");
        }
      }
      setState("required");
    } finally {
      checkingUserRef.current = null;
    }
  }, [register]);

  useEffect(() => {
    void check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION") setTimeout(() => void check(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  async function enable() {
    if (!supported()) return setState("unsupported");
    setState("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") return setState("blocked");
      if (permission !== "granted") return setState("required");
      await register(publicKey);
      const session = (await supabase.auth.getSession()).data.session;
      if (session) markVerifiedThisSession(session.user.id);
      setState("hidden");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się aktywować powiadomień.");
      setState("error");
    }
  }

  async function logout() {
    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      try {
        window.sessionStorage.removeItem(verifiedKey(session.user.id));
      } catch {
        // Ignore storage cleanup errors during logout.
      }
    }
    await supabase.auth.signOut();
    location.href = "/login";
  }

  if (state === "hidden") return null;
  const busy = state === "checking" || state === "working";
  const blocked = state === "blocked";
  const unsupported = state === "unsupported";

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky/10 text-sky"><BellRing className="h-6 w-6" /></div>
          <div><div className="text-xs font-black uppercase tracking-wider text-sky">B-CRM</div><h2 className="mt-1 text-xl font-black">Powiadomienia są wymagane</h2></div>
        </div>
        <p className="text-sm leading-6 text-muted">Powiadomienia o spotkaniach i callbackach są obowiązkowe. Bez ich aktywacji korzystanie z CRM jest zablokowane.</p>
        {busy ? <div className="mt-4 rounded-xl border border-line p-4 text-sm font-semibold text-muted">Sprawdzam ustawienia powiadomień…</div> : null}
        {blocked ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Powiadomienia są zablokowane.</strong><br />Włącz je dla B-CRM w ustawieniach telefonu lub przeglądarki, wróć tutaj i sprawdź ponownie.</div> : null}
        {unsupported ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>To urządzenie lub sposób otwarcia nie obsługuje push.</strong><br />Na iPhone dodaj B-CRM do ekranu początkowego z Safari i uruchom CRM z ikony. Na komputerze użyj aktualnego Chrome, Edge lub Safari.</div> : null}
        {message && !busy ? <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">{message}</div> : null}
        {!busy && !blocked && !unsupported ? <button type="button" onClick={enable} className="btn-primary mt-5 w-full justify-center py-3"><BellRing className="h-5 w-5" />Włącz powiadomienia i przejdź do CRM</button> : null}
        {!busy && (blocked || state === "error") ? <button type="button" onClick={() => void check()} className="btn-primary mt-5 w-full justify-center py-3"><RefreshCw className="h-4 w-4" />Sprawdź ponownie</button> : null}
        <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-muted"><LogOut className="h-4 w-4" />Wyloguj</button>
      </div>
    </div>
  );
}
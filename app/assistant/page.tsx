"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mic,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { answerCompatibilityQuestion, equipmentRecords } from "@/lib/equipment-compatibility";
import { formatPhoneReadable } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type AssistantAction = {
  type: "meeting" | "callback" | "note";
  lead: Lead | null;
  at: string;
  note: string;
};

const verdictClass = {
  compatible: "border-leaf/20 bg-leaf/10 text-leaf",
  conditional: "border-warn/25 bg-warn/10 text-warn",
  unknown: "border-sky/20 bg-sky/10 text-sky",
  not_compatible: "border-danger/20 bg-danger/10 text-danger"
};

function speechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const maybeWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return maybeWindow.SpeechRecognition || maybeWindow.webkitSpeechRecognition || null;
}

function localDatetimeFromPhrase(text: string) {
  const now = new Date();
  const normalized = text.toLowerCase();
  const day = new Date(now);

  if (normalized.includes("pojutrze")) day.setDate(day.getDate() + 2);
  else if (normalized.includes("jutro")) day.setDate(day.getDate() + 1);

  const hourMatch = normalized.match(/(?:o|godz(?:ina|inie)?|g)\s*(\d{1,2})(?::|\.| )?(\d{2})?/);
  const hour = hourMatch ? Math.min(Math.max(Number(hourMatch[1]), 7), 21) : now.getHours() + 1;
  const minute = hourMatch?.[2] ? Number(hourMatch[2]) : 0;

  day.setHours(hour, minute, 0, 0);
  return day.toISOString();
}

function findLeadInText(text: string, leads: Lead[]) {
  const normalized = text.toLowerCase();
  const digits = text.replace(/\D/g, "");

  return (
    leads.find((lead) => digits.length >= 6 && lead.phone.replace(/\D/g, "").includes(digits.slice(-9))) ||
    leads.find((lead) => normalized.includes(lead.full_name.toLowerCase().split(" ")[0])) ||
    null
  );
}

function buildAction(text: string, leads: Lead[]): AssistantAction {
  const normalized = text.toLowerCase();
  const lead = findLeadInText(text, leads);
  const type = normalized.includes("callback") || normalized.includes("oddzwo") ? "callback" : normalized.includes("notatk") ? "note" : "meeting";
  return {
    type,
    lead,
    at: localDatetimeFromPhrase(text),
    note: text.trim()
  };
}

export default function AssistantPage() {
  const { loading, profile } = useAuth(["owner", "admin", "kierownik", "handlowiec"]);
  const [question, setQuestion] = useState("GoodWe 10 kW hybrydowy czy podejdzie do Kon-TEC 10 kWh?");
  const [command, setCommand] = useState("");
  const [action, setAction] = useState<AssistantAction | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  const answer = useMemo(() => answerCompatibilityQuestion(question), [question]);
  const speechAvailable = Boolean(speechConstructor());

  useEffect(() => {
    async function loadLeads() {
      if (!profile) return;

      let query = supabase
        .from("leads")
        .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
        .eq("crm_environment", profile.crm_environment)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (profile.role === "handlowiec") query = query.eq("assigned_to", profile.id);

      const { data } = await query;
      setLeads((data || []) as Lead[]);
    }

    loadLeads();
  }, [profile?.id, profile?.crm_environment, profile?.role]);

  function startVoice() {
    const Recognition = speechConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "pl-PL";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      setCommand(transcript);
      setAction(buildAction(transcript, leads));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function prepareAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAction(buildAction(command, leads));
  }

  async function confirmAction() {
    if (!profile || !action?.lead) return;

    setBusy(true);
    setMessage("");
    setError("");

    const patch =
      action.type === "callback"
        ? { status: "Call back", callback_at: action.at }
        : action.type === "meeting"
          ? { status: "Spotkanie", meeting_at: action.at, meeting_address: action.lead.address || "" }
          : {};

    if (action.type !== "note") {
      const { error: updateError } = await supabase
        .from("leads")
        .update(patch)
        .eq("id", action.lead.id)
        .eq("crm_environment", profile.crm_environment);

      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }
    }

    const title = action.type === "callback" ? "Asystent: callback" : action.type === "meeting" ? "Asystent: spotkanie" : "Asystent: notatka";
    await supabase.from("lead_history").insert({
      lead_id: action.lead.id,
      user_id: profile.id,
      action_type: action.type === "note" ? "comment" : action.type === "callback" ? "callback_set" : "meeting_set",
      description: `${title}. ${action.note}`
    });

    setMessage("Zapisano w CRM.");
    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5 pb-20 md:pb-0">
        <PageHeader
          title="Asystent"
          description="Pomoc techniczna sprzętu i szybkie akcje CRM po głosie albo krótkiej komendzie."
        />

        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="app-card">
            <SectionHeader icon={Wrench} title="Kompatybilność sprzętu" tone="sky" />
            <label>
              <span className="label">Pytanie handlowca</span>
              <textarea
                className="field min-h-24"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>

            <div className={`mt-4 rounded-lg border p-4 ${verdictClass[answer.verdict]}`}>
              <div className="flex items-start gap-3">
                {answer.verdict === "compatible" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
                ) : answer.verdict === "not_compatible" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
                ) : (
                  <Sparkles className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
                )}
                <div>
                  <h2 className="font-black text-ink">{answer.title}</h2>
                  <p className="mt-1 text-sm leading-6">{answer.summary}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-[#f8fafc] p-4">
                <h3 className="text-sm font-black text-ink">Uzasadnienie</h3>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                  {answer.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-line bg-[#f8fafc] p-4">
                <h3 className="text-sm font-black text-ink">Braki / źródła</h3>
                {answer.missing.length > 0 ? (
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                    {answer.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">Brak krytycznych braków w tej regule.</p>
                )}
                <div className="mt-3 grid gap-1">
                  {answer.sourceUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky hover:underline">
                      Źródło
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="app-card">
            <SectionHeader icon={Bot} title="Akcja operacyjna" tone="leaf" />
            <form onSubmit={prepareAction} className="grid gap-3">
              <label>
                <span className="label">Komenda</span>
                <textarea
                  className="field min-h-24"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="np. Umów spotkanie z Janem jutro o 14, klient chce magazyn i raty"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Przygotuj
                </button>
                <button type="button" onClick={startVoice} disabled={!speechAvailable || listening} className="btn-secondary">
                  {listening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                  Mikrofon
                </button>
              </div>
            </form>

            {action ? (
              <div className="mt-5 rounded-lg border border-line bg-[#f8fafc] p-4">
                <h3 className="font-black text-ink">Do zatwierdzenia</h3>
                {action.lead ? (
                  <div className="mt-3 grid gap-3 text-sm">
                    <div>
                      <div className="font-bold text-ink">{action.lead.full_name}</div>
                      <a href={`tel:${action.lead.phone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex items-center gap-2 text-sky">
                        <PhoneCall className="h-4 w-4" aria-hidden="true" />
                        {formatPhoneReadable(action.lead.phone)}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      {new Date(action.at).toLocaleString("pl-PL")}
                    </div>
                    <p className="leading-6 text-muted">{action.note}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={confirmAction} disabled={busy} className="btn-primary">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Zapisz w CRM
                      </button>
                      <Link href={`/leads/${action.lead.id}`} className="btn-secondary">
                        Karta klienta
                      </Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Nie znalazłem klienta"
                    description="Dopisz nazwisko albo numer telefonu. Asystent nie zapisze akcji bez jednoznacznego rekordu."
                  />
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="app-card">
          <SectionHeader icon={Search} title="Sprzęt w bazie" tone="solar" />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {equipmentRecords.map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-[#f8fafc] p-3">
                <div className="text-sm font-black text-ink">{item.brand} {item.model}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{item.kind} · {item.batteryVoltage}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

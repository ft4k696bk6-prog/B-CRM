import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";

type KsefAction = "prepare_accounting_package" | "send_ksef_invoice";

type KsefBody = {
  action?: KsefAction;
  contract?: Record<string, unknown>;
};

function getSupabaseClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) throw new Error("Brakuje konfiguracji Supabase.");

  return createClient(url, anonKey, {
    global: {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  });
}

function canUseKsef(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin" || normalized === "ksiegowosc";
}

function buildKsefPayload(body: KsefBody, userId: string) {
  const contract = body.contract || {};
  return {
    action: body.action || "prepare_accounting_package",
    source: "B-CRM",
    generatedAt: new Date().toISOString(),
    requestedBy: userId,
    invoice: {
      contractNumber: contract.contractNumber || "",
      sellerName: contract.companyName || "",
      sellerNip: contract.companyNip || "",
      buyerName: contract.clientName || "",
      buyerAddress: [contract.address, contract.postalCode, contract.city].filter(Boolean).join(", "),
      netAmount: contract.netPrice || "",
      grossAmount: contract.grossPrice || "",
      service: "Instalacja OZE wraz z montażem"
    }
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    if (!token) return NextResponse.json({ error: "Brak sesji." }, { status: 401 });

    const supabase = getSupabaseClient(token);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,email,role")
      .eq("id", user.id)
      .single();

    if (!canUseKsef(profile?.role)) {
      return NextResponse.json({ error: "Tylko księgowość, admin i właściciel mogą użyć KSeF." }, { status: 403 });
    }

    const body = (await request.json()) as KsefBody;
    const payload = buildKsefPayload(body, user.id);
    const endpoint = process.env.KSEF_API_URL;
    const tokenValue = process.env.KSEF_API_TOKEN;

    if (!endpoint || !tokenValue) {
      return NextResponse.json({
        mode: "demo",
        sent: false,
        title:
          body.action === "send_ksef_invoice"
            ? "Demo KSeF: wysyłka zatrzymana"
            : "Demo KSeF: paczka księgowa gotowa",
        message:
          "Środowisko nie ma skonfigurowanych danych produkcyjnych KSeF, więc CRM pokazuje gotowy payload i bezpiecznie nie wysyła danych klienta.",
        payload
      });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenValue}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    return NextResponse.json({
      mode: "live",
      sent: response.ok,
      status: response.status,
      title: response.ok ? "KSeF: żądanie przyjęte" : "KSeF: błąd integracji",
      message: response.ok
        ? "CRM wysłał payload do skonfigurowanego endpointu KSeF."
        : "Endpoint KSeF zwrócił błąd. Szczegóły są poniżej.",
      payload,
      response: text.slice(0, 2000)
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd integracji KSeF." },
      { status: 500 }
    );
  }
}

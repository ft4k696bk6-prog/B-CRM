import { NextResponse } from "next/server";
import { optionalString } from "@/lib/api-validation";
import { normalizePhoneForDial } from "@/lib/phone";
import { requireApiProfile } from "@/lib/server-auth";

type UpdateProfileBody = {
  businessPhone?: string;
};

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as UpdateProfileBody;
    const businessPhoneInput = optionalString(body.businessPhone, "businessPhone", 40);

    if (!businessPhoneInput.ok) {
      return NextResponse.json({ error: businessPhoneInput.error }, { status: 400 });
    }

    const businessPhone = businessPhoneInput.data ? normalizePhoneForDial(businessPhoneInput.data) : null;

    if (businessPhoneInput.data && !businessPhone) {
      return NextResponse.json({ error: "Podaj numer w formacie +48 600 000 000." }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from("profiles")
      .update({ business_phone: businessPhone })
      .eq("id", auth.profile.id)
      .eq("crm_environment", auth.profile.crm_environment)
      .select("id,business_phone")
      .single();

    if (error) {
      if (error.message.includes("business_phone")) {
        return NextResponse.json(
          { error: "Brakuje kolumny business_phone. Uruchom migrację supabase/10_click_to_call_ai.sql w Supabase." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd." },
      { status: 500 }
    );
  }
}

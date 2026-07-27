import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  return NextResponse.json(
    {
      error:
        "Automatyczne porządkowanie zostało wyłączone, aby nie zmieniać istniejących statusów, przypisań, terminów ani danych leadów."
    },
    { status: 410 }
  );
}

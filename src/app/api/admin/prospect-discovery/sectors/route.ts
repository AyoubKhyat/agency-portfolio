import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SECTORS, CITIES, NEIGHBORHOODS_MARRAKECH } from "@/lib/discovery-providers";

// Static reference data — sectors / cities / neighborhoods. Keeps client in sync with server.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    sectors: SECTORS.map((s) => ({ key: s.key, label: s.label, category: s.category })),
    cities: CITIES.map((c) => ({ key: c.key, label: c.label })),
    neighborhoods: { MARRAKECH: NEIGHBORHOODS_MARRAKECH },
    providerConfigured: process.env.GOOGLE_PLACES_API_KEY ? "GOOGLE" : "OSM",
  });
}

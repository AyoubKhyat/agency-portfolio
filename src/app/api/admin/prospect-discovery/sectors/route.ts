import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { SECTORS, CITIES, NEIGHBORHOODS_MARRAKECH } from "@/lib/discovery-providers";

// Static reference data — sectors / cities / neighborhoods. Keeps client in sync with server.
export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  return NextResponse.json({
    sectors: SECTORS.map((s) => ({ key: s.key, label: s.label, category: s.category })),
    cities: CITIES.map((c) => ({ key: c.key, label: c.label })),
    neighborhoods: { MARRAKECH: NEIGHBORHOODS_MARRAKECH },
    providerConfigured: process.env.GOOGLE_PLACES_API_KEY ? "GOOGLE" : "OSM",
  });
}

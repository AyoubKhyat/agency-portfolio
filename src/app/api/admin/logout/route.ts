import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(deleteSessionCookie());
  return res;
}

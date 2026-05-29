import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL;
  const hasUrl = !!url;
  const urlPrefix = url ? url.substring(0, 20) + "..." : "NOT SET";

  let dbError = null;
  let dbOk = false;

  if (url) {
    try {
      const { Pool } = await import("@neondatabase/serverless");
      const pool = new Pool({ connectionString: url });
      const result = await pool.query("SELECT 1 as test");
      dbOk = result.rows[0]?.test === 1;
      await pool.end();
    } catch (e) {
      dbError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    hasUrl,
    urlPrefix,
    dbOk,
    dbError,
    nodeEnv: process.env.NODE_ENV,
  });
}

import { NextResponse } from "next/server";

/**
 * Structured API error logger and route handler wrapper.
 *
 * Wraps an API route handler to catch unhandled errors, log them in a
 * structured JSON format to console.error, and return a generic 500 response.
 *
 * Usage:
 *   export const POST = withApiLogging("POST /api/admin/login", handler);
 */

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  error: string;
  stack?: string;
}

function logError(entry: LogEntry) {
  console.error(JSON.stringify(entry));
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with structured error logging.
 *
 * @param routeLabel - A human-readable label like "POST /api/admin/login"
 * @param handler - The actual route handler function
 * @returns A wrapped handler that catches errors and logs them
 */
export function withApiLogging(routeLabel: string, handler: RouteHandler): RouteHandler {
  const [method, path] = routeLabel.includes(" ")
    ? routeLabel.split(" ", 2)
    : ["UNKNOWN", routeLabel];

  return async (req: Request, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      };

      if (error instanceof Error && error.stack) {
        entry.stack = error.stack;
      }

      logError(entry);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

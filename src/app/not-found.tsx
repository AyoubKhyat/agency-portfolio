import Link from "next/link";

// The root layout (app/layout.tsx) already renders <html> and <body> around this page, so the
// 404 is a full-viewport <main>, not a second document (that nesting broke hydration).
export default function NotFound() {
  return (
    <main
      style={{
        flex: 1,
        width: "100%",
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#f0efef",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div
          style={{
            fontSize: "120px",
            fontWeight: 800,
            lineHeight: 1,
            background: "linear-gradient(135deg, #A78BFA, #2563EB)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </div>
        <p
          style={{
            fontSize: "20px",
            color: "#888",
            marginTop: "16px",
            marginBottom: "32px",
          }}
        >
          This page doesn&apos;t exist.
        </p>
        <Link
          href="/fr"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            background: "#A78BFA",
            color: "#fff",
            borderRadius: "12px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

import type { ComponentProps } from "react";

/**
 * Blog posts are plain Markdown, never MDX: no raw HTML, no JSX components, no {expressions}.
 * In "md" format the compiler drops raw HTML (script, iframe, style, inline handlers…) and shows
 * braces as text, while headings, emphasis, lists, quotes, code, links and images still render.
 */
export const SAFE_MARKDOWN_OPTIONS = {
  mdxOptions: { format: "md" as const },
  blockJS: true,
  blockDangerousJS: true,
};

/** Only web, mail, phone, in-page and site-relative addresses are allowed in links and images. */
export function safeUrl(url: unknown, kind: "link" | "image"): string | undefined {
  if (typeof url !== "string") return undefined;
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (kind === "link" && u.startsWith("#")) return u;
  const allowed = kind === "link" ? /^(https?:|mailto:|tel:)/i : /^https?:/i;
  return allowed.test(u) ? u : undefined;
}

function SafeLink({ href, children, ...rest }: ComponentProps<"a">) {
  const safe = safeUrl(href, "link");
  if (!safe) return <span>{children}</span>;
  const external = /^https?:/i.test(safe);
  return (
    <a {...rest} href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function SafeImage({ src, alt, ...rest }: ComponentProps<"img">) {
  const safe = safeUrl(src, "image");
  if (!safe) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Markdown images have unknown sizes; next/image needs them
  return <img {...rest} src={safe} alt={alt ?? ""} loading="lazy" />;
}

export const SAFE_MARKDOWN_COMPONENTS = { a: SafeLink, img: SafeImage };

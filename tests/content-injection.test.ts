/**
 * Public-content script injection (S3a). Hostile test strings are harmless: they only try to set a
 * global flag and are never executed — the tests inspect the rendered HTML.
 *  - JSON-LD blocks can never be closed by data (</script>), and the JSON stays identical.
 *  - Blog posts render as plain Markdown: no raw HTML, JSX or expressions; only safe link/image URLs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { serializeJsonLd } from "../src/lib/json-ld";
import { SAFE_MARKDOWN_OPTIONS, SAFE_MARKDOWN_COMPONENTS, safeUrl } from "../src/lib/safe-markdown";

const HOSTILE = [
  "</script><script>window.__pwned=1</script>",
  "</SCRIPT ><img src=x onerror=window.__pwned=1>",
  "<!--<script>",
  "a & b < c > d",
  `line${String.fromCharCode(0x2028)}sep${String.fromCharCode(0x2029)}para`,
];

test("JSON-LD: data can never close the script block, and parses back identically", () => {
  for (const s of HOSTILE) {
    const data = { "@type": "CreativeWork", name: s, description: s, author: { name: s } };
    const out = serializeJsonLd(data);
    assert.doesNotMatch(out, /[<>&]/, `raw <, > or & in output for ${JSON.stringify(s)}`);
    assert.equal(out.includes(String.fromCharCode(0x2028)) || out.includes(String.fromCharCode(0x2029)), false);
    assert.deepEqual(JSON.parse(out), data, "same data for search engines");
  }
  assert.equal(serializeJsonLd({ name: "Ibda3 Digital", url: "https://www.ibda3digital.com/fr" }), JSON.stringify({ name: "Ibda3 Digital", url: "https://www.ibda3digital.com/fr" }), "ordinary data is unchanged");
});

test("every JSON-LD block in the app goes through serializeJsonLd", () => {
  const root = fileURLToPath(new URL("../src/", import.meta.url));
  const files: string[] = [];
  (function walk(d: string) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "generated") walk(p); } else if (/\.tsx?$/.test(f)) files.push(p);
    }
  })(root);
  let blocks = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
      blocks++;
      assert.match(m[1].trim(), /^serializeJsonLd\(/, `${f}: raw HTML insertion must use serializeJsonLd`);
    }
  }
  assert.ok(blocks >= 9, `found ${blocks} blocks`);
});

// The MDX compiler is ESM-only; load it with import() (this test file runs as CommonJS under tsx).
async function renderPost(markdown: string) {
  const { serialize } = await import("next-mdx-remote/serialize");
  const { MDXRemote } = await import("next-mdx-remote");
  const compiled = await serialize(markdown, SAFE_MARKDOWN_OPTIONS);
  return renderToStaticMarkup(createElement(MDXRemote, { ...compiled, components: SAFE_MARKDOWN_COMPONENTS }));
}

test("blog posts: raw HTML, JSX, expressions and unsafe URLs never reach the page", async () => {
  const cases: Record<string, string> = {
    "script block": "Intro\n\n<script>window.__pwned=1</script>\n\nOutro",
    "inline script": "Texte <script>window.__pwned=1</script> suite",
    iframe: '<iframe src="https://evil.example/phish"></iframe>',
    "img onerror": '<img src="x" onerror="window.__pwned=1">',
    style: "<style>body{display:none}</style>",
    "JSX component": "<Foo bar={1} />",
    "svg onload": '<svg onload="window.__pwned=1"></svg>',
    "javascript: link": "[click](javascript:window.__pwned=1)",
    "data: link": "[click](data:text/html,<script>window.__pwned=1</script>)",
    "javascript: image": "![x](javascript:window.__pwned=1)",
    "data: image": "![x](data:image/svg+xml,<svg onload=window.__pwned=1>)",
    "protocol-relative image": "![x](//evil.example/x.png)",
  };
  for (const [name, md] of Object.entries(cases)) {
    const html = await renderPost(md);
    assert.doesNotMatch(html, /<(script|iframe|style|svg|object|embed)\b/i, `${name}: dangerous element`);
    assert.doesNotMatch(html, /<[^>]*\son[a-z]+=/i, `${name}: inline handler attribute`); // escaped text is fine
    assert.doesNotMatch(html, /(href|src)="\s*(javascript|data|vbscript):/i, `${name}: unsafe URL`);
    assert.doesNotMatch(html, /src="\/\//, `${name}: protocol-relative image`);
  }
  const expr = await renderPost("Prix: {window.__pwned=1}");
  assert.match(expr, /\{window\.__pwned=1\}/, "braces are shown as plain text, never evaluated");
});

test("blog posts: normal Markdown, links, images and FR/EN/AR text still render", async () => {
  const html = await renderPost([
    "# Titre principal", "", "## Section", "",
    "Un texte **gras**, *italique* et `code`.", "",
    "- premier", "- second", "", "1. un", "2. deux", "",
    "> Une citation", "",
    "[Contact](https://www.ibda3digital.com/fr/contact) · [Services](/en/services) · [mail](mailto:hello@example.com)", "",
    "![Couverture](/projects/aylani-parfums.webp)", "",
    "```", "const x = 1;", "```", "",
    "Hello world · مرحبا بكم في إبداع",
  ].join("\n"));
  for (const tag of ["<h1>Titre principal</h1>", "<h2>Section</h2>", "<strong>gras</strong>", "<em>italique</em>", "<code>code</code>", "<li>premier</li>", "<ol>", "<blockquote>", "<pre>"]) {
    assert.ok(html.includes(tag), `missing ${tag}`);
  }
  assert.match(html, /<a href="https:\/\/www\.ibda3digital\.com\/fr\/contact" target="_blank" rel="noopener noreferrer">Contact<\/a>/, "external links open safely");
  assert.match(html, /<a href="\/en\/services">Services<\/a>/, "site links stay in the tab");
  assert.match(html, /<a href="mailto:hello@example\.com">mail<\/a>/);
  assert.match(html, /<img src="\/projects\/aylani-parfums\.webp" alt="Couverture" loading="lazy"\/>/);
  assert.ok(html.includes("مرحبا بكم في إبداع"), "Arabic text intact");
});

test("safeUrl allows only web, mail, phone, in-page and site-relative addresses", () => {
  const ok: [string, "link" | "image"][] = [["https://a.ma/x", "link"], ["http://a.ma", "link"], ["/fr/blog", "link"], ["#top", "link"], ["mailto:a@b.ma", "link"], ["tel:+212600000000", "link"], ["https://a.ma/i.png", "image"], ["/projects/x.webp", "image"]];
  const bad: [string, "link" | "image"][] = [["javascript:alert(1)", "link"], [" JavaScript:alert(1)", "link"], ["data:text/html,x", "link"], ["vbscript:x", "link"], ["//evil.example", "link"], ["#x", "image"], ["mailto:a@b.ma", "image"], ["data:image/png;base64,AAAA", "image"]];
  for (const [u, k] of ok) assert.ok(safeUrl(u, k), `${u} (${k}) should be allowed`);
  for (const [u, k] of bad) assert.equal(safeUrl(u, k), undefined, `${u} (${k}) should be refused`);
});

test("the blog page renders posts with the safe Markdown options and components", () => {
  const page = readFileSync(new URL("../src/app/[locale]/blog/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<MDXRemote source=\{post\.content\} options=\{SAFE_MARKDOWN_OPTIONS\} components=\{SAFE_MARKDOWN_COMPONENTS\} \/>/);
  assert.doesNotMatch(page, /<MDXRemote source=\{post\.content\} \/>/);
});

/**
 * Serialise structured data for a <script type="application/ld+json"> block.
 *
 * JSON.stringify leaves "<", ">" and "&" as-is, so a value such as "</script><script>..." (a project
 * title, a blog excerpt) would close the block and start a real script. Writing those characters as
 * JSON unicode escapes (backslash-u003c and so on) keeps the data identical for parsers while making
 * a closing tag impossible. U+2028 / U+2029 are escaped too: they are line terminators in older
 * JavaScript parsers.
 */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

// Temporary (homepage-v2, phase 1): which portfolio projects are real client work.
// Every other visible project is shown as a concept, so nothing is ever mislabelled
// as a client. Replace with a database field once the admin has a client/concept selector.
export const CLIENT_SLUGS: ReadonlySet<string> = new Set([
  "aylani-parfums",
  "dandana-cabaret",
  "luxury-copro",
  "terrene",
]);

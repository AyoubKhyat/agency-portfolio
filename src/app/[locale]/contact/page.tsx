import ContactV2 from "@/components/contact-v2/ContactV2";
import { parseServiceParam } from "@/lib/services-catalog";

// The previous page is kept in src/components/contact-legacy/LegacyContact.tsx for rollback.
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const { locale } = await params;
  // ?service=<id> preselects that service in the form; unknown or repeated values preselect nothing.
  const { service } = await searchParams;
  return <ContactV2 locale={locale} initialService={parseServiceParam(service)} />;
}

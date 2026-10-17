import ContactV2 from "@/components/contact-v2/ContactV2";

// The previous page is kept in src/components/contact-legacy/LegacyContact.tsx for rollback.
export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ContactV2 locale={locale} />;
}

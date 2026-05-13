import { getVisibleProjects } from "@/lib/dal";
import PortfolioGrid from "@/components/PortfolioGrid";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const projects = await getVisibleProjects(locale);

  return <PortfolioGrid projects={projects} />;
}

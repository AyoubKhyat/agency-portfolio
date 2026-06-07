import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/motion";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import BlogList from "@/components/BlogList";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  const posts = await getAllPosts(locale);
  const categories = await getAllCategories(locale);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-accent top-10 left-1/2 opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">{t("title")}</span>
            <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
              {t("title").split(" ")[0]}{" "}
              <span className="text-primary italic">
                {t("title").split(" ").slice(1).join(" ")}
              </span>
            </h1>
            <p className="mt-6 font-serif italic text-xl text-text-muted max-w-lg">
              {t("subtitle")}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Posts */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlogList
            posts={posts}
            categories={categories}
            filterAllLabel={t("filter_all")}
            minReadLabel={t("min_read")}
            readArticleLabel={t("read_article")}
          />
        </div>
      </section>
    </>
  );
}

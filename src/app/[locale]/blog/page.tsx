import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import BlogList from "@/components/BlogList";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { pageMetadata } from "@/lib/site";
import s from "./blog.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  return pageMetadata({ locale, path: "/blog", title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") });
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
  const rtl = locale === "ar";
  const words = t("title").split(" ");

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      {/* Hero: Services/About hero scaffolding (label row, serif headline, serif lede) */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={`${s.heroTop} ${s.label} hero-enter`}>
            <span>{t("title")}</span>
          </div>
          <h1 className={`${s.pageTitle} hero-enter`} style={{ "--enter-delay": "0.15s" } as CSSProperties}>
            {words[0]}
            {words.length > 1 && (
              <>
                {" "}
                <span className={s.gradText}>{words.slice(1).join(" ")}</span>
              </>
            )}
          </h1>
          <p className={`${s.lede} hero-enter`} style={{ "--enter-delay": "0.3s" } as CSSProperties}>
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className={s.posts}>
        <div className={s.wrap}>
          <BlogList
            posts={posts}
            categories={categories}
            filterAllLabel={t("filter_all")}
            minReadLabel={t("min_read")}
            readArticleLabel={t("read_article")}
          />
        </div>
      </section>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HiArrowLeft, HiOutlineClock, HiOutlineUser } from "react-icons/hi2";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { getPostBySlug, getAllPostSlugs } from "@/lib/blog";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SITE_URL, pageMetadata } from "@/lib/site";
import { serializeJsonLd } from "@/lib/json-ld";
import { SAFE_MARKDOWN_OPTIONS, SAFE_MARKDOWN_COMPONENTS } from "@/lib/safe-markdown";
import s from "../blog.module.css";

const BASE_URL = SITE_URL;

function BlogPostJsonLd({
  locale,
  slug,
  title,
  excerpt,
  date,
  author,
}: {
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: excerpt,
    datePublished: date,
    url: `${BASE_URL}/${locale}/blog/${slug}`,
    inLanguage: locale,
    author: { "@type": "Organization", name: author },
    publisher: {
      "@type": "Organization",
      name: "Ibda3 Digital",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/icon.png` },
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
    />
  );
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs("fr");
  const locales = ["fr", "en", "ar"];
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug, locale);
  if (!post) return {};

  return pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${post.title} — Ibda3 Digital`,
    description: post.excerpt,
    type: "article",
    image: post.image,
    article: { publishedTime: post.date || undefined, authors: [post.author] },
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug, locale);
  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: "Blog" });
  const nav = await getTranslations({ locale, namespace: "Nav" });
  const rtl = locale === "ar";

  return (
    <>
      <BlogPostJsonLd
        locale={locale}
        slug={slug}
        title={post.title}
        excerpt={post.excerpt}
        date={post.date}
        author={post.author}
      />

      <div dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
        {/* Hero: blog index / Services scaffolding (label row with hairline, serif page title) */}
        <section className={s.hero}>
          <div className={s.wrap}>
            <div className={`${s.heroTop} ${s.articleTop} ${s.label} hero-enter`}>
              <Link href="/blog" className={s.back}>
                <HiArrowLeft className={s.backArr} aria-hidden="true" />
                {t("back_to_blog")}
              </Link>
              <span>{post.category}</span>
            </div>

            <h1 className={`${s.pageTitle} ${s.articleTitle} hero-enter`} style={{ "--enter-delay": "0.15s" } as CSSProperties}>
              {post.title}
            </h1>

            <div className={`${s.meta} hero-enter`} style={{ "--enter-delay": "0.3s" } as CSSProperties}>
              <span>
                <HiOutlineUser aria-hidden="true" />
                {post.author}
              </span>
              <span>{post.date}</span>
              <span>
                <HiOutlineClock aria-hidden="true" />
                {post.readTime} {t("min_read")}
              </span>
            </div>
          </div>
        </section>

        {/* Content: neutral plate, reading measure on the header's start edge */}
        <section className={s.article}>
          <div className={s.wrap}>
            <article className={`prose-blog ${s.measure}`}>
              <MDXRemote source={post.content} options={SAFE_MARKDOWN_OPTIONS} components={SAFE_MARKDOWN_COMPONENTS} />
            </article>
          </div>
        </section>

        {/* CTA: Services purple-to-blue CTA (same markup and values) */}
        <section className={s.cta}>
          <div className={s.wrap}>
            <span className={s.label}>
              <span>{nav("contact")}</span>
            </span>
            <h2 className={`${s.ctaTitle} ${s.disp}`}>{t("cta_title")}</h2>
            <div className={`${s.grid12} ${s.ctaRow}`}>
              <p>{t("cta_desc")}</p>
              <div className={s.act}>
                <Link href="/contact" className={s.pillWhite}>
                  <span>{t("cta_button")}</span>
                  <span className={s.flip} aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

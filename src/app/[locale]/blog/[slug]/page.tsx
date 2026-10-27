import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HiArrowLeft, HiOutlineClock, HiOutlineUser } from "react-icons/hi2";
import { FadeIn } from "@/components/motion";
import { getPostBySlug, getAllPostSlugs } from "@/lib/blog";
import { MDXRemote } from "next-mdx-remote/rsc";
import { SITE_URL, pageMetadata } from "@/lib/site";
import { serializeJsonLd } from "@/lib/json-ld";
import { SAFE_MARKDOWN_OPTIONS, SAFE_MARKDOWN_COMPONENTS } from "@/lib/safe-markdown";

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

      {/* Hero */}
      <section className="relative bg-background py-20 md:py-28 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary top-0 right-0 opacity-10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] uppercase text-primary hover:text-primary/80 transition-colors mb-8"
            >
              <HiArrowLeft className="w-4 h-4" />
              {t("back_to_blog")}
            </Link>

            <span className="pill text-[11px]">{post.category}</span>

            <h1 className="mt-6 font-serif text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-foreground">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-text-muted">
              <span className="flex items-center gap-2">
                <HiOutlineUser className="w-4 h-4" />
                {post.author}
              </span>
              <span>{post.date}</span>
              <span className="flex items-center gap-1">
                <HiOutlineClock className="w-4 h-4" />
                {post.readTime} {t("min_read")}
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Content */}
      <section className="relative py-16 bg-surface-2 overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn delay={0.1}>
            <article className="prose-blog">
              <MDXRemote source={post.content} options={SAFE_MARKDOWN_OPTIONS} components={SAFE_MARKDOWN_COMPONENTS} />
            </article>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[500px] h-[500px] bg-primary bottom-[-200px] right-[-100px] opacity-20" />
        <FadeIn className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-foreground leading-[0.95]">
            {t("cta_title")}
          </h2>
          <p className="mt-4 text-text-muted max-w-lg mx-auto">
            {t("cta_desc")}
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-mono text-sm tracking-[0.12em] uppercase px-8 py-4 rounded-full transition-colors"
          >
            {t("cta_button")}
          </Link>
        </FadeIn>
      </section>
    </>
  );
}

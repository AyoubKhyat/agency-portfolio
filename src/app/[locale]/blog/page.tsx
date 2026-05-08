import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HiOutlineClock } from "react-icons/hi2";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}

const posts = [
  { key: "post1", readTime: 5 },
  { key: "post2", readTime: 7 },
  { key: "post3", readTime: 4 },
];

export default function BlogPage() {
  const t = useTranslations("Blog");

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-accent top-10 left-1/2 opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="pill">● {t("title")}</span>
          <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
            {t("title").split(" ")[0]} <span className="text-primary italic">{t("title").split(" ").slice(1).join(" ")}</span>
          </h1>
          <p className="mt-6 font-serif italic text-xl text-text-muted max-w-lg">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-line-soft">
            {posts.map((post, i) => (
              <article
                key={post.key}
                className="grid grid-cols-1 md:grid-cols-[60px_1fr_1.5fr_auto] items-start py-10 border-b border-line-soft gap-4 md:gap-8"
              >
                <span className="font-mono text-sm text-primary tracking-[0.12em] hidden md:block pt-2">
                  / {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="pill text-[11px] mb-3">{t(`${post.key}_category`)}</span>
                  <h2 className="mt-3 font-serif text-2xl md:text-3xl text-foreground leading-snug">
                    {t(`${post.key}_title`)}
                  </h2>
                </div>
                <p className="text-text-muted leading-relaxed">
                  {t(`${post.key}_excerpt`)}
                </p>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="text-xs text-text-muted">{t(`${post.key}_date`)}</span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <HiOutlineClock className="w-3.5 h-3.5" />
                    {post.readTime} {t("min_read")}
                  </span>
                  <span className="mt-2 font-mono text-[11px] tracking-[0.16em] uppercase text-primary/50">
                    {t("coming_soon")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

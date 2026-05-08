import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}
import { HiOutlineClock } from "react-icons/hi2";

const posts = [
  { key: "post1", readTime: 5, color: "from-primary/30 to-accent/20" },
  { key: "post2", readTime: 7, color: "from-accent/20 to-primary/30" },
  { key: "post3", readTime: 4, color: "from-primary/20 to-accent/30" },
];

export default function BlogPage() {
  const t = useTranslations("Blog");

  return (
    <>
      <section className="bg-secondary py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-1/2 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white">{t("title")}</h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.key}
                className="group bg-secondary rounded-2xl overflow-hidden border border-white/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all"
              >
                <div
                  className={`h-48 bg-gradient-to-br ${post.color} flex items-center justify-center`}
                >
                  <span className="text-5xl font-bold text-white/10">
                    {t(`${post.key}_category`).charAt(0)}
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium">
                      {t(`${post.key}_category`)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HiOutlineClock className="w-3.5 h-3.5" />
                      {post.readTime} {t("min_read")}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    {t(`${post.key}_title`)}
                  </h2>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                    {t(`${post.key}_excerpt`)}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {t(`${post.key}_date`)}
                    </span>
                    <span className="flex items-center gap-1 text-primary/50 text-sm font-medium cursor-default">
                      {t("coming_soon")}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

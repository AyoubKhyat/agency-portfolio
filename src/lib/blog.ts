import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { prisma, hasPrisma } from "@/lib/prisma";

export type BlogPost = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  category: string;
  readTime: number;
  locale: string;
  author: string;
  image?: string;
};

export type BlogPostWithContent = BlogPost & {
  content: string;
};

const contentDir = path.join(process.cwd(), "content", "blog");

function getDir(locale: string) {
  const dir = path.join(contentDir, locale);
  if (fs.existsSync(dir)) return dir;
  const frDir = path.join(contentDir, "fr");
  if (fs.existsSync(frDir)) return frDir;
  return null;
}

function getMdxPosts(locale: string): BlogPost[] {
  const dir = getDir(locale);
  if (!dir) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const { data } = matter(raw);
    return {
      title: data.title ?? "",
      slug: data.slug ?? file.replace(/\.mdx$/, ""),
      excerpt: data.excerpt ?? "",
      date: data.date ?? "",
      category: data.category ?? "",
      readTime: data.readTime ?? 5,
      locale: data.locale ?? locale,
      author: data.author ?? "Ibda3 Digital",
      image: data.image,
    } satisfies BlogPost;
  });
}

/**
 * Get all published posts for a locale.
 * DB posts take priority over MDX posts with the same slug.
 */
export async function getAllPosts(locale: string): Promise<BlogPost[]> {
  const mdxPosts = getMdxPosts(locale);

  if (!hasPrisma()) {
    return mdxPosts.sort((a, b) => (a.date > b.date ? -1 : 1));
  }

  try {
    const dbPosts = await prisma.blogPost.findMany({
      where: { locale, published: true },
      orderBy: { createdAt: "desc" },
    });

    const dbPostsMapped: BlogPost[] = dbPosts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      date: p.createdAt.toISOString().split("T")[0],
      category: p.category,
      readTime: p.readTime,
      locale: p.locale,
      author: p.author,
      image: p.image ?? undefined,
    }));

    // DB posts take priority: filter out MDX posts that have a matching DB slug
    const dbSlugs = new Set(dbPostsMapped.map((p) => p.slug));
    const uniqueMdxPosts = mdxPosts.filter((p) => !dbSlugs.has(p.slug));

    const merged = [...dbPostsMapped, ...uniqueMdxPosts];
    return merged.sort((a, b) => (a.date > b.date ? -1 : 1));
  } catch {
    return mdxPosts.sort((a, b) => (a.date > b.date ? -1 : 1));
  }
}

/**
 * Get a single post by slug. DB takes priority over MDX.
 */
export async function getPostBySlug(
  slug: string,
  locale: string
): Promise<BlogPostWithContent | null> {
  // Try DB first
  if (hasPrisma()) {
    try {
      const dbPost = await prisma.blogPost.findFirst({
        where: { slug, locale, published: true },
      });
      if (dbPost) {
        return {
          id: dbPost.id,
          title: dbPost.title,
          slug: dbPost.slug,
          excerpt: dbPost.excerpt,
          date: dbPost.createdAt.toISOString().split("T")[0],
          category: dbPost.category,
          readTime: dbPost.readTime,
          locale: dbPost.locale,
          author: dbPost.author,
          image: dbPost.image ?? undefined,
          content: dbPost.content,
        };
      }
    } catch {
      // Fall through to MDX
    }
  }

  // Fallback to MDX file
  const dir = getDir(locale);
  if (!dir) return null;

  const filePath = path.join(dir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    title: data.title ?? "",
    slug: data.slug ?? slug,
    excerpt: data.excerpt ?? "",
    date: data.date ?? "",
    category: data.category ?? "",
    readTime: data.readTime ?? 5,
    locale: data.locale ?? locale,
    author: data.author ?? "Ibda3 Digital",
    image: data.image,
    content,
  };
}

export async function getAllPostSlugs(locale: string): Promise<string[]> {
  const posts = await getAllPosts(locale);
  return posts.map((p) => p.slug);
}

export async function getAllCategories(locale: string): Promise<string[]> {
  const posts = await getAllPosts(locale);
  return [...new Set(posts.map((p) => p.category))];
}

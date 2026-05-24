import fs from "fs";
import path from "path";
import matter from "gray-matter";

export type BlogPost = {
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

export function getAllPosts(locale: string): BlogPost[] {
  const dir = getDir(locale);
  if (!dir) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
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
    })
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(
  slug: string,
  locale: string
): BlogPostWithContent | null {
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

export function getAllPostSlugs(locale: string): string[] {
  return getAllPosts(locale).map((p) => p.slug);
}

export function getAllCategories(locale: string): string[] {
  const posts = getAllPosts(locale);
  return [...new Set(posts.map((p) => p.category))];
}

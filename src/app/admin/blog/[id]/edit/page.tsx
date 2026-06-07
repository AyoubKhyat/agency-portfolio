"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import BlogPostForm from "../../BlogPostForm";

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<null | Record<string, unknown>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/blog/${id}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/blog"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setPost(data);
        setLoading(false);
      });
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
      </div>
    );
  }
  if (!post) return null;

  return (
    <BlogPostForm
      mode="edit"
      initial={{
        id: post.id as string,
        slug: post.slug as string,
        locale: post.locale as string,
        title: post.title as string,
        excerpt: post.excerpt as string,
        content: post.content as string,
        category: post.category as string,
        readTime: post.readTime as number,
        author: post.author as string,
        image: (post.image as string) ?? "",
        published: post.published as boolean,
      }}
    />
  );
}

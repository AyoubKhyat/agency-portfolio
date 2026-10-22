import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { CoverUploadError, checkCoverFile, convertCover, storeCover } from "@/lib/project-cover";

// Uploads only return a URL; the project record is written later by the form's
// save, so a failure here never creates or changes a project.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload. Please try again." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please attach an image file." }, { status: 400 });
  }

  const slug = (formData.get("slug") as string) || file.name.replace(/\.[^.]+$/, "");
  const safeName = slug
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase() || "cover";

  try {
    checkCoverFile(file);
    const webp = await convertCover(Buffer.from(await file.arrayBuffer()));
    const imagePath = await storeCover(webp, safeName);
    return NextResponse.json({ path: imagePath });
  } catch (err) {
    if (err instanceof CoverUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[upload] Project cover upload failed:", err);
    return NextResponse.json({ error: "Image upload failed on the server. Please try again." }, { status: 500 });
  }
}

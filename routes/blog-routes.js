console.log("🧪 LIVE ENV CHECK");
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY PRESENT =", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("IMAGEKIT_PUBLIC =", process.env.IMAGEKIT_PUBLIC_KEY);
console.log("IMAGEKIT_ENDPOINT =", process.env.IMAGEKIT_URL_ENDPOINT);


console.log("🧪 SUPABASE_URL:", process.env.SUPABASE_URL);
console.log(
  "🧪 SUPABASE KEY PRESENT:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

// blog-routes.js
console.log("🔥 BLOG ROUTES FILE LOADED");

import fs from "fs";
import path from "path";
import express from "express";
import { replaceLocalUrls } from "../utils/replaceUrls.js";
import { generateSitemap } from "../utils/generateSitemap.js";
import { fileURLToPath } from "url";
import { verifyToken } from "../utils/jwt.js";
import { requireAdmin } from "../server.js";
import { logAdmin } from "../utils/adminLog.js";

// ✅ SUPABASE (ADDED – does NOT remove file logic)
import { createClient } from "@supabase/supabase-js";
import ImageKit from "imagekit";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

const imagekit =
  process.env.IMAGEKIT_PUBLIC_KEY &&
  process.env.IMAGEKIT_PRIVATE_KEY &&
  process.env.IMAGEKIT_URL_ENDPOINT
    ? new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      })
    : null;

// ---- Simple in-memory cache ----
const cache = {
  blogs: {
    data: null,
    expires: 0,
  },
};

const BLOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
 

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- FILE SYSTEM (KEEPING AS FALLBACK) ----------------
const blogsDir = path.join(__dirname, "..", "blogs");
if (!fs.existsSync(blogsDir)) fs.mkdirSync(blogsDir, { recursive: true });

// =================================================
// ADMIN: UPLOAD IMAGE (IMAGEKIT)
// =================================================
router.post("/api/admin/upload-image", async (req, res) => {
  console.log("🟡 IMAGE UPLOAD ROUTE HIT");
  console.log("🟡 req.files =", req.files);

  if (!requireAdmin(req, res)) return;

  if (!req.files || !req.files.image) {
    console.error("❌ No file received");
    return res.status(400).json({ message: "No image file received" });
  }

  if (!imagekit) {
    console.error("❌ ImageKit instance missing");
    return res.status(500).json({ message: "ImageKit not configured" });
  }

  try {
    const file = req.files.image;

    console.log("🟢 File name:", file.name);
    console.log("🟢 File size:", file.size);

    const upload = await imagekit.upload({
      file: file.data.toString("base64"),
      fileName: file.name,
      folder: "blogs",
    });

    console.log("🟢 ImageKit upload success:", upload.url);
    return res.json({ url: upload.url });
  } catch (err) {
    console.error("❌ ImageKit upload error:", err);
    return res.status(500).json({ message: "Image upload failed" });
  }
});


/* =================================================
   ADMIN: CREATE BLOG
================================================== */
router.post("/api/admin/create-blog", async (req, res) => {
  console.log("🔥 CREATE BLOG HIT");
  console.log("🔥 BODY:", req.body);
  if (!requireAdmin(req, res)) return;

  try {
    let blog = req.body;
    blog.views = blog.views || 0;

    if (!blog.slug) {
      return res.status(400).json({ success: false, error: "Slug is required" });
    }

    blog.content = replaceLocalUrls(blog.content);

    if (blog.coverImage && blog.coverImage.startsWith("http")) {
  // ImageKit or absolute URL → leave as-is
} else if (blog.coverImage) {
  blog.coverImage = replaceLocalUrls(blog.coverImage);
}


    
 // ✅ SUPABASE INSERT (STRICT MODE)
if (!supabase) {
  return res.status(500).json({
    success: false,
    error: "Supabase client not initialized",
  });
}

console.log("🧪 INSERTING INTO SUPABASE:", blog.slug);

const { data, error } = await supabase
  .from("blogs")
  .insert([
    {
      title: blog.title,
      slug: blog.slug,
      category: blog.category || "",
      short_description: blog.description || "",
      html_content: blog.content,
      image_url: blog.coverImage || "",
      status: "published",
    },
  ])
  .select(); // 👈 VERY IMPORTANT

if (error) {
  console.error("❌ SUPABASE INSERT ERROR:", error);
  return res.status(500).json({
    success: false,
    error: "Supabase insert failed",
    details: error.message,
  });
}

console.log("🟢 SUPABASE INSERT SUCCESS:", data);



    // 🟡 FILE BACKUP (UNCHANGED)
    const filePath = path.join(blogsDir, blog.slug + ".json");
    fs.writeFileSync(filePath, JSON.stringify(blog, null, 2), "utf8");

    logAdmin(`Created blog: ${blog.slug}`);
    generateSitemap();
    cache.blogs.data = null;

    return res.json({ success: true });
  } catch (err) {
    console.error("Create blog error:", err);
    return res.status(500).json({ success: false, error: "Create failed" });
  }
});

/* =================================================
   ADMIN: UPDATE BLOG
================================================== */
router.put("/api/admin/update-blog/:slug", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const oldSlug = req.params.slug;
    const oldPath = path.join(blogsDir, oldSlug + ".json");

    if (!fs.existsSync(oldPath)) {
      return res
        .status(404)
        .json({ success: false, error: "Blog not found" });
    }

    const existing = JSON.parse(fs.readFileSync(oldPath, "utf8"));

    const updatedBlog = {
      ...existing,
      ...req.body,
      views: existing.views || 0,
    };

    updatedBlog.content = replaceLocalUrls(updatedBlog.content);
    updatedBlog.coverImage = replaceLocalUrls(updatedBlog.coverImage);

    const newSlug = updatedBlog.slug || oldSlug;

    // ✅ UPDATE SUPABASE
    if (supabase) {
      await supabase
        .from("blogs")
        .update({
          title: updatedBlog.title,
          category: updatedBlog.category,
          short_description: updatedBlog.description || "",
          html_content: updatedBlog.content,
          image_url: updatedBlog.coverImage,
        })
        .eq("slug", oldSlug);
    }

    // 🟡 UPDATE FILE
    const newPath = path.join(blogsDir, newSlug + ".json");
    fs.writeFileSync(newPath, JSON.stringify(updatedBlog, null, 2), "utf8");

    if (newSlug !== oldSlug) fs.unlinkSync(oldPath);

    logAdmin(`Updated blog: ${newSlug}`);
    generateSitemap();
    cache.blogs.data = null;

    return res.json({ success: true });
  } catch (err) {
    console.error("Update blog error:", err);
    return res.status(500).json({ success: false, error: "Update failed" });
  }
});

/* =================================================
   ADMIN: DELETE BLOG
================================================== */
router.delete("/api/admin/delete-blog/:slug", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const slug = req.params.slug;

    if (supabase) {
      await supabase.from("blogs").delete().eq("slug", slug);
    }

    const filePath = path.join(blogsDir, slug + ".json");
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    logAdmin(`Deleted blog: ${slug}`);
    generateSitemap();
    cache.blogs.data = null;

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete blog error:", err);
    return res.status(500).json({ success: false, error: "Delete failed" });
  }
});

/* =================================================
   PUBLIC: GET ALL BLOGS
================================================== */
router.get("/api/blogs", async (req, res) => {
  try {
    // ✅ TRY SUPABASE FIRST
    if (supabase) {
      const { data } = await supabase
        .from("blogs")
        .select(
          "slug,title,short_description,image_url,category,created_at"
        )
        .order("created_at", { ascending: false });

      if (data) {
        return res.json(
          data.map((b) => ({
            slug: b.slug,
            title: b.title,
            description: b.short_description || "",
            coverImage: b.image_url || "",
            category: b.category || "",
            date: b.created_at,
          }))
        );
      }
    }

    // 🟡 FALLBACK: FILE SYSTEM
    const files = fs.readdirSync(blogsDir).filter((f) => f.endsWith(".json"));
    const blogs = [];

    for (const file of files) {
      const raw = fs.readFileSync(path.join(blogsDir, file), "utf8");
      if (!raw) continue;
      const blog = JSON.parse(raw);

      blogs.push({
        slug: blog.slug,
        title: blog.title,
        description: blog.description || "",
        coverImage: blog.coverImage || "",
        category: blog.category || "",
        date: blog.date || "",
      });
    }

    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json(blogs);
  } catch (err) {
    console.error("🔥 /api/blogs error:", err);
    return res.status(500).json({ error: "Failed to load blogs" });
  }
});

/* =================================================
   PUBLIC: GET SINGLE BLOG
================================================== */
router.get("/api/blog/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    // ✅ SUPABASE FIRST
    if (supabase) {
      const { data } = await supabase
        .from("blogs")
        .select("*")
        .eq("slug", slug)
        .single();

      if (data) {
        return res.json({
          ...data,
          content: data.html_content,
          coverImage: data.image_url,
        });
      }
    }

    // 🟡 FALLBACK FILE
    const filePath = path.join(blogsDir, slug + ".json");
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "Not found" });

    const blog = JSON.parse(fs.readFileSync(filePath, "utf8"));
    blog.views = (blog.views || 0) + 1;
    fs.writeFileSync(filePath, JSON.stringify(blog, null, 2), "utf8");

    res.json(blog);
  } catch (err) {
    console.error("Read blog error:", err);
    res.status(500).json({ error: "Read failed" });
  }
});

export default router;

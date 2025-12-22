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

    // 🔥 Optional: old image fileId (edit case)
const oldFileId = req.body.oldFileId || null;

// 🔥 If editing blog & old image exists → delete it
if (oldFileId) {
  try {
    await imagekit.deleteFile(oldFileId);
    console.log("🗑️ Old ImageKit file deleted:", oldFileId);
  } catch (e) {
    console.warn("⚠️ Failed to delete old image:", e.message);
  }
}

// 🔥 Upload new image (same name allowed)
const upload = await imagekit.upload({
  file: file.data.toString("base64"),
  fileName: file.name.replace(/\s+/g, "-"),
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
    console.log("🧪 RENDER SUPABASE CHECK:", {
  url: process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});
  if (!requireAdmin(req, res)) return;

  try {
    let blog = req.body;
    blog.views = blog.views || 0;

    if (!blog.slug) {
      return res.status(400).json({ success: false, error: "Slug is required" });
    }

    blog.content = replaceLocalUrls(blog.content);
 


    
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
  .select(); // 👈 REQUIRED

console.log("🟢 SUPABASE DATA:", data);
console.log("🔴 SUPABASE ERROR:", JSON.stringify(error, null, 2));

if (error) {
  return res.status(500).json({
    success: false,
    error: "Supabase insert failed",
    details: error,
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
    const slug = req.params.slug;        // 🔥 SOURCE OF TRUTH
    const updatedBlog = req.body;

    const { error } = await supabase
  .from("blogs")
  .update({
    title: updatedBlog.title,
    category: updatedBlog.category || "",
    short_description: updatedBlog.description || "",
    html_content: updatedBlog.content,
    image_url: updatedBlog.coverImage || "",
    
  })
  .eq("slug", req.params.slug); // 🔥 SOURCE OF TRUTH

if (error) {
  console.error("Supabase update error:", error);
  return res.status(500).json({ error: "Update failed" });
}

return res.json({ success: true });
  } catch (err) {
    console.error("Update blog error:", err);
    return res.status(500).json({ error: "Update failed" });
  }
});




/* =================================================
   ADMIN: DELETE BLOG
================================================== */
router.delete("/api/admin/delete-blog/:slug", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const slug = req.params.slug;

    // 🔥 1. Fetch image_file_id BEFORE deleting blog
    let imageFileId = null;

    if (supabase) {
      const { data: blog, error } = await supabase
        .from("blogs")
        .select("image_file_id")
        .eq("slug", slug)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("⚠️ Failed to fetch blog image_file_id:", error.message);
      }

      imageFileId = blog?.image_file_id || null;
    }

    // 🔥 2. Delete image from ImageKit (if exists)
    if (imageFileId && imagekit) {
      try {
        await imagekit.deleteFile(imageFileId);
        console.log("🗑️ ImageKit file deleted:", imageFileId);
      } catch (e) {
        console.warn("⚠️ ImageKit delete failed:", e.message);
      }
    }

    // 🔥 3. Delete blog from Supabase
    if (supabase) {
      await supabase.from("blogs").delete().eq("slug", slug);
    }

    // 🟡 4. Delete JSON fallback (if exists)
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
    let blogs = [];

    // 1️⃣ OLD JSON BLOGS (AS IT WAS)
    const files = fs.readdirSync(blogsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const blog = JSON.parse(
        fs.readFileSync(path.join(blogsDir, file), "utf8")
      );

      blogs.push({
        slug: blog.slug,
        title: blog.title,
        description: blog.description || "",
        coverImage: blog.coverImage, // 🔥 DO NOT TOUCH
        category: blog.category || "",
        date: blog.date || null, // TEMP OK
      });
    }

    // 2️⃣ SUPABASE BLOGS (AS IT WAS)
    if (supabase) {
      const { data } = await supabase
        .from("blogs")
        .select("slug,title,short_description,image_url,category,created_at");

      (data || []).forEach((b) => {
        blogs.push({
          slug: b.slug,
          title: b.title,
          description: b.short_description || "",
          coverImage: b.image_url, // 🔥 DO NOT TOUCH
          category: b.category || "",
          date: b.created_at,
        });
      });
    }

    return res.json(blogs);
  } catch (err) {
    console.error("BLOG LIST ERROR:", err);
    res.status(500).json({ error: "Failed to load blogs" });
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
  slug: data.slug,
  title: data.title,
  content: data.html_content,
  description: data.short_description || "",
  coverImage: data.image_url, // 🔥 AS-IS
  category: data.category || "",
  date: data.created_at,
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

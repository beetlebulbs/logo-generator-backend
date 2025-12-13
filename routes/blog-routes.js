// blog-routes.js
console.log("🔥 BLOG ROUTES FILE LOADED");
import fs from "fs";
import path from "path";
import express from "express";
import { replaceLocalUrls } from "../utils/replaceUrls.js";
import { generateSitemap } from "../utils/generateSitemap.js";
import { fileURLToPath } from "url";
import { verifyToken } from "../utils/jwt.js";
import { logAdmin } from "../utils/adminLog.js";

 
// ---- Simple in-memory cache ----
const cache = {
  blogs: {
    data: null,
    expires: 0
  }
};

const BLOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s*/i, "").trim();

  if (!token) {
    res.status(401).json({ message: "Missing admin token" });
    return false;
  }

  try {
    const decoded = verifyToken(token);
    if (decoded) return true;
  } catch (e) {}

  const adminSecret = process.env.ADMIN_SECRET;
  if (token === adminSecret) return true;

  res.status(403).json({ message: "Invalid admin token" });
  return false;
}

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct blogs directory
const blogsDir = path.join(__dirname, "..", "blogs");
if (!fs.existsSync(blogsDir)) fs.mkdirSync(blogsDir, { recursive: true });


// -------------------------------------------------
// ADMIN: CREATE BLOG (Protected)
// -------------------------------------------------
router.post("/api/admin/create-blog", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    let blog = req.body;
    blog.views = blog.views || 0;

    if (!blog.slug) {
      return res.status(400).json({ success: false, error: "Slug is required" });
    }

    blog.content = replaceLocalUrls(blog.content);
    if (blog.coverImage && !blog.coverImage.startsWith("http")) {
  blog.coverImage = replaceLocalUrls(blog.coverImage);
}

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


// -------------------------------------------------
// ADMIN: UPDATE BLOG (Protected)
router.put("/api/admin/update-blog/:slug", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const oldSlug = req.params.slug;
    const oldPath = path.join(blogsDir, oldSlug + ".json");

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: "Blog not found" });
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
    const newPath = path.join(blogsDir, newSlug + ".json");

    fs.writeFileSync(newPath, JSON.stringify(updatedBlog, null, 2), "utf8");

    if (newSlug !== oldSlug) {
      fs.unlinkSync(oldPath);
    }

    logAdmin(`Updated blog: ${newSlug}`);
    generateSitemap();
cache.blogs.data = null;
    return res.json({ success: true });
  } catch (err) {
    console.error("Update blog error:", err);
    return res.status(500).json({ success: false, error: "Update failed" });
  }
});



// -------------------------------------------------
// ADMIN: DELETE BLOG (Protected)
// -------------------------------------------------
router.delete("/api/admin/delete-blog/:slug", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const filePath = path.join(blogsDir, req.params.slug + ".json");

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
logAdmin(`Deleted blog: ${req.params.slug}`);
    generateSitemap();
    cache.blogs.data = null;
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete blog error:", err);
    return res.status(500).json({ success: false, error: "Delete failed" });
  }
});


// -------------------------------------------------
// PUBLIC: GET ALL BLOGS (Lightweight list)
// -------------------------------------------------
router.get("/api/blogs", (req, res) => {
  try {
    // Ensure blogs directory exists
    if (!fs.existsSync(blogsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(blogsDir).filter(f => f.endsWith(".json"));

    const blogs = [];

    for (const file of files) {
      try {
        const fullPath = path.join(blogsDir, file);
        const raw = fs.readFileSync(fullPath, "utf8");

        if (!raw || !raw.trim()) continue;

        const blog = JSON.parse(raw);

        blogs.push({
          slug: blog.slug,
          title: blog.title,
          description: blog.description || "",
          coverImage: blog.coverImage || "",
          category: blog.category || "",
          date: blog.date || ""
        });
      } catch (fileErr) {
        console.error("⚠️ Skipping broken blog file:", file, fileErr.message);
        continue;
      }
    }

    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json(blogs);

  } catch (err) {
    console.error("🔥 /api/blogs fatal error:", err);
    return res.status(500).json({ error: "Failed to load blogs" });
  }
});


// -------------------------------------------------
// PUBLIC: GET SINGLE BLOG (Full content)
// -------------------------------------------------
router.get("/api/blog/:slug", (req, res) => {
  try {
    const filePath = path.join(blogsDir, req.params.slug + ".json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Not found" });
    }

    const blog = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // INCREASE VIEW COUNT
    blog.views = (blog.views || 0) + 1;

    fs.writeFileSync(filePath, JSON.stringify(blog, null, 2), "utf8");

    res.json(blog);
  } catch (err) {
    console.error("Read blog error:", err);
    res.status(500).json({ error: "Read failed" });
  }
});

export default router;

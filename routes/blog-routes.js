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
    return res.json({ success: true });
  } catch (err) {
    console.error("Create blog error:", err);
    return res.status(500).json({ success: false, error: "Create failed" });
  }
});


// -------------------------------------------------
// ADMIN: UPDATE BLOG (Protected)
// -------------------------------------------------
router.put("/api/admin/update-blog/:slug", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const oldPath = path.join(blogsDir, req.params.slug + ".json");

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    const existing = JSON.parse(fs.readFileSync(oldPath, "utf8"));

    const blog = {
      ...existing,      // 👈 keep old data
      ...req.body,      // 👈 overwrite with new data (NEW IMAGE URL)
      views: existing.views || 0
    };

    blog.content = replaceLocalUrls(blog.content);
    blog.coverImage = replaceLocalUrls(blog.coverImage);

    const newPath = path.join(blogsDir, blog.slug + ".json");

    fs.writeFileSync(newPath, JSON.stringify(blog, null, 2), "utf8");

    if (req.params.slug !== blog.slug) {
      fs.unlinkSync(oldPath);
    }

    logAdmin(`Updated blog: ${blog.slug}`);
    generateSitemap();

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
    const files = fs.existsSync(blogsDir) ? fs.readdirSync(blogsDir) : [];

    const blogs = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const fullPath = path.join(blogsDir, f);
        const blog = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        return {
          slug: blog.slug,
          title: blog.title,
          description: blog.description || "",
          coverImage: blog.coverImage,
          category: blog.category || "",
          date: blog.date || "",
        };
      });

    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(blogs);
  } catch (err) {
    console.error("List blogs error:", err);
    res.status(500).json([]);
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

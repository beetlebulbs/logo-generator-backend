// server.js
// Cleaned backend (Option A: blog routes in routes/blog-routes.js only)

// Load environment variables
import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";
import blogRoutes from "./routes/blog-routes.js";
import { generateSitemap } from "./utils/generateSitemap.js";
import { verifyToken } from "./utils/jwt.js"; // optional - used in requireAdmin if available
import { lookupGeo } from "./utils/geo.js";
import { logAdmin } from "./utils/adminLog.js";


// -------- FREE IP LOOKUP --------
async function getLocationFromIP(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();

    return {
      country: data.country_name || "Unknown",
      city: data.city || "Unknown",
      region: data.region || "Unknown"
    };
  } catch (err) {
    console.error("IP lookup failed:", err);
    return {
      country: "Unknown",
      city: "Unknown",
      region: "Unknown"
    };
  }
}


// ---- __dirname for ESM ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, "logs", "admin-activity.json");
// ---- App + config ----
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// ---- Directories ----
const UPLOADS_DIR = path.join(__dirname, "uploads");
const COMMENTS_DIR = path.join(__dirname, "comments");
const BLOGS_DIR = path.join(__dirname, "blogs");

// ensure dirs exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });
if (!fs.existsSync(BLOGS_DIR)) fs.mkdirSync(BLOGS_DIR, { recursive: true });

// ---- Helpers ----
function genId() {
  return Date.now().toString(36) + "-" + Math.round(Math.random() * 1e6).toString(36);
}

function loadCommentsFor(slug) {
  const file = path.join(COMMENTS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) || [];
  } catch (e) {
    console.error("Comments read error:", e);
    return [];
  }
}

function saveCommentsFor(slug, arr) {
  const file = path.join(COMMENTS_DIR, `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
}

// ---- Admin protection helper ----
function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s*/i, "").trim();

  if (!token) {
    res.status(401).json({ message: "Missing admin token" });
    return false;
  }

  // Try JWT verification first if util is available
  try {
    if (typeof verifyToken === "function") {
      const decoded = verifyToken(token);
      if (decoded) return true;
    }
  } catch (e) {
    // ignore and fall back to secret check
  }

  
  // fallback to admin secret
  const adminSecret = process.env.ADMIN_SECRET || "Beetlebulbs@111";
  if (token === adminSecret) return true;

  res.status(403).json({ message: "Invalid or expired admin token" });
  return false;
}
export { requireAdmin };
// middleware wrapper for routes
const adminAuthMiddleware = (req, res, next) => {
  const ok = requireAdmin(req, res);
  if (!ok) return;
  next();
};

// ---- Middleware ----
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://beetlebulbs.com",
    "https://www.beetlebulbs.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20mb" }));
app.use(compression());

// ---- Uploads (multer) ----
app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = (file.originalname || "").split(".").pop();
    cb(null, unique + (ext ? "." + ext : ""));
  }
});
const upload = multer({ storage });

// ---- Mount blog routes (Option A) ----
// blogRoutes handles: GET /api/blog/:slug, GET /api/blogs, and admin create/update/delete in routes file
app.use("/api", blogRoutes);

// ---- Sitemap, health ----
app.get("/sitemap.xml", (req, res) => {
  const file = path.join(__dirname, "sitemap.xml");
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.status(404).send("sitemap not found");
});

app.get("/healthz", (req, res) => res.send("OK"));

// ---- AI / proxy endpoints (HuggingFace / Gemini) ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const HF_IMAGEN_ENDPOINT = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
const GEMINI_TEXT_MODEL_NAME = "gemini-2.5-flash-preview-05-20";

async function sendApiRequest(modelName, payload) {
  if (!GEMINI_API_KEY) throw { status: 500, details: "Missing GEMINI_API_KEY" };
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => ({ message: apiResponse.statusText }));
        throw { status: apiResponse.status, details: errorBody };
      }
      return apiResponse.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}

app.post('/generate-logo', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });
  if (!HF_API_KEY) return res.status(500).json({ error: "HF_API_KEY not configured." });

  try {
    const hfPayload = { inputs: prompt, options: { wait_for_model: true } };
    const apiResponse = await fetch(HF_IMAGEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${HF_API_KEY}` },
      body: JSON.stringify(hfPayload)
    });

    if (!apiResponse.ok) {
      const body = await apiResponse.json().catch(() => ({ message: apiResponse.statusText }));
      console.error("HF error:", apiResponse.status, body);
      return res.status(apiResponse.status).json({ error: "Hugging Face error", details: body });
    }

    const buffer = await apiResponse.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return res.status(500).json({ error: "Empty image buffer" });

    const base64 = Buffer.from(buffer).toString('base64');
    return res.json({ imageUrl: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error("generate-logo error:", err);
    return res.status(500).json({ error: "Server error", details: err.message || err });
  }
});

app.post('/generate-rationale', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });

  const textPrompt = `Based on the brand identity derived from the full prompt: "${prompt}", create a detailed...`; // truncated for brevity
  const geminiPayload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    systemInstruction: { parts: [{ text: "You are a world-class brand strategist..." }] }
  };

  try {
    const result = await sendApiRequest(GEMINI_TEXT_MODEL_NAME, geminiPayload);
    const rationale = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rationale) return res.status(500).json({ error: "Empty response from Gemini" });
    return res.json({ rationale });
  } catch (err) {
    console.error("generate-rationale error:", err);
    return res.status(err.status || 500).json({ error: "Generation failed", details: err.details || err.message || err });
  }
});

// ---- ADMIN LOGIN (keeps admin logic here) ----
// Frontend will POST { email, password } -> returns token (ADMIN_SECRET) on success
app.post("/api/admin/login", express.json(), (req, res) => {
  const { email, password } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || !process.env.ADMIN_SECRET) {
    console.error("Admin env not configured (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECRET)");
    return res.status(500).json({ message: "Server not configured for admin" });
  }

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // return the admin secret token
  return res.json({ token: process.env.ADMIN_SECRET });
});

// ---- IMAGE UPLOAD (ADMIN) ----
app.post("/api/admin/upload-image", upload.single("image"), (req, res) => {
  // allow either requireAdmin or an ADMIN_SECRET in Authorization header
  if (!requireAdmin(req, res)) return;
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl });
  } catch (err) {
    console.error("upload-image error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
});

// ---- ADMIN LOG VIEW ----
app.get("/api/admin/logs", adminAuthMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    res.json(data);
  } catch (err) {
    console.error("Error reading logs:", err);
    res.status(500).json({ error: "Failed to load logs" });
  }
});

// ---- COMMENTS ADMIN aggregate & actions (kept in server.js) ----

// ---- COMMENTS ADMIN aggregate & actions (kept in server.js) ----
// admin: list all comments across slugs
app.get('/api/admin/comments', adminAuthMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(COMMENTS_DIR)) return res.json([]);
    const files = fs.readdirSync(COMMENTS_DIR).filter(f => f.endsWith(".json"));
    const all = [];
    files.forEach(file => {
      const slug = file.replace(/\.json$/, "");
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(COMMENTS_DIR, file), "utf8")) || [];
        if (!Array.isArray(arr)) return;
        arr.forEach(c => {
          all.push({
            id: c.id,
            name: c.name,
            email: c.email,
            content: c.content,
            approved: !!c.approved,
            date: c.createdAt || c.approvedAt || new Date().toISOString(),
            slug,
            replies: Array.isArray(c.replies) ? c.replies.map(r => ({
              id: r.id,
              content: r.content,
              admin: r.admin || "Admin",
              date: r.createdAt || r.date || new Date().toISOString(),
              editedAt: r.editedAt || null
            })) : []
          });
        });
      } catch (e) {
        console.error("Skipping bad comments file", file, e && e.message ? e.message : e);
      }
    });

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json(all);
  } catch (err) {
    console.error("GET /api/admin/comments fatal", err);
    return res.status(500).json({ error: "Server error while listing comments" });
  }
});

// approve comment (admin)
app.put('/api/admin/comments/:slug/:id/approve', adminAuthMiddleware, express.json(), (req, res) => {
  try {
    const { slug, id } = req.params;
    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });
    arr[idx].approved = true;
    arr[idx].approvedAt = new Date().toISOString();
    saveCommentsFor(slug, arr);
    logAdmin(`Approved comment: ${id} on blog ${slug}`);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error("Approve error", err);
    return res.status(500).json({ error: "Approve failed" });
  }
});

// delete comment (admin)
app.delete('/api/admin/comments/:slug/:id', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, id } = req.params;
    let arr = loadCommentsFor(slug);
    const before = arr.length;
    arr = arr.filter(c => c.id !== id);
    if (arr.length === before) return res.status(404).json({ error: "Comment not found" });
    saveCommentsFor(slug, arr);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete comment error", err);
    return res.status(500).json({ error: "Delete failed" });
  }
});

// add reply (admin)
app.put('/api/admin/comments/:slug/:id/reply', adminAuthMiddleware, express.json(), (req, res) => {
  try {
    const { slug, id } = req.params;
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: "content required" });

    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });

    arr[idx].replies = arr[idx].replies || [];
    const reply = { id: genId(), content, createdAt: new Date().toISOString(), admin: "Admin" };
    arr[idx].replies.push(reply);
    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error("Add reply error", err);
    return res.status(500).json({ error: "Reply failed" });
  }
});

// edit reply (admin)
app.put('/api/admin/comments/:slug/:commentId/reply/:replyId', adminAuthMiddleware, express.json(), (req, res) => {
  try {
    const { slug, commentId, replyId } = req.params;
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: "content required" });

    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });

    arr[idx].replies = arr[idx].replies || [];
    const rIdx = arr[idx].replies.findIndex(r => r.id === replyId);
    if (rIdx === -1) return res.status(404).json({ error: "Reply not found" });

    arr[idx].replies[rIdx].content = content;
    arr[idx].replies[rIdx].editedAt = new Date().toISOString();
    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error("Edit reply error", err);
    return res.status(500).json({ error: "Edit reply failed" });
  }
});

// delete reply (admin)
app.delete('/api/admin/comments/:slug/:commentId/reply/:replyId', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, commentId, replyId } = req.params;
    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });

    const before = (arr[idx].replies || []).length;
    arr[idx].replies = (arr[idx].replies || []).filter(r => r.id !== replyId);
    if (arr[idx].replies.length === before) return res.status(404).json({ error: "Reply not found" });

    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error("Delete reply error", err);
    return res.status(500).json({ error: "Delete reply failed" });
  }
});

// ---- PUBLIC: submit comment (moderated) ----
app.post('/api/blog/:slug/comments', express.json(), async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, email, content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: "Content is required" });

    // ensure comments dir exists
    if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });

    const file = path.join(COMMENTS_DIR, `${slug}.json`);
    let arr = [];
    if (fs.existsSync(file)) {
      try {
        arr = JSON.parse(fs.readFileSync(file, "utf8")) || [];
        if (!Array.isArray(arr)) arr = [];
      } catch (e) {
        console.error("Error parsing comments file:", file, e && e.message ? e.message : e);
        arr = [];
      }
    }

    // ---------------------------
    // get IP address (try X-Forwarded-For first)
    // ---------------------------
    const rawForwarded = req.headers["x-forwarded-for"];
    const ipFromHeader = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;
    const ipAddress =
      (ipFromHeader && ipFromHeader.split(",")[0].trim()) ||
      req.ip ||
      req.connection?.remoteAddress ||
      "unknown";

    // lookup geo
    const geo = await lookupGeo(ipAddress);

    const newComment = {
      id: genId(),
      name: name || "Anonymous",
      email: email || "",
      content,
      createdAt: new Date().toISOString(),
      approved: false,
      replies: [],
      ip: ipAddress,
      countryName: geo.country_name,
countryCode: geo.country_code,  // ADD THIS

      city: geo.city || "Unknown",
      region: geo.region || ""
    };

    arr.push(newComment);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");

    return res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error("POST /api/blog/:slug/comments error", err);
    return res.status(500).json({ error: "Server error while saving comment" });
  }
});


// ---- PUBLIC: Get approved comments (paginated) ----
app.get('/api/blog/:slug/comments', (req, res) => {
  try {
    const { slug } = req.params;
    let page = parseInt(req.query.page || "1", 10);
    let pageSize = parseInt(req.query.pageSize || "5", 10);
    if (!page || page < 1) page = 1;
    if (!pageSize || pageSize < 1) pageSize = 5;

    const file = path.join(COMMENTS_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) return res.json({ comments: [], total: 0, page, pageSize });

    let arr = [];
    try {
      arr = JSON.parse(fs.readFileSync(file, "utf8")) || [];
      if (!Array.isArray(arr)) arr = [];
    } catch (e) {
      console.error("Error parsing comments file", file, e);
      return res.status(500).json({ error: "Failed to read comments" });
    }

    let approved = arr.filter(c => !!c.approved);

    approved = approved.map(c => {
      const replies = Array.isArray(c.replies)
        ? [...c.replies].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        : [];
      return { ...c, replies };
    });

    approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = approved.length;
    const start = (page - 1) * pageSize;
    const paged = approved.slice(start, start + pageSize);

    return res.json({ comments: paged, total, page, pageSize });
  } catch (err) {
    console.error("GET /api/blog/:slug/comments error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`🌍 DOMAIN set to: ${process.env.DOMAIN || "http://localhost:" + PORT}`);
  console.log(`📁 Serving uploads from /uploads`);
});

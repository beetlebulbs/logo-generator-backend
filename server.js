// --- Backend Proxy Server (Node.js with Express) ---
// (Reordered and cleaned: keep all original logic; fixed __dirname/app/upload order)

// Load environment variables from .env file using ESM import syntax
import 'dotenv/config'; // Loads and configures dotenv
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Buffer } from 'buffer'; // Import Buffer utility for Node.js image conversion
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import fs from "fs";
import multer from "multer";
import { generateToken, verifyToken } from "./utils/jwt.js";
import { v4 as uuidv4 } from "uuid"; // install with: npm install uuid
import blogRoutes from "./routes/blog-routes.js";
import { generateSitemap } from "./utils/generateSitemap.js"; 
// Required: create __dirname for ESM BEFORE using it
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// helpers
function ensureCommentsDir() {
  const commentsDir = path.join(__dirname, "comments");
  if (!fs.existsSync(commentsDir)) {
    fs.mkdirSync(commentsDir, { recursive: true });
  }
  return commentsDir;
}

function generateId() {
  return Date.now() + "-" + Math.floor(Math.random() * 1e6);
}



// -------------------------
// App + Config
// -------------------------
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// -------------------------
// Admin protection helper
// -------------------------
// -------------------------
// Admin authorization helper
// -------------------------
function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();

  // No token -> reject
  if (!token) {
    res.status(401).json({ message: "Missing admin token" });
    return false;
  }

  // 1) Try JWT verification (if you added utils/ jwt)
  try {
    // If verifyToken exists, use it (wrap in try in case not defined)
    if (typeof verifyToken === "function") {
      const decoded = verifyToken(token);
      if (decoded) return true;
    }
  } catch (err) {
    // ignore and try secret check next
  }


  // 2) Fallback: allow raw ADMIN_SECRET (legacy)
  const adminSecret = process.env.ADMIN_SECRET || "Beetlebulbs@111";
  if (token === adminSecret) return true;

  // If neither works -> reject
  res.status(403).json({ message: "Invalid or expired admin token" });
  return false;
}

// -----------------------------
// COMMENTS: file-based system
// -----------------------------
const COMMENTS_DIR = path.join(__dirname, "comments");
if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });

// helper: load comments array for a slug
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

// helper: save comments array for a slug
function saveCommentsFor(slug, arr) {
  const file = path.join(COMMENTS_DIR, `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
}

// Generate a simple id
function genId() {
  return Date.now().toString(36) + "-" + Math.round(Math.random() * 1e6).toString(36);
}
 
// ---------------- ADMIN AUTH MIDDLEWARE (use requireAdmin) -----------------
const adminAuthMiddleware = (req, res, next) => {
  try {
    // requireAdmin sends 401/403 responses itself and returns false on failure
    const ok = requireAdmin(req, res);
    if (!ok) return; // requireAdmin already responded
    return next();
  } catch (err) {
    console.error('adminAuthMiddleware error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};


// Load secrets and configurations from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- MODEL CONFIGURATION UPDATE: SWITCHING IMAGE TO HUGGING FACE (HF) ---
const HF_API_KEY = process.env.HF_API_KEY || "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";
const HF_IMAGEN_ENDPOINT = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
const GEMINI_TEXT_MODEL_NAME = "gemini-2.5-flash-preview-05-20";

// -------------------------
// Middleware (early)
// -------------------------
// CORS (local + live)
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://beetlebulbs.com",
    "https://www.beetlebulbs.com"
  ]
}));
// JSON parsing
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20mb" }));
app.use(compression());

// -------------------------
// Create uploads folder & Multer setup (uses __dirname, app already defined)
// -------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Make uploads publicly accessible via /uploads
app.use("/uploads", express.static(uploadDir));



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, unique + "." + ext);
  },
});

const upload = multer({ storage: storage });
// -------------------------
// BLOG ROUTES (Correct Position)
// -------------------------
app.use(blogRoutes);



// -------------------------
// SITEMAP SERVE
// -------------------------
app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "sitemap.xml"));
});


// -------------------------
// HEALTH CHECK
// -------------------------
app.get("/healthz", (req, res) => res.send("OK"));


// -------------------------
// Basic API Key check for Gemini (optional but you had it earlier)
// -------------------------
if (!GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY is not set. Check your .env file.");
  // Not exiting forcibly if you want to continue without Gemini — comment out next line if you prefer:
  // process.exit(1);
}

// -------------------------
// Helper: sendApiRequest (for Gemini text generation)
// -------------------------
const sendApiRequest = async (modelName, payload) => {
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
        throw {
          status: apiResponse.status,
          details: errorBody
        };
      }
      return apiResponse.json();
    } catch (error) {
      if (attempt === 2) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// -------------------------
// ENDPOINT 1: IMAGE GENERATION (Hugging Face SDXL)
// -------------------------
app.post('/generate-logo', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  console.log(`[REQUEST START] Proxying Image request for prompt: ${prompt.substring(0, 50)}... (via Hugging Face)`);

  try {
    const hfImagePayload = {
      inputs: prompt,
      options: { wait_for_model: true }
    };

    const apiResponse = await fetch(HF_IMAGEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      body: JSON.stringify(hfImagePayload)
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({ message: `HTTP Error: ${apiResponse.statusText}` }));
      console.error('[API RESPONSE ERROR] HF Image API returned status:', apiResponse.status, 'Body:', JSON.stringify(errorBody));
      return res.status(apiResponse.status).json({
        error: 'External Hugging Face API Error',
        details: errorBody
      });
    }

    const buffer = await apiResponse.arrayBuffer();

    if (buffer.byteLength === 0) {
      return res.status(500).json({ error: 'Received empty image buffer from Hugging Face service.' });
    }

    const base64Data = Buffer.from(buffer).toString('base64');

    if (base64Data) {
      res.json({ imageUrl: `data:image/png;base64,${base64Data}` });
    } else {
      res.status(500).json({ error: 'Failed to convert image buffer to base64.' });
    }
    console.log("[REQUEST SUCCESS] Image generation complete using Hugging Face.");

  } catch (error) {
    console.error('Proxy Error (Image): Full Error Object:', error);
    res.status(500).json({ error: 'An unexpected error occurred on the server side.', debug_info: error.message || error });
  }
});

// -------------------------
// ENDPOINT 2: TEXT RATIONALE (Gemini)
// -------------------------
app.post('/generate-rationale', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  console.log(`[REQUEST START] Proxying Rationale request for prompt: ${prompt.substring(0, 50)}...`);

  const textPrompt = `Based on the brand identity derived from the full prompt: "${prompt}", create a detailed, professional design rationale for a typography-only corporate wordmark logo. 
    
    Structure the response with the following sections using Markdown headings:
    1. **Visual Art & Structure Concept:** Describe the font choice (style, weight, modifications), kerning, and any typographic effects used to create a unique drawing or shape (e.g., connected letters, custom ligatures). Explain how this structure relates to the industry.
    2. **Color Palette & Symbolism:** Justify the main and secondary colors (use mock hex codes like #1A2B3C and #D4E5F6) and what they symbolize in the context of the target audience and keywords.
    3. **Corporate Aesthetic Alignment:** Briefly explain how the final wordmark design (as described above) aligns with the clean, modern, and structural aesthetics of leading tech companies like Microsoft, Google, or TCS.
    
    Ensure the tone is professional, strategic, and detailed. Do not apologize for not providing an image.`;

  const geminiPayload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    systemInstruction: {
      parts: [{ text: "You are a world-class brand strategist and graphic designer providing a comprehensive, structured rationale for a corporate wordmark logo." }]
    }
  };

  console.log("Rationale Payload parts count:", geminiPayload.contents[0].parts.length);

  try {
    const result = await sendApiRequest(GEMINI_TEXT_MODEL_NAME, geminiPayload);
    const rationale = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (rationale) {
      res.json({ rationale: rationale });
    } else {
      res.status(500).json({ error: 'Received empty response from Gemini for rationale.' });
    }
    console.log("[REQUEST SUCCESS] Rationale generation complete.");
  } catch (error) {
    console.error('Proxy Error (Rationale): Full Error Object:', error);
    res.status(error.status || 500).json({
      error: 'An unexpected error occurred while generating rationale.',
      details: error.details || error.message || error
    });
  }
});


// -------------------------
// ADMIN LOGIN
// -------------------------// -------------------------
// -------------------------
// ADMIN LOGIN
// -------------------------
app.post("/api/admin/login", express.json(), (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  //  ADMIN_SECRET = actual JWT / static token for CMS
  const token = process.env.ADMIN_SECRET;

  res.json({ token });
});

// -------------------------
// ADMIN: CREATE BLOG (POST)
// -------------------------
app.post("/api/admin/create-blog", express.json(), (req, res) => {
  // requireAdmin should already verify JWT / token
  if (!requireAdmin(req, res)) return;

  try {
    const blog = req.body;
    if (!blog || !blog.slug || !blog.title) {
      return res.status(400).json({ message: "Missing required fields (slug, title)" });
    }

    // Sanitize slug (lowercase, replace spaces)
    const slug = String(blog.slug).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    blog.slug = slug;

    const blogDir = path.join(__dirname, "blogs");
    if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

    const filePath = path.join(blogDir, slug + ".json");
    // Prevent overwrite if file exists
    if (fs.existsSync(filePath)) {
      return res.status(409).json({ message: "Blog with this slug already exists" });
    }

    // Ensure date field
    if (!blog.date) blog.date = new Date().toISOString().slice(0, 10);

    fs.writeFileSync(filePath, JSON.stringify(blog, null, 2), "utf8");

    return res.json({ message: "Blog created", slug });
  } catch (err) {
    console.error("Create blog error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -------------------------------------------------------------
// GET ALL BLOGS
// -------------------------------------------------------------
// -------------------------------------------------------------
// GET ALL BLOGS  - safe: only read .json files
// -------------------------------------------------------------
app.get("/api/blogs", (req, res) => {
  try {
    const blogDir = path.join(__dirname, "blogs");

    if (!fs.existsSync(blogDir)) {
      return res.json([]); // No blogs yet
    }

    const entries = fs.readdirSync(blogDir, { withFileTypes: true });
    const files = entries
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name);

    const blogs = files.map((file) => {
      const jsonText = fs.readFileSync(path.join(blogDir, file), "utf8");
      const json = JSON.parse(jsonText);
      return {
        title: json.title,
        slug: json.slug,
        description: json.description,
        coverImage: json.coverImage,
        date: json.date,
        category: json.category,
      };
    });

    res.json(blogs);
  } catch (err) {
    console.error("BLOG LIST ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// -------------------------------------------------------------
// GET SINGLE BLOG
// -------------------------------------------------------------
app.get("/api/blog/:slug", (req, res) => {
  try {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, "blogs", slug + ".json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Blog Not Found" });
    }

    const blog = JSON.parse(fs.readFileSync(filePath));
    res.json(blog);
  } catch (err) {
    console.error("BLOG FETCH ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------- ADMIN: UPDATE BLOG (PUT) ----------------
app.put("/api/admin/update-blog/:slug", express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const slug = req.params.slug;
    const blogDir = path.join(__dirname, "blogs");
    const filePath = path.join(blogDir, slug + ".json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const updated = req.body;
    updated.slug = slug;
    if (!updated.date) updated.date = new Date().toISOString().slice(0, 10);

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
    return res.json({ message: "Blog updated", slug });
  } catch (err) {
    console.error("Update blog error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------- ADMIN: DELETE BLOG (DELETE) ----------------
app.delete("/api/admin/delete-blog/:slug", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const slug = req.params.slug;
    const blogDir = path.join(__dirname, "blogs");
    const filePath = path.join(blogDir, slug + ".json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Blog not found" });
    }

    fs.unlinkSync(filePath);
    return res.json({ message: "Blog deleted", slug });
  } catch (err) {
    console.error("Delete blog error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------- IMAGE UPLOAD (ADMIN) ----------------
app.post("/api/admin/upload-image", upload.single("image"), (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Upload failed" });
  }
});
 


// -----------------------------
// COMMENTS: file-based storage
// -----------------------------
const commentsDir = path.join(__dirname, "comments");
if (!fs.existsSync(commentsDir)) fs.mkdirSync(commentsDir, { recursive: true });

// helper to read comments file for a slug (returns array)
function readCommentsFile(slug) {
  const filePath = path.join(commentsDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.error("READ COMMENTS ERROR:", err);
    return [];
  }
}

// helper to write comments array for a slug
function writeCommentsFile(slug, arr) {
  const filePath = path.join(commentsDir, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf8");
}

// -----------------------------
// PUBLIC: submit comment (moderated)
// ---------------- ADMIN COMMENTS (for per-slug JSON files: comments/<slug>.json) -----------------

/**
 * GET /api/admin/comments
 * Aggregates all comments from comments/<slug>.json files into a single list
 */
app.get('/api/admin/comments', adminAuthMiddleware, (req, res) => {
  try {
    if (!fs.existsSync(COMMENTS_DIR)) return res.json([]);
    const files = fs.readdirSync(COMMENTS_DIR).filter(f => f.endsWith('.json'));
    const all = [];
    files.forEach(file => {
      const slug = file.replace(/\.json$/, '');
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(COMMENTS_DIR, file), 'utf8')) || [];
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
              admin: r.admin || 'Admin',
              date: r.createdAt || r.editedAt || new Date().toISOString(),
              editedAt: r.editedAt || null
            })) : []
          });
        });
      } catch (errFile) {
        console.error('Skipping bad slug file', file, errFile && errFile.message ? errFile.message : errFile);
      }
    });

    // newest first
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json(all);
  } catch (err) {
    console.error('GET /api/admin/comments fatal', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error while listing comments' });
  }
});

/**
 * Approve comment
 * PUT /api/admin/comments/:slug/:id/approve
 */
app.put('/api/admin/comments/:slug/:id/approve', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, id } = req.params;
    const arr = loadCommentsFor(slug); // returns array using your helper
    const idx = arr.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
    arr[idx].approved = true;
    arr[idx].approvedAt = new Date().toISOString();
    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error('Approve error', err);
    return res.status(500).json({ error: 'Approve failed' });
  }
});

/**
 * Delete a comment
 * DELETE /api/admin/comments/:slug/:id
 */
app.delete('/api/admin/comments/:slug/:id', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, id } = req.params;
    let arr = loadCommentsFor(slug);
    const before = arr.length;
    arr = arr.filter(c => c.id !== id);
    if (arr.length === before) return res.status(404).json({ error: 'Comment not found' });
    saveCommentsFor(slug, arr);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete comment error', err);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

/**
 * Add reply to comment (admin)
 * PUT /api/admin/comments/:slug/:id/reply
 * Body: { content }
 */
app.put('/api/admin/comments/:slug/:id/reply', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, id } = req.params;
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content required' });

    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });

    arr[idx].replies = arr[idx].replies || [];
    const reply = {
      id: genId(),
      content,
      createdAt: new Date().toISOString(),
      admin: 'Admin'
    };
    arr[idx].replies.push(reply);
    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error('Add reply error', err);
    return res.status(500).json({ error: 'Reply failed' });
  }
});

/**
 * Edit a reply
 * PUT /api/admin/comments/:slug/:commentId/reply/:replyId
 * Body: { content }
 */
app.put('/api/admin/comments/:slug/:commentId/reply/:replyId', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, commentId, replyId } = req.params;
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content required' });

    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });

    arr[idx].replies = arr[idx].replies || [];
    const rIdx = arr[idx].replies.findIndex(r => r.id === replyId);
    if (rIdx === -1) return res.status(404).json({ error: 'Reply not found' });

    arr[idx].replies[rIdx].content = content;
    arr[idx].replies[rIdx].editedAt = new Date().toISOString();
    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error('Edit reply error', err);
    return res.status(500).json({ error: 'Edit reply failed' });
  }
});

/**
 * Delete a reply
 * DELETE /api/admin/comments/:slug/:commentId/reply/:replyId
 */
app.delete('/api/admin/comments/:slug/:commentId/reply/:replyId', adminAuthMiddleware, (req, res) => {
  try {
    const { slug, commentId, replyId } = req.params;
    const arr = loadCommentsFor(slug);
    const idx = arr.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });

    const before = (arr[idx].replies || []).length;
    arr[idx].replies = (arr[idx].replies || []).filter(r => r.id !== replyId);
    if (arr[idx].replies.length === before) return res.status(404).json({ error: 'Reply not found' });

    saveCommentsFor(slug, arr);
    return res.json({ success: true, comment: arr[idx] });
  } catch (err) {
    console.error('Delete reply error', err);
    return res.status(500).json({ error: 'Delete reply failed' });
  }
});

// PUBLIC: create comment for a blog (no auth)
app.post('/api/blog/:slug/comments', (req, res) => {
  try {
    const { slug } = req.params;
    const { name, email, content } = req.body || {};

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // ensure comments dir exists (you already did during startup)
    if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });

    // per-slug file: comments/<slug>.json (an array)
    const file = path.join(COMMENTS_DIR, `${slug}.json`);
    let arr = [];
    if (fs.existsSync(file)) {
      try {
        arr = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
        if (!Array.isArray(arr)) arr = [];
      } catch (e) {
        console.error('Error parsing slug comments file, resetting', file, e);
        arr = [];
      }
    }

    const newComment = {
      id: genId(),                // uses your genId() helper
      name: name || 'Anonymous',
      email: email || '',
      content,
      createdAt: new Date().toISOString(),
      approved: false,
      replies: []
    };

    arr.push(newComment);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');

    // Return success and the created comment
    return res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('POST /api/blog/:slug/comments error', err);
    return res.status(500).json({ error: 'Server error while saving comment' });
  }
});

// PUBLIC: Get approved comments for a blog
// Place BEFORE the SPA/static fallback (and after other API routes)
// PUBLIC — paginated approved comments (supports page & pageSize query params)
// Example: GET /api/blog/my-slug/comments?page=1&pageSize=5
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
      console.error('Error parsing comments file', file, e);
      return res.status(500).json({ error: 'Failed to read comments' });
    }

    // Filter approved only
    let approved = arr.filter(c => !!c.approved);

    // Sort replies (newest first) for each comment
    approved = approved.map(c => {
      const replies = Array.isArray(c.replies)
        ? [...c.replies].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        : [];
      return { ...c, replies };
    });

    // Sort comments newest -> oldest
    approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = approved.length;
    const start = (page - 1) * pageSize;
    const paged = approved.slice(start, start + pageSize);

    return res.json({
      comments: paged,
      total,
      page,
      pageSize
    });
  } catch (err) {
    console.error("GET /api/blog/:slug/comments error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

 // -------------------------------------------
// FRONTEND SPA FALLBACK SETUP
// -------------------------------------------

const frontendPath = path.join(__dirname, "..", "dist");

// Serve static frontend assets
app.use(express.static(frontendPath));

// SPA fallback for all non-API routes
app.use((req, res, next) => {
  if (req.url.startsWith("/api")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

// -------------------------------------------------------------
// START SERVER (NO CHANGE) - put at bottom
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`🌍 DOMAIN set to: ${process.env.DOMAIN || "https://beetlebulbs.com"}`);
  console.log(`📁 Serving uploads from /uploads`);
});


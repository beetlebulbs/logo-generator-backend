import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ImageKit from "imagekit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogsDir = path.join(__dirname, "..", "blogs");
const uploadsDir = path.join(__dirname, "..", "uploads");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function migrateJsonImages() {
  const files = fs.readdirSync(blogsDir);

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(blogsDir, file);
    const blog = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!blog.coverImage || blog.coverImage.startsWith("http")) continue;

    const clean = blog.coverImage.replace(/^\/+/, "").replace(/^uploads\//, "");
    const localPath = path.join(uploadsDir, clean);

    if (!fs.existsSync(localPath)) {
      console.log("⚠️ Missing image:", clean);
      continue;
    }

    const upload = await imagekit.upload({
      file: fs.readFileSync(localPath).toString("base64"),
      fileName: clean,
      folder: "blogs",
    });

    blog.coverImage = upload.url;

    fs.writeFileSync(filePath, JSON.stringify(blog, null, 2), "utf8");

    console.log("✅ Migrated JSON image:", blog.slug);
  }

  console.log("🎉 JSON image migration complete");
}

migrateJsonImages();

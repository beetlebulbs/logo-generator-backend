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

async function migrateImages() {
  const { data: blogs, error } = await supabase
    .from("blogs")
    .select("id, slug, image_url");

  if (error) {
    console.error("❌ Failed to fetch blogs:", error.message);
    return;
  }

  for (const blog of blogs) {
    try {
      const img = blog.image_url;
      if (!img) continue;

      // ✅ Skip ONLY ImageKit images
      if (img.startsWith(process.env.IMAGEKIT_URL_ENDPOINT)) {
        continue;
      }

      // normalize old paths
      const clean = img
        .replace(/^https?:\/\/[^/]+\/uploads\//, "")
        .replace(/^\/+/, "")
        .replace(/^uploads\//, "");

      const localPath = path.join(uploadsDir, clean);

      if (!fs.existsSync(localPath)) {
        console.log("⚠️ Missing local file:", clean);
        continue;
      }

      const upload = await imagekit.upload({
        file: fs.readFileSync(localPath).toString("base64"),
        fileName: path.basename(clean),
        folder: "blogs",
      });

      await supabase
        .from("blogs")
        .update({ image_url: upload.url })
        .eq("id", blog.id);

      console.log("✅ Migrated:", blog.slug);
    } catch (e) {
      console.error("❌ Error migrating:", blog.slug, e.message);
    } 
  }

  console.log("🎉 JSON image migration complete");
}

migrateJsonImages();

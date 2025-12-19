import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ImageKit from "imagekit";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "..", "uploads");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateImages() {
  const { data: blogs } = await supabase
    .from("blogs")
    .select("id, slug, image_url");

  for (const blog of blogs) {
    const img = blog.image_url;
    if (!img || img.startsWith("http")) continue;

    const clean = img.replace(/^\/+/, "").replace(/^uploads\//, "");
    const localPath = path.join(uploadsDir, clean);

    if (!fs.existsSync(localPath)) {
      console.log("⚠️ Missing file:", clean);
      continue;
    }

    const upload = await imagekit.upload({
      file: fs.readFileSync(localPath).toString("base64"),
      fileName: clean,
      folder: "blogs",
    });

    await supabase
      .from("blogs")
      .update({ image_url: upload.url })
      .eq("id", blog.id);

    console.log("✅ Migrated image:", blog.slug);
  }

  console.log("🎉 Image migration complete");
}

migrateImages();

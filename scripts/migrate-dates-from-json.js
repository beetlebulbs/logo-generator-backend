import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const blogsDir = path.join(__dirname, "..", "blogs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateDates() {
  const files = fs.readdirSync(blogsDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(blogsDir, file), "utf8");
    const blog = JSON.parse(raw);

    if (!blog.slug || !blog.date) continue;

    await supabase
      .from("blogs")
      .update({
        original_date: new Date(blog.date).toISOString()
      })
      .eq("slug", blog.slug);

    console.log("✅ Date restored:", blog.slug);
  }

  console.log("🎉 Date migration complete");
}

migrateDates();

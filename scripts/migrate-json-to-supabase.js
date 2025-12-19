import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogsDir = path.join(__dirname, "..", "blogs");
console.log("🔐 SUPABASE_URL:", process.env.SUPABASE_URL);
console.log(
  "🔐 SERVICE KEY PREFIX:",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10)
);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  const files = fs.readdirSync(blogsDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(blogsDir, file), "utf8");
    const blog = JSON.parse(raw);

    const { data: existing } = await supabase
      .from("blogs")
      .select("id")
      .eq("slug", blog.slug)
      .single();

    if (existing) {
      console.log("⏭️ Skipping existing:", blog.slug);
      continue;
    }

    const { error } = await supabase.from("blogs").insert([{
      title: blog.title,
      slug: blog.slug,
      category: blog.category || "",
      short_description: blog.description || "",
      html_content: blog.content || "",
      image_url: blog.coverImage || "",
      status: "published",
    }]);

    if (error) {
      console.error("❌ Failed:", blog.slug, error.message);
    } else {
      console.log("✅ Migrated:", blog.slug);
    }
  }

  console.log("🎉 Migration complete");
}

migrate();

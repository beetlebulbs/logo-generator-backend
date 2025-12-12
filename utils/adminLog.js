import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "..", "logs", "admin-activity.json");

export function logAdmin(action, meta = {}) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, "[]");
    }

    const logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));

    logs.unshift({
      id: Date.now().toString(),
      action,
      meta,
      time: new Date().toISOString(),
    });

    fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(0, 500), null, 2));
  } catch (err) {
    console.error("Admin log error:", err);
  }
}

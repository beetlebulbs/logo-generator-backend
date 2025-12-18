import express from "express";
import ImageKit from "imagekit";
import { verifyToken } from "../utils/jwt.js";

const router = express.Router();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

router.post("/api/admin/upload-image", async (req, res) => {
  try {
    const file = req.files?.image;
    if (!file) return res.status(400).json({ message: "No image uploaded" });

    const result = await imagekit.upload({
      file: file.data.toString("base64"),
      fileName: file.name,
      folder: "/blogs",
    });

    return res.json({ url: result.url });
  } catch (err) {
    console.error("ImageKit upload error:", err);
    res.status(500).json({ message: "Image upload failed" });
  }
});

export default router;

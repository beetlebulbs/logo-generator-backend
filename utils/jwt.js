// utils/jwt.js
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "SuperSecureJWTSecretKey";
export function generateToken(adminId) {
  return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "7d" });
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

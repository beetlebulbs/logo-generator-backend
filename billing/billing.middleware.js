export function requireBilling(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (token !== process.env.BILLING_SECRET) {
    return res.status(403).json({
      error: "Unauthorized billing access"
    });
  }

  next();
}

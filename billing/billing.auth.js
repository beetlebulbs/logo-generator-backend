export function billingAuth(req, res, next) {
  const key = req.headers["x-billing-auth"];

  if (!key || key !== process.env.BILLING_PASSWORD) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

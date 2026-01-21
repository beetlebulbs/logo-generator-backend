import express from "express";

import {
  billingLogin,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  downloadInvoicePDF,
  resendInvoiceEmail,
  markInvoiceStatus
} from "./billing.controller.js";

import { createInvoice } from "../invoices/invoice.controller.js";
import { billingAuth } from "./billing.auth.js";

const router = express.Router();

/* ===============================
   AUTH
=============================== */
router.post("/login", billingLogin);

/* ===============================
   PUBLIC INVOICE (NO AUTH)
=============================== */
router.post("/invoices/create", createInvoice);

/* ===============================
   BILLING CMS (AUTH REQUIRED)
=============================== */
router.get("/invoices", billingAuth, getAllInvoices);
router.get("/invoices/:id", billingAuth, getInvoiceById);
router.put("/invoices/:id", billingAuth, updateInvoice);
router.put("/invoices/:id/status", billingAuth, markInvoiceStatus);
router.delete("/invoices/:id", billingAuth, deleteInvoice);
router.get("/invoices/:id/download", billingAuth, downloadInvoicePDF);
router.post("/invoices/:id/resend", billingAuth, resendInvoiceEmail);
router.get("/invoices/:id/preview", billingAuth, streamInvoicePDF);

export default router;

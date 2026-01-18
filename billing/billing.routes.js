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

/* AUTH */
router.post("/login", billingLogin);

/* INVOICES */
router.post("/invoices", billingAuth, createInvoice);
router.get("/invoices", billingAuth, getAllInvoices);
router.get("/invoices/:id", billingAuth, getInvoiceById);
router.put("/invoices/:id", billingAuth, updateInvoice);
router.put("/invoices/:id/status", billingAuth, markInvoiceStatus);
router.delete("/invoices/:id", billingAuth, deleteInvoice);
router.get("/invoices/:id/download", billingAuth, downloadInvoicePDF);
router.post("/invoices/:id/resend", billingAuth, resendInvoiceEmail);

export default router;

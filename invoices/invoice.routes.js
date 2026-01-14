import express from "express";
import { createInvoice, listInvoices } from "./invoice.controller.js";

const router = express.Router();

router.post("/create", createInvoice);
router.get("/", listInvoices);

export default router;

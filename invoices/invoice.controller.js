import { calculateTotals } from "./invoice.utils.js";
import supabase from "../database/supabase.js";
import { generateInvoicePDF } from "./invoice.pdf.js";
import { sendInvoiceEmail } from "./invoice.mailer.js";

/* =====================================================
   CREATE INVOICE / PROFORMA
===================================================== */
export async function createInvoice(req, res) {
  try {
    console.log("========== INVOICE API HIT ==========");
    console.log("REQ BODY:", JSON.stringify(req.body, null, 2));

    const {
      documentType,
      invoiceType,
      invoiceDate,
      dueDate,
      client,
      items
    } = req.body;

    /* ===============================
       VALIDATION
    =============================== */
    // ----------------- COMMON VALIDATION (INDIA + GLOBAL) -----------------
if (
  !client?.name ||
  !client?.email ||
  !client?.phone ||
  !client?.address ||
  !client?.country ||
  !client?.state ||   // ✅ NOW REQUIRED FOR GLOBAL ALSO
  !client?.zip
) {
  return res.status(400).json({
    error: "Name, Email, Phone, Address, Country, State and ZIP are required"
  });
}

// ----------------- INDIA ONLY VALIDATION -----------------
if (invoiceType === "INDIA") {
  if (!client?.stateCode) {
    return res.status(400).json({
      error: "State Code is required for India invoices"
    });
  }
}
    /* ===============================
       TOTALS
    =============================== */
    const totals = calculateTotals(items, invoiceType);

    /* ===============================
       INVOICE NUMBER (DB SAFE)
    =============================== */
    const { data: invoiceNo, error: noErr } =
      await supabase.rpc("generate_invoice_no");

    if (noErr || !invoiceNo) {
      throw new Error("Invoice number generation failed");
    }

    console.log("GENERATED INVOICE NO:", invoiceNo);

    /* ===============================
       SAVE INVOICE
    =============================== */
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert([{
        invoice_no: invoiceNo,
        document_type: documentType,
        invoice_type: invoiceType,
        invoice_date: invoiceDate,
        due_date: documentType === "PROFORMA" ? dueDate : null,

        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone,
        client_address: client.address,
        client_country: invoiceType === "INDIA" ? "India" : client.country,
        client_state: client.state,
        client_state_code: client.stateCode,
        client_zip: client.zip,
        client_gstin: client.gstin || null,

        currency: invoiceType === "INDIA" ? "INR" : "USD",

        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total
      }])
      .select()
      .single();

    if (invErr) throw invErr;

    console.log("INVOICE SAVED:", invoice.id);

    /* ===============================
       SAVE ITEMS
    =============================== */
    const itemsData = items.map(i => ({
      invoice_id: invoice.id,
      service_name: i.name,
      sac: i.sac,
      description: i.description,
      qty: Number(i.qty),
      rate: Number(i.rate),
      amount: Number(i.amount)
    }));

    const { error: itemErr } =
      await supabase.from("invoice_items").insert(itemsData);

    if (itemErr) throw itemErr;

    /* ===============================
       GENERATE PDF
    =============================== */
   const pdfPath = await generateInvoicePDF({
  invoiceNo,
  documentType,
  invoiceType,
  invoiceDate,
  dueDate,
  client,
  items,
  totals
});

    /* ===============================
       EMAIL WITH ATTACHMENT
    =============================== */
    await sendInvoiceEmail({
      to: client.email,
      clientName: client.name,
      invoiceNo,
      pdfPath,
      total: totals.total,
      documentType,
      invoiceType
    });

    const BASE_URL = process.env.BACKEND_URL || "http://localhost:3001";

    return res.json({
      success: true,
      invoiceNo,
      total: totals.total,
      pdfPath,
      downloadUrl: `${BASE_URL}/${pdfPath}`
    });

  } catch (err) {
    console.error("🔥 INVOICE ERROR FULL 🔥");
    console.error(err);
    return res.status(500).json({
      error: err.message || "Invoice creation failed"
    });
  }
}

/* =====================================================
   LIST INVOICES  ✅ (THIS WAS MISSING)
===================================================== */
export async function listInvoices(req, res) {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_no,
        document_type,
        invoice_type,
        client_name,
        total,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      invoices: data
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}

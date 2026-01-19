import { calculateTotals } from "./invoice.utils.js";
import supabase from "../database/supabase.js";
import { generateInvoicePDF } from "./invoice.pdf.js";
import { sendInvoiceEmail } from "./invoice.mailer.js";
import { uploadInvoicePDF } from "../utils/supabaseStorage.js";

/* =====================================================
   CREATE INVOICE / PROFORMA
===================================================== */
export async function createInvoice(req, res) {
  console.log("🔥🔥🔥 CREATE INVOICE CONTROLLER HIT 🔥🔥🔥");

  try {
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
    if (
      !client?.name ||
      !client?.email ||
      !client?.phone ||
      !client?.address ||
      !client?.country ||
      !client?.state ||
      !client?.zip
    ) {
      return res.status(400).json({
        error: "Name, Email, Phone, Address, Country, State and ZIP are required"
      });
    }

    if (invoiceType === "INDIA" && !client?.stateCode) {
      return res.status(400).json({
        error: "State Code is required for India invoices"
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "At least one invoice item is required"
      });
    }

    console.log("🟢 STEP 1: VALIDATION PASSED");

    /* ===============================
       TOTALS
    =============================== */
    const totals = calculateTotals(items, invoiceType);

    /* ===============================
       INVOICE NUMBER
    =============================== */
    const { data: invoiceNo, error: noErr } =
      await supabase.rpc("generate_invoice_no");

    if (noErr || !invoiceNo) {
      throw new Error("Invoice number generation failed");
    }

    console.log("🟢 STEP 2: INVOICE NUMBER GENERATED:", invoiceNo);

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

    console.log("🟢 STEP 3: INVOICE STORED IN DB:", invoice.id);

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

    console.log("🟢 STEP 4: INVOICE ITEMS SAVED");

    /* ===============================
       GENERATE PDF (BUFFER)
    =============================== */
    const pdfBuffer = await generateInvoicePDF({
      invoiceNo,
      documentType,
      invoiceType,
      invoiceDate,
      dueDate,
      client,
      items,
      totals
    });

    console.log("🟢 STEP 5: PDF GENERATED");

    /* ===============================
       UPLOAD PDF TO SUPABASE STORAGE
    =============================== */
    const fileName = `${invoiceNo.replace(/\//g, "-")}.pdf`;

    const publicPdfUrl = await uploadInvoicePDF({
      pdfBuffer,
      fileName
    });

    console.log("🟢 STEP 6: PDF UPLOADED TO STORAGE");

    /* ===============================
       SAVE PDF URL IN DB
    =============================== */
    await supabase
      .from("invoices")
      .update({ pdf_url: publicPdfUrl })
      .eq("id", invoice.id);

    console.log("🟢 STEP 7: PDF URL SAVED IN DB");

    /* ===============================
       SEND EMAIL (BREVO API)
    =============================== */
    await sendInvoiceEmail({
      to: invoice.client_email,
      subject: `Invoice ${invoice.invoice_no}`,
      html: `
        <p>Hello ${invoice.client_name},</p>
        <p>Please find your invoice attached.</p>
        <p><strong>Invoice No:</strong> ${invoice.invoice_no}</p>
      `,
      pdfUrl: publicPdfUrl
    });

    console.log("🟢 STEP 8: EMAIL SENT");

    /* ===============================
       FINAL RESPONSE
    =============================== */
    return res.json({
      success: true,
      invoiceNo,
      total: totals.total,
      downloadUrl: publicPdfUrl
    });

  } catch (err) {
    console.error("🔥🔥🔥 INVOICE CREATE FAILED 🔥🔥🔥");
    console.error(err);

    return res.status(500).json({
      error: err.message || "Invoice creation failed"
    });
  }
}

/* =====================================================
   LIST INVOICES
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
        pdf_url,
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

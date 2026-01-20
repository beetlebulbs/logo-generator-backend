import supabase from "../database/supabase.js";
import { sendInvoiceEmail } from "../invoices/invoice.mailer.js";
import { generateInvoicePDF } from "../invoices/invoice.pdf.js";
import { uploadInvoicePDF } from "../utils/supabaseStorage.js";

/* =====================================================
   LOGIN
===================================================== */
export function billingLogin(req, res) {
  if (req.body.password !== process.env.BILLING_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }
  res.json({ success: true });
}

/* =====================================================
   LIST + FILTER
===================================================== */
export async function getAllInvoices(req, res) {
  const { client, status, from, to } = req.query;

  let query = supabase
    .from("invoices")
    .select(`
      id,
      invoice_no,
      client_name,
      client_email,
      client_phone,
      invoice_date,
      currency,
      total,
      status,
      pdf_url
    `)
    .order("created_at", { ascending: false });

  if (client) query = query.ilike("client_name", `%${client}%`);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);

  const { data, error } = await query;
  if (error) return res.status(500).json(error);

  res.json(data);
}

/* =====================================================
   SINGLE INVOICE
===================================================== */
export async function getInvoiceById(req, res) {
  const { data, error } = await supabase
    .from("invoices")
    .select(`*, invoice_items(*)`)
    .eq("id", req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  res.json(data);
}

/* =====================================================
   UPDATE + REGENERATE PDF (FIXED)
===================================================== */
export async function updateInvoice(req, res) {
  try {
    const id = req.params.id;
    const { documentType, invoiceType, invoiceDate, dueDate, client, items } =
      req.body;

    /* UPDATE INVOICE */
    await supabase.from("invoices").update({
      document_type: documentType,
      invoice_type: invoiceType,
      invoice_date: invoiceDate,
      due_date: dueDate,
      client_name: client.name,
      client_email: client.email,
      client_phone: client.phone,
      client_address: client.address,
      client_country: client.country,
      client_state: client.state,
      client_state_code: client.stateCode,
      client_zip: client.zip,
      client_gstin: client.gstin
    }).eq("id", id);

    /* RESET ITEMS */
    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    await supabase.from("invoice_items").insert(
      items.map(i => ({
        invoice_id: id,
        service_name: i.name,
        sac: i.sac,
        description: i.description,
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount)
      }))
    );

    /* FETCH UPDATED */
    const { data } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", id)
      .single();

    const subtotal = data.invoice_items.reduce(
      (s, i) => s + Number(i.amount),
      0
    );

    const cgst = invoiceType === "INDIA" ? subtotal * 0.09 : 0;
    const sgst = invoiceType === "INDIA" ? subtotal * 0.09 : 0;
    const total = subtotal + cgst + sgst;

    /* PDF BUFFER */
    const pdfBuffer = await generateInvoicePDF({
      documentType,
      invoiceType,
      invoiceNo: data.invoice_no,
      invoiceDate,
      dueDate,
      client: {
        name: data.client_name,
        email: data.client_email,
        phone: data.client_phone,
        address: data.client_address,
        state: data.client_state,
        country: data.client_country,
        zip: data.client_zip,
        gstin: data.client_gstin
      },
      items: data.invoice_items.map(i => ({
        name: i.service_name,
        sac: i.sac,
        description: i.description,
        qty: i.qty,
        rate: i.rate,
        amount: i.amount
      })),
      totals: { subtotal, cgst, sgst, igst: 0, total }
    });

    /* UPLOAD + URL */
    const fileName = `${data.invoice_no.replace(/\//g, "-")}.pdf`;
    const publicPdfUrl = await uploadInvoicePDF({ pdfBuffer, fileName });

    if (!publicPdfUrl || !publicPdfUrl.startsWith("https://")) {
      throw new Error("Invalid PDF URL generated");
    }

    await supabase.from("invoices").update({
      pdf_url: publicPdfUrl
    }).eq("id", id);

    res.json({ success: true, pdf_url: publicPdfUrl });
  } catch (err) {
    console.error("❌ Update Invoice Error:", err);
    res.status(500).json({ error: err.message });
  }
}

/* =====================================================
   RESEND EMAIL (AUTO FIX)
===================================================== */
export async function resendInvoiceEmail(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", req.params.id)
    .single();

  if (!data) return res.status(404).json({ error: "Invoice not found" });

  let pdfUrl = data.pdf_url;

  /* AUTO-REGENERATE IF MISSING */
  if (!pdfUrl || !pdfUrl.startsWith("https://")) {
    const pdfBuffer = await generateInvoicePDF({
      documentType: data.document_type,
      invoiceType: data.invoice_type,
      invoiceNo: data.invoice_no,
      invoiceDate: data.invoice_date,
      dueDate: data.due_date,
      client: {
        name: data.client_name,
        email: data.client_email,
        phone: data.client_phone,
        address: data.client_address,
        state: data.client_state,
        country: data.client_country,
        zip: data.client_zip,
        gstin: data.client_gstin
      },
      items: data.invoice_items,
      totals: {
        subtotal: data.subtotal,
        cgst: data.cgst,
        sgst: data.sgst,
        igst: data.igst,
        total: data.total
      }
    });

    const fileName = `${data.invoice_no.replace(/\//g, "-")}.pdf`;
    pdfUrl = await uploadInvoicePDF({ pdfBuffer, fileName });

    await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", data.id);
  }

  await sendInvoiceEmail({
    to: data.client_email,
    subject: `Invoice ${data.invoice_no}`,
    html: `<p>Please find your invoice attached.</p>`,
    pdfPath: pdfUrl
  });

  res.json({ success: true });
}

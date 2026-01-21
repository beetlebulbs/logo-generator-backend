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

  return res.json(data);
}

/* =====================================================
   SINGLE INVOICE
===================================================== */
export async function getInvoiceById(req, res) {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items (
        id,
        service_name,
        sac,
        description,
        qty,
        rate,
        amount
      )
    `)
    .eq("id", req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  return res.json(data);
}

/* =====================================================
   UPDATE + REGENERATE PDF
===================================================== */
export async function updateInvoice(req, res) {
  try {
    const id = req.params.id;
    const { documentType, invoiceType, invoiceDate, dueDate, client, items } =
      req.body;

    /* UPDATE INVOICE */
    await supabase
      .from("invoices")
      .update({
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
      })
      .eq("id", id);

    /* RESET ITEMS */
    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    const normalizedItems = items.map(i => ({
      invoice_id: id,
      service_name: i.name,
      sac: i.sac,
      description: i.description,
      qty: Number(i.qty),
      rate: Number(i.rate),
      amount: Number(i.amount)
    }));

    await supabase.from("invoice_items").insert(normalizedItems);

    /* FETCH UPDATED DATA */
    const { data } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", id)
      .single();

    const subtotal = data.invoice_items.reduce(
      (sum, i) => sum + Number(i.amount),
      0
    );

    const cgst = invoiceType === "INDIA" ? subtotal * 0.09 : 0;
    const sgst = invoiceType === "INDIA" ? subtotal * 0.09 : 0;
    const total = subtotal + cgst + sgst;

    /* GENERATE PDF BUFFER */
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

    /* UPLOAD TO SUPABASE */
    const fileName = `${data.invoice_no.replace(/\//g, "-")}.pdf`;

    const publicPdfUrl = await uploadInvoicePDF({
      pdfBuffer,
      fileName
    });

    /* SAVE PDF URL */
    await supabase
      .from("invoices")
      .update({ pdf_url: publicPdfUrl })
      .eq("id", id);

    return res.json({
      success: true,
      pdf_url: publicPdfUrl
    });

  } catch (err) {
    console.error("❌ Update Invoice Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/* =====================================================
   STATUS UPDATE
===================================================== */
export async function markInvoiceStatus(req, res) {
  await supabase
    .from("invoices")
    .update({ status: req.body.status })
    .eq("id", req.params.id);

  return res.json({ success: true });
}

/* =====================================================
   DELETE INVOICE
===================================================== */
export async function deleteInvoice(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("pdf_url")
    .eq("id", req.params.id)
    .single();

  if (data?.pdf_url) {
    const fileName = data.pdf_url.split("/").pop();
    await supabase.storage.from("invoices").remove([fileName]);
  }

  await supabase.from("invoice_items").delete().eq("invoice_id", req.params.id);
  await supabase.from("invoices").delete().eq("id", req.params.id);

  return res.json({ success: true });
}

/* =====================================================
   DOWNLOAD PDF
===================================================== */
export async function downloadInvoicePDF(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("pdf_url")
    .eq("id", req.params.id)
    .single();

  if (!data?.pdf_url) {
    return res.status(404).json({ message: "PDF not found" });
  }

  return res.json({ url: data.pdf_url });
}

/* =====================================================
   RESEND INVOICE EMAIL
===================================================== */
export async function resendInvoiceEmail(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!data) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (!data.pdf_url) {
    return res.status(400).json({ error: "PDF not available" });
  }

   await sendInvoiceEmail({
  to: data.client_email,
  subject: `Invoice ${data.invoice_no}`,
  html: `
    <p>Hello ${data.client_name},</p>
    <p>Please find your invoice attached.</p>
    <p><strong>Invoice No:</strong> ${data.invoice_no}</p>
  `,
  pdfPath: data.pdf_url  
});

  return res.json({ success: true });
}

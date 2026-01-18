import fs from "fs";
import path from "path";
import supabase from "../database/supabase.js";
import { sendInvoiceEmail } from "../invoices/invoice.mailer.js";
import { generateInvoicePDF } from "../invoices/invoice.pdf.js";
  

/* LOGIN */
export function billingLogin(req, res) {
  if (req.body.password !== process.env.BILLING_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }
  res.json({ success: true });
}

/* LIST + FILTER */
export async function getAllInvoices(req, res) {
  const { client, status, from, to } = req.query;

  let query = supabase.from("invoices").select("*").order("created_at", {
    ascending: false
  });

  if (client) query = query.ilike("client_name", `%${client}%`);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);

  const { data, error } = await query;
  if (error) return res.status(500).json(error);

  res.json(data);
}

/* SINGLE */
export async function getInvoiceById(req, res) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json(error);
  res.json(data);
}

/* UPDATE + REGENERATE PDF */
export async function updateInvoice(req, res) {
  try {
    const id = req.params.id;
    const {
      documentType,
      invoiceType,
      invoiceDate,
      dueDate,
      client,
      items
    } = req.body;

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

    await generateInvoicePDF({
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
      totals: {
        subtotal,
        cgst,
        sgst,
        igst: 0,
        total: subtotal + cgst + sgst
      }
    });

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Update Invoice Error:", err);
    res.status(500).json({ error: err.message });
  }
}

/* STATUS */
export async function markInvoiceStatus(req, res) {
  await supabase
    .from("invoices")
    .update({ status: req.body.status })
    .eq("id", req.params.id);

  res.json({ success: true });
}

/* DELETE */
export async function deleteInvoice(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("invoice_no")
    .eq("id", req.params.id)
    .single();

  if (data?.invoice_no) {
    const safe = data.invoice_no.replace(/\//g, "-");
    const file = `uploads/invoices/${safe}.pdf`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  await supabase.from("invoice_items").delete().eq("invoice_id", req.params.id);
  await supabase.from("invoices").delete().eq("id", req.params.id);

  res.json({ success: true });
}

/* PDF */
export async function downloadInvoicePDF(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("invoice_no")
    .eq("id", req.params.id)
    .single();

  const safe = data.invoice_no.replace(/\//g, "-");
  const file = path.resolve(`uploads/invoices/${safe}.pdf`);

  if (!fs.existsSync(file)) {
    return res.status(404).json({ message: "Not found" });
  }

  res.download(file);
}

/* RESEND */
export async function resendInvoiceEmail(req, res) {
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", req.params.id)
    .single();

  const safe = data.invoice_no.replace(/\//g, "-");

  await sendInvoiceEmail({
    to: data.client_email,
    clientName: data.client_name,
    invoiceNo: data.invoice_no,
    pdfPath: `uploads/invoices/${safe}.pdf`,
    total: data.total,
    documentType: data.document_type,
    invoiceType: data.invoice_type
  });

  res.json({ success: true });
}

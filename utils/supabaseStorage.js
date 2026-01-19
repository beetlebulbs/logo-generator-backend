import supabase from "../database/supabase.js";

export async function uploadInvoicePDF({
  pdfBuffer,
  fileName,
  contentType = "application/pdf"
}) {
  if (!pdfBuffer) {
    throw new Error("PDF buffer missing");
  }

  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .upload(fileName, pdfBuffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

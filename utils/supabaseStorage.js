import supabase from "../database/supabase.js";

export async function uploadInvoicePDF({
  pdfBuffer,
  fileName,
  contentType = "application/pdf"
}) {
  /* ===============================
     VALIDATION
  =============================== */
  if (!pdfBuffer) {
    throw new Error("PDF buffer missing");
  }

  if (!fileName) {
    throw new Error("PDF fileName missing");
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!bucket) {
    throw new Error("SUPABASE_STORAGE_BUCKET env missing");
  }

  /* ===============================
     UPLOAD TO SUPABASE
  =============================== */
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, pdfBuffer, {
      contentType,
      upsert: true
    });

  if (uploadError) {
    console.error("❌ SUPABASE PDF UPLOAD FAILED:", uploadError);
    throw uploadError;
  }

  /* ===============================
     GET PUBLIC URL
  =============================== */
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  if (!publicUrlData?.publicUrl) {
    throw new Error("Failed to generate public PDF URL");
  }

  console.log("📄 PDF PUBLIC URL:", publicUrlData.publicUrl);

  return publicUrlData.publicUrl;
}

export function getInvoicePdfFileName(invoiceNo) {
  return invoiceNo.replaceAll("/", "-") + ".pdf";
}
export function calculateTotals(items = [], invoiceType = "INDIA") {
  if (!Array.isArray(items)) items = [];

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.amount || i.qty * i.rate || 0),
    0
  );

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (invoiceType === "INDIA") {
    cgst = subtotal * 0.09;
    sgst = subtotal * 0.09;
  }

  const total = subtotal + cgst + sgst + igst;

  return {
    subtotal,
    cgst,
    sgst,
    igst,
    total
  };
}

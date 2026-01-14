export function generateInvoiceNumber(lastNumber = 0) {
  return `BB/2025-26/${String(lastNumber + 1).padStart(4, "0")}`;
}

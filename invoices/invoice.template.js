export function invoiceHTML(data) {
  const {
    documentType,
    invoiceType,
    invoiceNo,
    invoiceDate,
    company,
    client,
    items,
    totals
  } = data;

  const currency = invoiceType === "INDIA" ? "₹" : "$";
  const watermark = documentType === "PROFORMA" ? "PROFORMA" : "PAID";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body {
    font-family: Arial, sans-serif;
    padding: 40px;
    color: #111;
  }
  .watermark {
    position: fixed;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 120px;
    color: rgba(0,0,0,0.06);
    z-index: -1;
    letter-spacing: 10px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
  }
  .logo {
    font-size: 26px;
    font-weight: bold;
  }
  h2 {
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }
  th, td {
    border-bottom: 1px solid #ddd;
    padding: 10px;
    text-align: left;
  }
  .right {
    text-align: right;
  }
  .total-row td {
    font-weight: bold;
  }
  .footer {
    margin-top: 50px;
  }
</style>
</head>
<body>

<div class="watermark">${watermark}</div>

<div class="header">
  <div class="logo">Beetlebulbs</div>
  <div>
    <h2>${documentType === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice"}</h2>
    <p>Invoice No: ${invoiceNo}</p>
    <p>Date: ${invoiceDate}</p>
  </div>
</div>

<h3>From:</h3>
<p>
<strong>${company.name}</strong><br/>
${company.address}<br/>
GSTIN: ${company.gstin}
</p>

<h3>Bill To:</h3>
<p>
<strong>${client.name}</strong><br/>
${client.address}<br/>
${client.gstin ? `GSTIN: ${client.gstin}` : ""}
</p>

<table>
<thead>
<tr>
  <th>Service</th>
  <th>Qty</th>
  <th class="right">Rate</th>
  <th class="right">Amount</th>
</tr>
</thead>
<tbody>
${items.map(i => `
<tr>
  <td>${i.name}</td>
  <td>${i.qty}</td>
  <td class="right">${currency}${i.rate.toFixed(2)}</td>
  <td class="right">${currency}${i.amount.toFixed(2)}</td>
</tr>
`).join("")}

${invoiceType === "INDIA" ? `
<tr class="total-row">
  <td colspan="3" class="right">Subtotal</td>
  <td class="right">${currency}${totals.subtotal.toFixed(2)}</td>
</tr>
<tr>
  <td colspan="3" class="right">CGST (9%)</td>
  <td class="right">${currency}${totals.cgst.toFixed(2)}</td>
</tr>
<tr>
  <td colspan="3" class="right">SGST (9%)</td>
  <td class="right">${currency}${totals.sgst.toFixed(2)}</td>
</tr>
` : ""}

<tr class="total-row">
  <td colspan="3" class="right">Total</td>
  <td class="right">${currency}${totals.total.toFixed(2)}</td>
</tr>

</tbody>
</table>

<div class="footer">
<p><strong>Authorised Signatory</strong></p>
<p>Beetlebulbs Accounts</p>
</div>

</body>
</html>
`;
}

import { money, type Transaction } from "@retrest/shared";

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// A compact standards-compliant, paginated PDF using built-in Helvetica.
export function makePdf(lines: string[]): Buffer {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += 42)
    chunks.push(lines.slice(i, i + 42));
  if (!chunks.length) chunks.push(["No business receipts for this month."]);
  const objects: string[] = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pages: number[] = [];
  for (const chunk of chunks) {
    const pageId = objects.length;
    const streamId = pageId + 1;
    pages.push(pageId);
    const safe = (s: string) =>
      s.replace(/[^\x20-\x7e]/g, " ").replace(/([\\()])/g, "\\$1");
    const stream = `BT /F1 11 Tf 48 790 Td 17 TL ${chunk.map((line, index) => `${index ? "T* " : ""}(${safe(line)}) Tj`).join("\n")} ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[2] = `<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(content));
    content += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(content);
}

/** CSV cells are quoted, and formula-leading values are neutralised for spreadsheet safety. */
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';

export function businessExportCsv(rows: Transaction[]): string {
  return [
    ["Receipt ID", "Date", "Merchant", "Amount", "Currency", "Status", "Receipt URL"],
    ...rows.map((t) => [t.id, t.created_at, t.merchant_name, (t.amount / 100).toFixed(2), t.currency, t.status, t.receipt_url]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/** Standalone, printable HTML receipt for one approved payment. */
export function receiptHtml(t: Transaction): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RETREST receipt</title><style>body{background:#f2f3ed;font:15px system-ui;color:#192117;padding:60px 20px}main{max-width:460px;margin:auto;background:white;padding:40px;border-radius:20px}h1{font-size:22px}label{color:#7a8177}section{display:flex;justify-content:space-between;margin:22px 0}strong.amount{font-size:38px}a{display:block;padding:15px;background:#d1e6b2;color:#203010;text-align:center;text-decoration:none;border-radius:8px;margin-top:30px}small{color:#7a8177;word-break:break-all}</style></head><body><main><b>RETREST ↗</b><h1>Payment, protected.</h1><p>Your digital receipt is ready.</p><strong class="amount">${money(t.amount, t.currency)}</strong><section><label>Merchant</label><b>${escapeHtml(t.merchant_name)}</b></section><section><label>Status</label><b>✓ Approved</b></section><section><label>Date</label><b>${escapeHtml(new Date(t.created_at).toLocaleDateString("en-GB"))}</b></section>${t.fx_ngn_amount ? `<section><label>Auto-converted</label><b>${money(t.fx_ngn_amount)}</b></section>` : ""}<small>Receipt ${escapeHtml(t.id)}</small><a href="?format=pdf">Download PDF receipt ↓</a><p><small>Generated automatically by RETREST · Demo transaction</small></p></main></body></html>`;
}

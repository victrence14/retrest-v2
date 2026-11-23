import type { Currency, Transaction } from "@retrest/shared";

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function money(value: number, currency: Currency = "NGN") {
  const decimal = minorDecimal(value);
  const [whole, cents] = decimal.replace(/^-/, "").split(".");
  const grouped = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(BigInt(whole));
  return `${decimal.startsWith("-") ? "-" : ""}${currency === "USD" ? "$" : "₦"}${grouped}.${cents}`;
}

// Courier's fixed width keeps every wrapped line inside the printable page.
export function makePdf(lines: string[]): Buffer {
  const wrapped: string[] = [];
  for (const line of lines.flatMap(value => value.split(/\r?\n/))) {
    let text = line.replace(/[^\x20-\x7e]/g, " ");
    while (text.length > 75) {
      const space = text.lastIndexOf(" ", 75);
      const end = space > 0 ? space : 75;
      wrapped.push(text.slice(0, end));
      text = text.slice(end).trimStart();
    }
    wrapped.push(text);
  }
  const chunks: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 42)
    chunks.push(wrapped.slice(i, i + 42));
  if (!chunks.length) chunks.push(["No business receipts for this month."]);
  const objects: string[] = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
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
  const parts = ["%PDF-1.4\n"];
  let length = Buffer.byteLength(parts[0]);
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(length);
    const part = `${i} 0 obj\n${objects[i]}\nendobj\n`;
    parts.push(part);
    length += Buffer.byteLength(part);
  }
  const xref = length;
  parts.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(parts.join(""));
}

/** CSV cells are quoted, and formula-leading values are neutralised for spreadsheet safety. */
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/^[\s]*[=+@-]/, "'$&").replace(/"/g, '""') + '"';

/** Exact decimal presentation, including large aggregate strings. No floating-point division. */
export function minorDecimal(value: number | string | bigint): string {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("Unsafe minor-unit amount.");
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function businessExportCsv(rows: Transaction[]): string {
  return [
    ["Receipt ID", "Date", "Merchant", "Amount", "Currency", "Status", "Receipt URL"],
    ...rows.map((t) => [t.id, t.created_at, t.merchant_name, minorDecimal(t.amount), t.currency, t.status, t.receipt_url]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/** Standalone, printable HTML receipt for one approved payment. */
export function receiptHtml(t: Transaction, options: { demo: boolean } = { demo: true }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RETREST receipt</title><style>body{background:#090b1d;font:15px system-ui;color:#f3f2ff;padding:60px 20px}main{max-width:460px;margin:auto;background:#14162d;padding:40px;border:1px solid #32304d;border-radius:20px}h1{font-size:22px}label,small{color:#b1adc6}section{display:flex;justify-content:space-between;gap:20px;margin:22px 0}strong.amount{font-size:38px}a{display:block;padding:15px;background:#c7b4ff;color:#17112e;text-align:center;text-decoration:none;border-radius:8px;margin-top:30px}small{word-break:break-all}@media print{body,main{background:white;color:#17112e}a{display:none}}</style></head><body><main><b>RETREST ↗</b><h1>Payment, protected.</h1><p>Your digital receipt is ready.</p><strong class="amount">${money(t.amount, t.currency)}</strong><section><label>Merchant</label><b>${escapeHtml(t.merchant_name)}</b></section><section><label>Status</label><b>✓ ${options.demo ? "Approved (demo)" : "Settled"}</b></section><section><label>Date</label><b>${escapeHtml(new Date(t.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" }))}</b></section>${t.fx_ngn_amount ? `<section><label>Auto-converted</label><b>${money(t.fx_ngn_amount)}</b></section>` : ""}<small>Receipt ${escapeHtml(t.id)}</small><a href="?format=pdf">Download PDF receipt ↓</a><p><small>Generated automatically by RETREST${options.demo ? " · Demo transaction" : ""}</small></p></main></body></html>`;
}

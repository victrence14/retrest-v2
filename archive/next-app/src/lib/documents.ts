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

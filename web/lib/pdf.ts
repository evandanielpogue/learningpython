'use client';

/* Text out of a PDF résumé, in the browser. Lines are rebuilt from the
   y-position of each run of text so bullets and headings survive. */
export async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines: { y: number; parts: string[] }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (line) line.parts.push(item.str);
      else lines.push({ y, parts: [item.str] });
    }
    lines.sort((a, b) => b.y - a.y);
    pages.push(lines.map((l) => l.parts.join(' ').replace(/\s+/g, ' ').trim()).join('\n'));
  }
  return pages.join('\n\n');
}

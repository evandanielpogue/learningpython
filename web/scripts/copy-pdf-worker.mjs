/* pdf.js reads PDFs in a worker. Serve the worker from /public so the
   browser can load it without any bundler-specific URL handling. */
import { copyFileSync, existsSync } from 'node:fs';

const from = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
if (existsSync(from)) copyFileSync(from, 'public/pdf.worker.min.mjs');

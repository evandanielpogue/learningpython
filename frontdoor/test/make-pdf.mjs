/* Writes a small text PDF so the importer can be tested without a fixture
   binary in the repo or a trip to the network. */
import { writeFileSync, readFileSync } from 'node:fs';

const src = readFileSync(new URL('../assets/js/store.js', import.meta.url), 'utf8');
const w = {}; new Function('window', src)(w);
const lines = w.Store.EXAMPLE_RESUME.split('\n');

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const body = 'BT\n/F1 11 Tf\n54 738 Td\n15 TL\n' +
  lines.map((l) => (l ? '(' + esc(l) + ') Tj T*' : 'T*')).join('\n') + '\nET';

const objs = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length ' + Buffer.byteLength(body) + '>>\nstream\n' + body + '\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
});
const xref = Buffer.byteLength(pdf);
pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
  offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
pdf += 'trailer\n<</Size ' + (objs.length + 1) + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF\n';

const out = new URL('./fixtures/resume.pdf', import.meta.url);
writeFileSync(out, pdf, 'latin1');
console.log('wrote', out.pathname, Buffer.byteLength(pdf), 'bytes');

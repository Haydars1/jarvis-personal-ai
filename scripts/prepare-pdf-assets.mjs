import { copyFile, mkdir } from 'node:fs/promises';
const output = new URL('../public/vendor/pdfjs/', import.meta.url); await mkdir(output, { recursive: true });
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) await copyFile(new URL('../node_modules/pdfjs-dist/legacy/build/' + file, import.meta.url), new URL(file, output));
await copyFile(new URL('../node_modules/pdfjs-dist/LICENSE', import.meta.url), new URL('LICENSE', output));
console.log('Pinned PDF.js assets prepared.');

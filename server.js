import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets and HTML pages from root directory
app.use(express.static(__dirname));

// Explicit route for OCR scanner
app.get('/ocr_scanner', (req, res) => {
  res.sendFile(path.join(__dirname, 'ocr_scanner.html'));
});

app.get('/ocr_scanner.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'ocr_scanner.html'));
});

// Default route fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DO Insight System running on http://0.0.0.0:${PORT}`);
});

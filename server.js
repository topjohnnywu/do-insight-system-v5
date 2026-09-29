import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Built-in AI Proxy: bypasses browser CORS when running locally
app.post('/api/ai-proxy', async (req, res) => {
  const { targetUrl, headers, body } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: headers || {},
      body: JSON.stringify(body)
    });
    const data = await upstreamRes.json();
    res.status(upstreamRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upstream request failed' });
  }
});

// Proxy for fetching models
app.post('/api/ai-models-proxy', async (req, res) => {
  const { targetUrl, headers } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'Missing targetUrl' });

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: headers || {}
    });
    const data = await upstreamRes.json();
    res.status(upstreamRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch models' });
  }
});

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

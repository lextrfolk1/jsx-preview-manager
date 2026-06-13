const express = require('express');
const cors = require('cors');
const multer = require('multer');
const storageService = require('./storageService');
const archiver = require('archiver');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// GET all pairs
app.get('/api/pairs', async (req, res) => {
  try {
    const pairs = await storageService.getPairs();
    res.json(pairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET pair by ID
app.get('/api/pairs/:pairId', async (req, res) => {
  try {
    const pair = await storageService.getPair(req.params.pairId);
    if (!pair) return res.status(404).json({ error: 'Pair not found' });
    res.json(pair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET pair version
app.get('/api/pairs/:pairId/versions/:version', async (req, res) => {
  try {
    const v = await storageService.getPairVersion(req.params.pairId, req.params.version);
    if (!v) return res.status(404).json({ error: 'Version not found' });
    res.json(v);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET download pair version
app.get('/api/pairs/:pairId/versions/:version/download', async (req, res) => {
  try {
    const v = await storageService.getPairVersion(req.params.pairId, req.params.version);
    if (!v) return res.status(404).json({ error: 'Version not found' });
    
    res.attachment(`${req.params.pairId}-${req.params.version}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', function(err) {
      throw err;
    });
    
    archive.pipe(res);
    archive.append(v.component || '', { name: 'component.jsx' });
    archive.append(JSON.stringify(v.data || {}, null, 2), { name: 'data.json' });
    archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST new pair
app.post('/api/pairs', upload.fields([{ name: 'jsx' }, { name: 'json' }]), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    // create a slug for pairId based on actual name
    const pairId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    let componentStr = 'export default function Component() { return <div>Empty</div>; }';
    let dataObj = {};
    
    if (req.files['jsx']) {
      componentStr = req.files['jsx'][0].buffer.toString('utf-8');
    }
    if (req.files['json']) {
      try {
        dataObj = JSON.parse(req.files['json'][0].buffer.toString('utf-8'));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON file' });
      }
    }

    const pair = await storageService.createPair(pairId, name, description || '', componentStr, dataObj);
    res.json(pair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new version (e.g. from editor or save new version)
app.post('/api/pairs/:pairId/versions', async (req, res) => {
  try {
    const { component, data } = req.body;
    const pair = await storageService.getPair(req.params.pairId);
    if (!pair) return res.status(404).json({ error: 'Pair not found' });
    
    // determine next version number
    let maxV = 0;
    for (const v of pair.versions) {
      const num = parseInt(v.id.replace('v', ''), 10);
      if (!isNaN(num) && num > maxV) maxV = num;
    }
    const nextV = `v${maxV + 1}`;
    
    const newVersion = await storageService.createVersion(req.params.pairId, nextV, component, data);
    res.json(newVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST overwrite current version
app.post('/api/pairs/:pairId/versions/:version/save', async (req, res) => {
  try {
    const { component, data } = req.body;
    const updated = await storageService.saveVersion(req.params.pairId, req.params.version, component, data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save JSON to current version
app.post('/api/pairs/:pairId/versions/:version/save-json', async (req, res) => {
  try {
    const { data } = req.body;
    const updated = await storageService.saveJSON(req.params.pairId, req.params.version, data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save JSX (typically creates a new version)
app.post('/api/pairs/:pairId/versions/:version/save-jsx', async (req, res) => {
  try {
    const { component, data } = req.body; // usually requires saving both
    // Redirect logic to create new version for safety
    const pair = await storageService.getPair(req.params.pairId);
    let maxV = 0;
    for (const v of pair.versions) {
      const num = parseInt(v.id.replace('v', ''), 10);
      if (!isNaN(num) && num > maxV) maxV = num;
    }
    const nextV = `v${maxV + 1}`;
    const newVersion = await storageService.createVersion(req.params.pairId, nextV, component, data);
    res.json(newVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update pair metadata
app.put('/api/pairs/:pairId', async (req, res) => {
  try {
    const updated = await storageService.updatePairMetadata(req.params.pairId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE pair
app.delete('/api/pairs/:pairId', async (req, res) => {
  try {
    await storageService.deletePair(req.params.pairId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE version
app.delete('/api/pairs/:pairId/versions/:version', async (req, res) => {
  try {
    await storageService.deleteVersion(req.params.pairId, req.params.version);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

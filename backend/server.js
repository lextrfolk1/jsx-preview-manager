const express = require('express');
const cors = require('cors');
const multer = require('multer');
const storageService = require('./storageService');
const AdmZip = require('adm-zip');
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
    
    const zip = new AdmZip();
    const folderName = `${req.params.pairId}-${req.params.version}`;
    for (const file of v.files) {
      zip.addFile(`${folderName}/${file.name}`, Buffer.from(file.content || '', 'utf8'));
    }
    
    res.send(zip.toBuffer());
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST new pair
app.post('/api/pairs', upload.fields([{ name: 'files', maxCount: 50 }, { name: 'zip', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    // create a slug for pairId based on actual name
    const pairId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    let files = [];
    
    if (req.files['zip'] && req.files['zip'].length > 0) {
      try {
        const zip = new AdmZip(req.files['zip'][0].buffer);
        const zipEntries = zip.getEntries();
        for (const e of zipEntries) {
          if (!e.isDirectory && !e.entryName.includes('metadata.json')) {
            files.push({ name: path.basename(e.entryName), content: zip.readAsText(e) });
          }
        }
      } catch (err) {
        return res.status(400).json({ error: 'Failed to parse ZIP file: ' + err.message });
      }
    } else if (req.files['files'] && req.files['files'].length > 0) {
      for (const file of req.files['files']) {
        files.push({ name: file.originalname, content: file.buffer.toString('utf-8') });
      }
    } else {
      files = [{ name: 'component.jsx', content: 'export default function Component() { return <div>Empty</div>; }' }];
    }

    const pair = await storageService.createPair(pairId, name, description || '', files);
    res.json(pair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new version (e.g. from editor or save new version)
app.post('/api/pairs/:pairId/versions', async (req, res) => {
  try {
    const { files } = req.body;
    const pair = await storageService.getPair(req.params.pairId);
    if (!pair) return res.status(404).json({ error: 'Pair not found' });
    
    // determine next version number
    let maxV = 0;
    for (const v of pair.versions) {
      const num = parseInt(v.id.replace('v', ''), 10);
      if (!isNaN(num) && num > maxV) maxV = num;
    }
    const nextV = `v${maxV + 1}`;
    
    const newVersion = await storageService.createVersion(req.params.pairId, nextV, files);
    res.json(newVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST overwrite current version
app.post('/api/pairs/:pairId/versions/:version/save', async (req, res) => {
  try {
    const { files } = req.body;
    const updated = await storageService.saveVersion(req.params.pairId, req.params.version, files);
    res.json(updated);
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

// Serve frontend static files in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback all other routes to index.html for React Router (if used) or standard Single Page App behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

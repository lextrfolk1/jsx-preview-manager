const fs = require('fs-extra');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../storage/pairs');

async function ensureStorage() {
  await fs.ensureDir(STORAGE_DIR);
}

async function getPairs() {
  await ensureStorage();
  const dirs = await fs.readdir(STORAGE_DIR);
  const pairs = [];
  for (const dir of dirs) {
    const p = path.join(STORAGE_DIR, dir);
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      const metadataPath = path.join(p, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        pairs.push({ id: dir, ...metadata });
      } else {
        pairs.push({ id: dir, name: dir });
      }
    }
  }
  return pairs;
}

async function getPair(pairId) {
  const p = path.join(STORAGE_DIR, pairId);
  if (!(await fs.pathExists(p))) return null;
  const metadataPath = path.join(p, 'metadata.json');
  const metadata = await fs.readJson(metadataPath);
  
  const versionsDir = path.join(p, 'versions');
  let versions = [];
  if (await fs.pathExists(versionsDir)) {
    const vDirs = await fs.readdir(versionsDir);
    for (const v of vDirs) {
      if ((await fs.stat(path.join(versionsDir, v))).isDirectory()) {
        const vMetadata = await fs.readJson(path.join(versionsDir, v, 'metadata.json')).catch(() => ({}));
        versions.push({ id: v, ...vMetadata });
      }
    }
  }
  
  return { ...metadata, id: pairId, versions };
}

async function getPairVersion(pairId, version) {
  const dir = path.join(STORAGE_DIR, pairId, 'versions', version);
  if (!(await fs.pathExists(dir))) return null;
  
  const componentPath = path.join(dir, 'component.jsx');
  const dataPath = path.join(dir, 'data.json');
  const metadataPath = path.join(dir, 'metadata.json');
  
  const component = await fs.readFile(componentPath, 'utf-8').catch(() => '');
  const data = await fs.readJson(dataPath).catch(() => ({}));
  const metadata = await fs.readJson(metadataPath).catch(() => ({}));
  
  return { component, data, metadata };
}

async function createPair(pairId, name, description, componentStr, dataObj) {
  await ensureStorage();
  const p = path.join(STORAGE_DIR, pairId);
  if (await fs.pathExists(p)) throw new Error('Pair already exists');
  
  await fs.ensureDir(p);
  await fs.writeJson(path.join(p, 'metadata.json'), {
    name,
    description,
    createdAt: new Date().toISOString(),
    activeVersion: 'v1'
  }, { spaces: 2 });
  
  await createVersion(pairId, 'v1', componentStr, dataObj);
  return await getPair(pairId);
}

async function createVersion(pairId, versionId, componentStr, dataObj) {
  const dir = path.join(STORAGE_DIR, pairId, 'versions', versionId);
  await fs.ensureDir(dir);
  
  await fs.writeFile(path.join(dir, 'component.jsx'), componentStr);
  await fs.writeJson(path.join(dir, 'data.json'), dataObj, { spaces: 2 });
  await fs.writeJson(path.join(dir, 'metadata.json'), {
    createdAt: new Date().toISOString(),
    id: versionId
  }, { spaces: 2 });
  
  // update latest version pointer
  const pairMeta = path.join(STORAGE_DIR, pairId, 'metadata.json');
  const meta = await fs.readJson(pairMeta);
  meta.activeVersion = versionId;
  meta.updatedAt = new Date().toISOString();
  await fs.writeJson(pairMeta, meta, { spaces: 2 });
  
  return await getPairVersion(pairId, versionId);
}

async function saveVersion(pairId, versionId, componentStr, dataObj) {
  const dir = path.join(STORAGE_DIR, pairId, 'versions', versionId);
  if (!(await fs.pathExists(dir))) throw new Error('Version not found');
  await fs.writeFile(path.join(dir, 'component.jsx'), componentStr);
  await fs.writeJson(path.join(dir, 'data.json'), dataObj, { spaces: 2 });
  
  const pairMeta = path.join(STORAGE_DIR, pairId, 'metadata.json');
  const meta = await fs.readJson(pairMeta);
  meta.updatedAt = new Date().toISOString();
  await fs.writeJson(pairMeta, meta, { spaces: 2 });
  
  return await getPairVersion(pairId, versionId);
}

async function saveJSON(pairId, version, dataObj) {
  const dir = path.join(STORAGE_DIR, pairId, 'versions', version);
  if (!(await fs.pathExists(dir))) throw new Error('Version not found');
  await fs.writeJson(path.join(dir, 'data.json'), dataObj, { spaces: 2 });
  return await getPairVersion(pairId, version);
}

async function deletePair(pairId) {
  const p = path.join(STORAGE_DIR, pairId);
  await fs.remove(p);
}

async function deleteVersion(pairId, version) {
  const dir = path.join(STORAGE_DIR, pairId, 'versions', version);
  await fs.remove(dir);
}

async function updatePairMetadata(pairId, updates) {
  const pairMeta = path.join(STORAGE_DIR, pairId, 'metadata.json');
  const meta = await fs.readJson(pairMeta);
  const updated = { ...meta, ...updates, updatedAt: new Date().toISOString() };
  await fs.writeJson(pairMeta, updated, { spaces: 2 });
  return await getPair(pairId);
}

module.exports = {
  getPairs,
  getPair,
  getPairVersion,
  createPair,
  createVersion,
  saveVersion,
  saveJSON,
  deletePair,
  deleteVersion,
  updatePairMetadata
};

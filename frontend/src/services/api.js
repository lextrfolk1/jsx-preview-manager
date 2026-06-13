import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/pairs';

export const getPairs = async () => {
  const res = await axios.get(API_BASE);
  return res.data;
};

export const getPair = async (pairId) => {
  const res = await axios.get(`${API_BASE}/${pairId}`);
  return res.data;
};

export const getPairVersion = async (pairId, version) => {
  const res = await axios.get(`${API_BASE}/${pairId}/versions/${version}`);
  return res.data;
};

export const createPair = async (name, description, jsxFile, jsonFile, zipFile) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description || '');
  if (jsxFile) formData.append('jsx', jsxFile);
  if (jsonFile) formData.append('json', jsonFile);
  if (zipFile) formData.append('zip', zipFile);
  
  const res = await axios.post(API_BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const saveVersion = async (pairId, version, component, data) => {
  const res = await axios.post(`${API_BASE}/${pairId}/versions/${version}/save`, { component, data });
  return res.data;
};

export const saveJson = async (pairId, version, data) => {
  const res = await axios.post(`${API_BASE}/${pairId}/versions/${version}/save-json`, { data });
  return res.data;
};

export const saveJsx = async (pairId, version, component, data) => {
  const res = await axios.post(`${API_BASE}/${pairId}/versions/${version}/save-jsx`, { component, data });
  return res.data;
};

export const deletePair = async (pairId) => {
  const res = await axios.delete(`${API_BASE}/${pairId}`);
  return res.data;
};

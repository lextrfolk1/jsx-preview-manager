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

export const createPair = async (name, description, files = [], zipFile = null) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description || '');
  
  if (files && files.length > 0) {
    for (const f of files) {
      formData.append('files', f);
    }
  }
  
  if (zipFile) formData.append('zip', zipFile);
  
  const res = await axios.post(API_BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const saveVersion = async (pairId, version, files) => {
  const res = await axios.post(`${API_BASE}/${pairId}/versions/${version}/save`, { files });
  return res.data;
};

export const createVersion = async (pairId, files) => {
  const res = await axios.post(`${API_BASE}/${pairId}/versions`, { files });
  return res.data;
};

export const deletePair = async (pairId) => {
  const res = await axios.delete(`${API_BASE}/${pairId}`);
  return res.data;
};

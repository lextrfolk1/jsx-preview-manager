import React, { useEffect, useState } from 'react';
import { getPairs, getPair, getPairVersion, createPair, saveVersion, saveJson, saveJsx, deletePair } from './services/api';
import DynamicRenderer from './renderer/DynamicRenderer';
import Editor from '@monaco-editor/react';
import { Play, Code, Database, Save, FilePlus, Trash2, Copy, AlertCircle, FileJson, Layers, Download, Maximize, Minimize, Edit3, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function App() {
  const [pairs, setPairs] = useState([]);
  const [selectedPairId, setSelectedPairId] = useState(null);
  const [pairMeta, setPairMeta] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionData, setVersionData] = useState({ component: '', data: {} });
  
  const [activeTab, setActiveTab] = useState('preview'); // preview, jsx, json
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  
  // Local edit states
  const [localJson, setLocalJson] = useState('');
  const [localJsx, setLocalJsx] = useState('');
  
  // UI for uploading
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', desc: '', jsxFile: null, jsonFile: null });

  useEffect(() => {
    loadPairs();
  }, []);

  useEffect(() => {
    if (selectedPairId) {
      loadPairData(selectedPairId);
    }
  }, [selectedPairId]);

  useEffect(() => {
    if (selectedPairId && selectedVersion) {
      loadVersionData(selectedPairId, selectedVersion);
    }
  }, [selectedPairId, selectedVersion]);

  const loadPairs = async () => {
    const data = await getPairs();
    setPairs(data);
  };

  const loadPairData = async (id) => {
    const data = await getPair(id);
    setPairMeta(data);
    if (!selectedVersion || !data.versions.find(v => v.id === selectedVersion)) {
      setSelectedVersion(data.activeVersion || data.versions[data.versions.length - 1]?.id);
    }
  };

  const loadVersionData = async (pairId, version) => {
    const data = await getPairVersion(pairId, version);
    setVersionData(data);
    setLocalJsx(data.component);
    setLocalJson(JSON.stringify(data.data, null, 2));
    setErrorMsg('');
  };

  const handleCreatePair = async (e) => {
    e.preventDefault();
    try {
      const p = await createPair(uploadForm.name, uploadForm.desc, uploadForm.jsxFile, uploadForm.jsonFile);
      setShowUpload(false);
      setUploadForm({ name: '', desc: '', jsxFile: null, jsonFile: null });
      await loadPairs();
      setSelectedPairId(p.id);
    } catch (err) {
      setErrorMsg('Failed to create pair: ' + err.message);
    }
  };

  const handleDeletePair = async (id) => {
    if (!confirm('Are you sure you want to delete this pair?')) return;
    await deletePair(id);
    if (selectedPairId === id) {
      setSelectedPairId(null);
      setPairMeta(null);
    }
    loadPairs();
  };

  const handleJsonSave = async () => {
    try {
      let parsed = JSON.parse(localJson);
      await saveJson(selectedPairId, selectedVersion, parsed);
      loadVersionData(selectedPairId, selectedVersion);
      setErrorMsg('');
      toast.success('JSON Saved');
    } catch (err) {
      setErrorMsg('Invalid JSON: ' + err.message);
    }
  };

  const handleSaveCurrentVersion = async () => {
    try {
      let parsedJson = JSON.parse(localJson);
      await saveVersion(selectedPairId, selectedVersion, localJsx, parsedJson);
      loadVersionData(selectedPairId, selectedVersion);
      setErrorMsg('');
      toast.success('Version Saved');
    } catch (err) {
      setErrorMsg('Failed to save: ' + err.message);
    }
  };

  const handleJsxSaveNewVersion = async () => {
    try {
      let parsedJson = JSON.parse(localJson);
      const newVersion = await saveJsx(selectedPairId, selectedVersion, localJsx, parsedJson);
      await loadPairData(selectedPairId);
      setSelectedVersion(newVersion.metadata?.id || newVersion.id); // switch to new version
      setErrorMsg('');
      toast.success('Saved as new version');
    } catch (err) {
      setErrorMsg('Failed to save JSX: ' + err.message);
    }
  };

  const handleRendererChange = (path, value) => {
    // Basic lodash.set style update can be complex.
    // For simplicity, if path matches top level property we update it.
    try {
      let parsed = JSON.parse(localJson);
      parsed[path] = value;
      const newStr = JSON.stringify(parsed, null, 2);
      setLocalJson(newStr);
      // Auto save or let user save?
    } catch (e) {
      console.error(e);
    }
  };

  const handleRendererAction = (actionName, payload) => {
    console.log('Action triggered:', actionName, payload);
    toast('Action Triggered: ' + actionName, { icon: '⚡' });
  };

  const handleDownloadZip = () => {
    if (!selectedPairId || !selectedVersion) return;
    const url = `http://localhost:3001/api/pairs/${selectedPairId}/versions/${selectedVersion}/download`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Toaster position="top-right" />
      
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h1 className="font-bold text-gray-800 flex items-center gap-2">
            <Layers size={18} /> Preview Manager
          </h1>
        </div>
        
        <div className="p-2 border-b">
          <button 
            onClick={() => setShowUpload(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm font-medium"
          >
            <FilePlus size={16} /> New Pair
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pairs.map(p => (
            <div 
              key={p.id} 
              className={`p-3 rounded cursor-pointer group flex justify-between items-center ${selectedPairId === p.id ? 'bg-blue-50 border-blue-200 border text-blue-700' : 'hover:bg-gray-50 border border-transparent'}`}
              onClick={() => setSelectedPairId(p.id)}
            >
              <div>
                <div className="font-medium text-sm truncate w-40">{p.name}</div>
                {p.activeVersion && <div className="text-xs text-gray-500 mt-1">Active: {p.activeVersion}</div>}
              </div>
              <button 
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
                onClick={(e) => { e.stopPropagation(); handleDeletePair(p.id); }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPairId && pairMeta ? (
          <>
            {/* TOP BAR */}
            <div className="h-14 bg-white border-b px-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-lg">{pairMeta.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Version:</span>
                  <select 
                    value={selectedVersion || ''} 
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {pairMeta.versions?.map(v => (
                      <option key={v.id} value={v.id}>{v.id} {v.id === pairMeta.activeVersion ? '(Active)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={handleDownloadZip} className="flex items-center gap-1 bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700">
                  <Download size={14} /> Download Zip
                </button>
                <button onClick={handleSaveCurrentVersion} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
                  <Save size={14} /> Save
                </button>
                <button onClick={handleJsxSaveNewVersion} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700">
                  <Copy size={14} /> Save as New Version
                </button>
              </div>
            </div>

            {/* TAB BAR */}
            <div className="flex bg-white border-b items-center justify-between pr-4">
              <div className="flex">
                <button 
                  className={`px-4 py-2 flex items-center gap-2 text-sm border-b-2 ${activeTab === 'preview' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('preview')}
                >
                  <Play size={16} /> Preview UI
                </button>
                <button 
                  className={`px-4 py-2 flex items-center gap-2 text-sm border-b-2 ${activeTab === 'jsx' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('jsx')}
                >
                  <Code size={16} /> JSX Editor
                </button>
                <button 
                  className={`px-4 py-2 flex items-center gap-2 text-sm border-b-2 ${activeTab === 'json' ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setActiveTab('json')}
                >
                  <FileJson size={16} /> JSON Data
                </button>
              </div>

              {(activeTab === 'jsx' || activeTab === 'json') && (
                <button 
                  onClick={() => setIsEditingCode(!isEditingCode)} 
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white transition-colors ${isEditingCode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {isEditingCode ? <><X size={14} /> Lock {activeTab.toUpperCase()}</> : <><Edit3 size={14} /> Edit {activeTab.toUpperCase()}</>}
                </button>
              )}
            </div>

            {/* WORKSPACE & ERROR PANEL */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {errorMsg && (
                <div className="bg-red-50 border-b border-red-200 text-red-700 p-3 flex items-start gap-2 text-sm z-10">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono">{errorMsg}</pre>
                </div>
              )}

              <div className="flex-1 overflow-hidden relative bg-white">
                {activeTab === 'preview' && (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex justify-end p-2 bg-gray-50 border-b">
                       <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                         <Maximize size={16} /> Fullscreen
                       </button>
                    </div>
                    <div className="flex-1 relative">
                      <DynamicRenderer
                        jsxCode={localJsx}
                        jsonData={(() => {
                          try { return JSON.parse(localJson); } catch (e) { return {}; }
                        })()}
                        onChange={handleRendererChange}
                        onAction={handleRendererAction}
                        onError={(msg) => setErrorMsg(msg)}
                      />
                    </div>
                  </div>
                )}
                {activeTab === 'jsx' && (
                  <div className="absolute inset-0">
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      value={localJsx}
                      onChange={(val) => setLocalJsx(val)}
                      options={{ minimap: { enabled: false }, fontSize: 14, readOnly: !isEditingCode }}
                    />
                  </div>
                )}
                {activeTab === 'json' && (
                  <div className="absolute inset-0">
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      value={localJson}
                      onChange={(val) => {
                        setLocalJson(val);
                        try { JSON.parse(val); setErrorMsg(''); } catch (e) { setErrorMsg('Invalid JSON'); }
                      }}
                      options={{ minimap: { enabled: false }, fontSize: 14, readOnly: !isEditingCode }}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
            <Layers size={48} className="text-gray-300" />
            <p>Select a pair from the sidebar or upload a new one.</p>
          </div>
        )}
      </div>

      {/* FULLSCREEN OVERLAY */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
          <div className="h-12 bg-gray-800 text-white flex items-center justify-between px-4">
            <span className="font-medium text-sm">Preview: {pairMeta?.name} ({selectedVersion})</span>
            <button onClick={() => setIsFullscreen(false)} className="flex items-center gap-2 text-sm hover:text-gray-300">
              <Minimize size={16} /> Exit Fullscreen
            </button>
          </div>
          <div className="flex-1 relative">
            <DynamicRenderer
              jsxCode={localJsx}
              jsonData={(() => {
                try { return JSON.parse(localJson); } catch (e) { return {}; }
              })()}
              onChange={handleRendererChange}
              onAction={handleRendererAction}
              onError={(msg) => toast.error(msg)}
            />
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Create New Pair</h2>
            <form onSubmit={handleCreatePair} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pair Name *</label>
                <input required type="text" className="w-full border rounded px-3 py-2 text-sm" value={uploadForm.name} onChange={e => setUploadForm({...uploadForm, name: e.target.value})} placeholder="e.g. user-profile" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" value={uploadForm.desc} onChange={e => setUploadForm({...uploadForm, desc: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JSX File</label>
                <input type="file" accept=".jsx,.js" className="text-sm" onChange={e => setUploadForm({...uploadForm, jsxFile: e.target.files[0]})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JSON File</label>
                <input type="file" accept=".json" className="text-sm" onChange={e => setUploadForm({...uploadForm, jsonFile: e.target.files[0]})} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

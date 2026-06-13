import React, { useEffect, useState, useMemo } from 'react';
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
  const [localJsx, setLocalJsx] = useState('');
  const [localJson, setLocalJson] = useState('{}');

  const parsedJsonData = useMemo(() => {
    try { return JSON.parse(localJson); } catch (e) { return {}; }
  }, [localJson]);
  
  // UI for uploading
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState('files'); // 'files' or 'zip'
  const [uploadForm, setUploadForm] = useState({ name: '', desc: '', jsxFile: null, jsonFile: null, zipFile: null });
  const [pairToDelete, setPairToDelete] = useState(null);

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
      const p = await createPair(uploadForm.name, uploadForm.desc, uploadForm.jsxFile, uploadForm.jsonFile, uploadForm.zipFile);
      setShowUpload(false);
      setUploadForm({ name: '', desc: '', jsxFile: null, jsonFile: null, zipFile: null });
      await loadPairs();
      setSelectedPairId(p.id);
      toast.success('Component created successfully!');
    } catch (err) {
      toast.error('Failed to create component: ' + err.message);
    }
  };

  const confirmDeletePair = async () => {
    if (!pairToDelete) return;
    try {
      await deletePair(pairToDelete);
      if (selectedPairId === pairToDelete) {
        setSelectedPairId(null);
        setPairMeta(null);
      }
      loadPairs();
      setPairToDelete(null);
      toast.success('Component deleted');
    } catch (err) {
      toast.error('Failed to delete component: ' + err.message);
    }
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

  // Debounced auto-save
  useEffect(() => {
    if (!selectedPairId || !selectedVersion) return;
    
    // Only auto-save if we are actively editing
    if (!isEditingCode) return;

    const timer = setTimeout(async () => {
      try {
        let parsedJson = JSON.parse(localJson);
        await saveVersion(selectedPairId, selectedVersion, localJsx, parsedJson);
        // Silently saved, don't show toast to avoid spam
      } catch (err) {
        // Syntax errors while typing shouldn't spam the console too much, we already show UI errors
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [localJsx, localJson, selectedPairId, selectedVersion, isEditingCode]);

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
    const a = document.createElement('a');
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Toaster position="top-right" />
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-slate-100 flex flex-col z-20">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h1 className="font-bold text-slate-800 flex items-center gap-2 text-lg tracking-tight">
            <Layers size={18} /> Preview Manager
          </h1>
        </div>
        
        <div className="p-3 border-b border-slate-100">
          <button 
            onClick={() => setShowUpload(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2.5 px-4 rounded-lg hover:bg-indigo-100 hover:text-indigo-800 text-sm font-semibold transition-all"
          >
            <FilePlus size={16} /> New Component
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {pairs.map(p => (
            <div 
              key={p.id} 
              className={`p-3 rounded-xl cursor-pointer group flex justify-between items-center transition-all duration-200 ${selectedPairId === p.id ? 'bg-indigo-50 border-indigo-100 border text-indigo-800 shadow-sm' : 'hover:bg-slate-50 border border-transparent text-slate-700 hover:text-slate-900'}`}
              onClick={() => setSelectedPairId(p.id)}
            >
              <div>
                <div className="font-medium text-sm truncate w-44">{p.name}</div>
                {p.activeVersion && <div className="text-xs text-slate-500 mt-1">Active: <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-100">{p.activeVersion}</span></div>}
              </div>
              <button 
                className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-md transition-colors"
                onClick={(e) => { e.stopPropagation(); setPairToDelete(p.id); }}
              >
                <Trash2 size={16} />
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
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10 relative">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-xl text-slate-800 tracking-tight">{pairMeta.name}</h2>
                <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-500">Version:</span>
                  <select 
                    value={selectedVersion || ''} 
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-transparent text-sm font-mono font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    {pairMeta.versions?.map(v => (
                      <option key={v.id} value={v.id}>{v.id} {v.id === pairMeta.activeVersion ? '(Active)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={handleDownloadZip} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all shadow-sm">
                  <Download size={16} /> Download
                </button>
                <button onClick={handleSaveCurrentVersion} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md">
                  <Save size={16} /> Save
                </button>
                <button onClick={handleJsxSaveNewVersion} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-all shadow-sm hover:shadow-md">
                  <Copy size={16} /> Save as New Version
                </button>
              </div>
            </div>

            {/* TAB BAR */}
            <div className="flex bg-white border-b border-slate-200 items-center justify-between px-6 z-10 relative">
              <div className="flex gap-6">
                <button 
                  className={`py-3.5 flex items-center gap-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  onClick={() => setActiveTab('preview')}
                >
                  <Play size={16} /> Preview UI
                </button>
                <button 
                  className={`py-3.5 flex items-center gap-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'jsx' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  onClick={() => setActiveTab('jsx')}
                >
                  <Code size={16} /> JSX Editor
                </button>
                <button 
                  className={`py-3.5 flex items-center gap-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'json' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  onClick={() => setActiveTab('json')}
                >
                  <FileJson size={16} /> JSON Data
                </button>
              </div>

              {(activeTab === 'jsx' || activeTab === 'json') && (
                <button 
                  onClick={() => setIsEditingCode(!isEditingCode)} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase text-white shadow-sm transition-all ${isEditingCode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                >
                  {isEditingCode ? <><X size={14} /> Lock {activeTab}</> : <><Edit3 size={14} /> Edit {activeTab}</>}
                </button>
              )}
            </div>

            {/* WORKSPACE & ERROR PANEL */}
            <div className="flex-1 p-6 flex flex-col overflow-hidden relative">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-4 flex items-start gap-3 text-sm shadow-sm">
                  <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono">{errorMsg}</pre>
                </div>
              )}

              <div className="flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative bg-white ring-1 ring-slate-900/5">
                {activeTab === 'preview' && (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="absolute top-4 right-4 z-10">
                       <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur shadow-md rounded-lg text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-all">
                         <Maximize size={16} /> Fullscreen
                       </button>
                    </div>
                    <div className="flex-1 relative">
                      <DynamicRenderer
                        jsxCode={localJsx}
                        jsonData={parsedJsonData}
                        onChange={handleRendererChange}
                        onAction={handleRendererAction}
                        onError={setErrorMsg}
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
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Create New Component</h2>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePair} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Component Name *</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" value={uploadForm.name} onChange={e => setUploadForm({...uploadForm, name: e.target.value})} placeholder="e.g. user-dashboard" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" value={uploadForm.desc} onChange={e => setUploadForm({...uploadForm, desc: e.target.value})} placeholder="Brief description..." />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                  <button type="button" onClick={() => setUploadMode('files')} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${uploadMode === 'files' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>Upload Individual Files</button>
                  <button type="button" onClick={() => setUploadMode('zip')} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${uploadMode === 'zip' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>Upload ZIP Archive</button>
                </div>

                {uploadMode === 'files' ? (
                  <div className="space-y-4">
                    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer relative">
                      <label className="flex flex-col items-center justify-center cursor-pointer">
                        <Code className="text-indigo-400 mb-2" size={24} />
                        <span className="text-sm font-medium text-slate-700">Component File (JSX)</span>
                        <span className="text-xs text-slate-500 mt-1">{uploadForm.jsxFile ? uploadForm.jsxFile.name : 'No file chosen'}</span>
                        <input type="file" accept=".jsx,.js" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setUploadForm({...uploadForm, jsxFile: e.target.files[0]})} />
                      </label>
                    </div>
                    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer relative">
                      <label className="flex flex-col items-center justify-center cursor-pointer">
                        <Database className="text-emerald-400 mb-2" size={24} />
                        <span className="text-sm font-medium text-slate-700">Optional Data (JSON)</span>
                        <span className="text-xs text-slate-500 mt-1">{uploadForm.jsonFile ? uploadForm.jsonFile.name : 'No file chosen'}</span>
                        <input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setUploadForm({...uploadForm, jsonFile: e.target.files[0]})} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer relative flex flex-col items-center justify-center">
                    <FilePlus className="text-indigo-500 mb-3" size={32} />
                    <span className="text-sm font-medium text-slate-700">Upload ZIP Archive</span>
                    <span className="text-xs text-slate-500 mt-1 text-center">Should contain your component and data files.</span>
                    <span className="text-sm font-bold text-indigo-600 mt-3">{uploadForm.zipFile ? uploadForm.zipFile.name : 'Click to Browse'}</span>
                    <input type="file" accept=".zip" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setUploadForm({...uploadForm, zipFile: e.target.files[0]})} />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowUpload(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow transition-all">Create Component</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {pairToDelete && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden transform transition-all">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">Delete Component?</h2>
              <p className="text-sm text-slate-600 mb-6">Are you sure you want to completely delete this component? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setPairToDelete(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="button" onClick={confirmDeletePair} className="px-5 py-2.5 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm hover:shadow transition-all">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

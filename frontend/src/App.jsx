import React, { useEffect, useState, useMemo } from 'react';
import { getPairs, getPair, getPairVersion, createPair, saveVersion, createVersion, deletePair } from './services/api';
import DynamicRenderer from './renderer/DynamicRenderer';
import Editor from '@monaco-editor/react';
import { Play, Code, Database, Save, FilePlus, Trash2, Copy, AlertCircle, FileJson, Layers, Download, Maximize, Minimize, Edit3, X, ChevronRight } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function App() {
  const [pairs, setPairs] = useState([]);
  const [selectedPairId, setSelectedPairId] = useState(null);
  const [pairMeta, setPairMeta] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionData, setVersionData] = useState({ files: [], metadata: {} });
  const [activeTab, setActiveTab] = useState('preview');
  const [openFiles, setOpenFiles] = useState([]);
  const [isFileTreeExpanded, setIsFileTreeExpanded] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  
  // Local edit states
  const [localFiles, setLocalFiles] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState('');

  const componentJsx = localFiles.find(f => f.name.endsWith('.jsx') || f.name.endsWith('.js'))?.content || '';
  const dataJsonFile = localFiles.find(f => f.name.endsWith('.json') && !f.name.includes('metadata.json'));
  
  const parsedJsonData = useMemo(() => {
    if (!dataJsonFile) return null;
    try { return JSON.parse(dataJsonFile.content); } catch (e) { return {}; }
  }, [dataJsonFile?.content]);
  
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
    setLocalFiles(data.files || []);
    if (data.files && data.files.length > 0) {
      if (!data.files.find(f => f.name === selectedFileName)) {
        setSelectedFileName(data.files[0].name);
      }
    } else {
      setSelectedFileName('');
    }
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

  const handleSaveCurrentVersion = async () => {
    try {
      await saveVersion(selectedPairId, selectedVersion, localFiles);
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
        await saveVersion(selectedPairId, selectedVersion, localFiles);
        // Silently saved, don't show toast to avoid spam
      } catch (err) {
        // Syntax errors while typing shouldn't spam the console too much, we already show UI errors
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [localFiles, selectedPairId, selectedVersion, isEditingCode]);

  const handleJsxSaveNewVersion = async () => {
    try {
      const newVersion = await createVersion(selectedPairId, localFiles);
      await loadPairData(selectedPairId);
      setSelectedVersion(newVersion.metadata?.id || newVersion.id); // switch to new version
      setErrorMsg('');
      toast.success('Saved as new version');
    } catch (err) {
      setErrorMsg('Failed to save new version: ' + err.message);
    }
  };

  const commitNewFile = (filename) => {
    if (!filename || !filename.trim()) {
      setIsAddingFile(false);
      setNewFileName('');
      return;
    }
    const finalName = filename.trim();
    if (localFiles.find(f => f.name === finalName)) {
      toast.error('File already exists');
      return;
    }
    const newFiles = [...localFiles, { name: finalName, content: finalName.endsWith('.json') ? '{}' : '' }];
    setLocalFiles(newFiles);
    setSelectedFileName(finalName);
    if (!openFiles.includes(finalName)) setOpenFiles([...openFiles, finalName]);
    setActiveTab(finalName);
    setIsAddingFile(false);
    setNewFileName('');
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
                className={`p-2.5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col ${selectedPairId === p.id ? 'bg-indigo-50 border-indigo-100 border shadow-sm' : 'hover:bg-slate-50 border border-transparent text-slate-700 hover:text-slate-900'}`}
                onClick={() => {
                  if (selectedPairId === p.id) {
                    setIsFileTreeExpanded(!isFileTreeExpanded);
                  } else {
                    setSelectedPairId(p.id);
                    setIsFileTreeExpanded(false);
                    setSelectedVersion(p.activeVersion || p.versions[p.versions.length-1]?.id);
                    setActiveTab('preview');
                    setOpenFiles([]);
                  }
                }}
              >
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <div className={`text-slate-400 transition-transform ${selectedPairId === p.id && isFileTreeExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight size={16} />
                    </div>
                    <div>
                      <div className={`font-medium text-sm truncate w-36 ${selectedPairId === p.id ? 'text-indigo-800' : ''}`}>{p.name}</div>
                      {p.activeVersion && <div className="text-xs text-slate-500 mt-0.5">Active: <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-100">{p.activeVersion}</span></div>}
                    </div>
                  </div>
                  <button 
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-md transition-colors"
                    onClick={(e) => { e.stopPropagation(); setPairToDelete(p.id); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* FILE TREE */}
                {selectedPairId === p.id && isFileTreeExpanded && (
                  <div className="mt-2 space-y-0.5">
                    {localFiles.map(f => (
                      <div 
                        key={f.name}
                        className={`text-[13px] py-1 px-2 ml-6 rounded cursor-pointer flex items-center justify-between group/file transition-colors ${selectedFileName === f.name ? 'bg-slate-200/60 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelectedFileName(f.name); 
                          if (!openFiles.includes(f.name)) setOpenFiles([...openFiles, f.name]);
                          setActiveTab(f.name); 
                        }}
                      >
                        <div className="flex items-center gap-2">
                           <Code size={13} className={selectedFileName === f.name ? 'text-indigo-500' : 'text-slate-400'} />
                           <span className="truncate">{f.name}</span>
                        </div>
                        <button 
                           title="Delete File"
                           className={`opacity-0 group-hover/file:opacity-100 p-1 rounded transition-colors ${selectedFileName === f.name ? 'text-slate-500 hover:text-rose-600' : 'text-slate-400 hover:text-rose-600'}`}
                           onClick={(e) => {
                             e.stopPropagation();
                             setFileToDelete(f.name);
                           }}
                        >
                           <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {isAddingFile && (
                      <div className="flex items-center gap-2 py-1 px-2 ml-6 bg-slate-50 rounded">
                        <Code size={13} className="text-slate-400" />
                        <input 
                          autoFocus
                          type="text"
                          value={newFileName}
                          onChange={e => setNewFileName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitNewFile(newFileName);
                            if (e.key === 'Escape') { setIsAddingFile(false); setNewFileName(''); }
                          }}
                          onBlur={() => commitNewFile(newFileName)}
                          className="flex-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="filename.jsx"
                        />
                      </div>
                    )}
                    {!isAddingFile && (
                      <button 
                        className="text-[13px] mt-1 ml-6 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium py-1 px-2 rounded flex items-center gap-2 w-[calc(100%-1.5rem)] transition-colors"
                        onClick={(e) => { e.stopPropagation(); setIsAddingFile(true); setNewFileName(''); }}
                      >
                        <FilePlus size={13} /> <span className="opacity-80">Add File</span>
                      </button>
                    )}
                  </div>
                )}
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

            {/* GLOBAL TAB BAR */}
            <div className="flex bg-white border-b border-slate-200 px-6 z-10 relative overflow-x-auto no-scrollbar">
              <div className="flex gap-2 items-end">
                <button 
                  className={`px-5 py-3.5 flex items-center gap-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                  onClick={() => setActiveTab('preview')}
                >
                  <Play size={16} className={activeTab === 'preview' ? 'text-indigo-500' : 'text-slate-400'} /> Live Preview
                </button>
                
                <div className="w-px h-6 bg-slate-200 mx-2 mb-3"></div>
                
                {openFiles.map(filename => (
                  <div 
                    key={filename}
                    className={`px-4 py-3.5 flex items-center gap-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer group/tab ${activeTab === filename ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                    onClick={() => { setActiveTab(filename); setSelectedFileName(filename); }}
                  >
                    <Code size={16} className={activeTab === filename ? 'text-indigo-500' : 'text-slate-400'} /> {filename}
                    <button 
                      className={`ml-1 p-0.5 rounded-full hover:bg-slate-200 transition-colors ${activeTab === filename ? 'text-indigo-400 hover:text-indigo-700' : 'text-slate-300 hover:text-slate-600 opacity-0 group-hover/tab:opacity-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newOpen = openFiles.filter(name => name !== filename);
                        setOpenFiles(newOpen);
                        if (activeTab === filename) {
                          setActiveTab('preview');
                        }
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* WORKSPACE & ERROR PANEL */}
            <div className="flex-1 p-6 flex flex-col overflow-hidden relative bg-slate-50/50">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-4 flex items-start gap-3 text-sm shadow-sm">
                  <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono">{errorMsg}</pre>
                </div>
              )}

              <div className="flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative bg-white ring-1 ring-slate-900/5">
                {activeTab !== 'preview' ? (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="h-12 border-b border-slate-100 flex items-center justify-end px-4 bg-slate-50/80">
                      <button 
                        onClick={() => setIsEditingCode(!isEditingCode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isEditingCode ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {isEditingCode ? <Save size={14} /> : <Edit3 size={14} />}
                        {isEditingCode ? 'Editing...' : 'Unlock Editor'}
                      </button>
                    </div>
                    
                    <div className="flex-1 relative">
                      <Editor
                        height="100%"
                        language={activeTab.endsWith('.json') ? 'json' : 'javascript'}
                        value={localFiles.find(f => f.name === activeTab)?.content || ''}
                        theme="vs-light"
                        options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', readOnly: !isEditingCode, scrollBeyondLastLine: false }}
                        onChange={(val) => {
                          if (!isEditingCode) return;
                          const newFiles = [...localFiles];
                          const idx = newFiles.findIndex(f => f.name === activeTab);
                          if (idx > -1) newFiles[idx].content = val || '';
                          setLocalFiles(newFiles);
                        }}
                      />
                      {!isEditingCode && (
                        <div className="absolute inset-0 bg-slate-50/40 cursor-not-allowed z-10 flex items-center justify-center backdrop-blur-[1px]">
                          <div className="bg-white/90 px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium text-slate-500 flex items-center gap-2">
                            <AlertCircle size={16} /> Click "Unlock Editor" to make changes
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col bg-white">
                    <div className="absolute top-4 right-4 z-10">
                       <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur shadow-md rounded-lg text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-all border border-slate-200">
                         <Maximize size={14} /> Fullscreen
                       </button>
                    </div>
                    <div className="flex-1 relative">
                      <DynamicRenderer
                        jsxCode={componentJsx}
                        jsonData={parsedJsonData}
                        onChange={(path, value) => {
                          if (!parsedJsonData || typeof parsedJsonData !== 'object') return;
                          const newData = { ...parsedJsonData };
                          if (newData[path] !== undefined) newData[path] = value;
                          const newFiles = [...localFiles];
                          const idx = newFiles.findIndex(f => f.name.endsWith('.json') && !f.name.includes('metadata.json'));
                          if (idx > -1) {
                            newFiles[idx].content = JSON.stringify(newData, null, 2);
                            setLocalFiles(newFiles);
                          }
                        }}
                        onAction={(actionName, payload) => {
                          toast(`Action Triggered: ${actionName}`, { icon: '⚡' });
                        }}
                        onError={setErrorMsg}
                      />
                    </div>
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
              jsxCode={componentJsx}
              jsonData={parsedJsonData}
              onChange={(path, value) => {
                if (!parsedJsonData || typeof parsedJsonData !== 'object') return;
                const newData = { ...parsedJsonData };
                if (newData[path] !== undefined) newData[path] = value;
                const newFiles = [...localFiles];
                const idx = newFiles.findIndex(f => f.name.endsWith('.json') && !f.name.includes('metadata.json'));
                if (idx > -1) {
                  newFiles[idx].content = JSON.stringify(newData, null, 2);
                  setLocalFiles(newFiles);
                }
              }}
              onAction={(actionName, payload) => {
                toast(`Action Triggered: ${actionName}`, { icon: '⚡' });
              }}
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

      {/* DELETE FILE MODAL */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden transform transition-all">
            <div className="p-6 border-b border-slate-100 flex items-start gap-3">
              <div className="bg-rose-100 p-2 rounded-full text-rose-600 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-1">Delete File?</h2>
                <p className="text-sm text-slate-600">Are you sure you want to delete <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-800">{fileToDelete}</span>? This action cannot be undone.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setFileToDelete(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm">Cancel</button>
              <button 
                type="button" 
                onClick={() => {
                  const newFiles = localFiles.filter(lf => lf.name !== fileToDelete);
                  setLocalFiles(newFiles);
                  if (selectedFileName === fileToDelete) {
                    setSelectedFileName('');
                    setActiveTab('preview');
                  }
                  setOpenFiles(prev => prev.filter(name => name !== fileToDelete));
                  saveVersion(selectedPairId, selectedVersion, newFiles).then(() => {
                    toast.success(`${fileToDelete} deleted`);
                    setFileToDelete(null);
                  });
                }} 
                className="px-5 py-2.5 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm hover:shadow transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

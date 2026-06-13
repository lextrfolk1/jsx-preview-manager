import React, { useEffect, useRef } from 'react';
import * as Babel from '@babel/standalone';

export default function DynamicRenderer({ files = [], jsonData, onChange, onAction, onError }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data || e.data.source !== 'dynamic-preview') return;
      
      if (e.data.type === 'onChange') {
        onChange && onChange(e.data.path, e.data.value);
      } else if (e.data.type === 'onAction') {
        onAction && onAction(e.data.actionName, e.data.payload);
      } else if (e.data.type === 'error') {
        onError && onError(e.data.message);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange, onAction, onError]);

  useEffect(() => {
    if (!files || files.length === 0) return;

    const compiledModules = {};
    let hasErrors = false;

    // Compile all JS/JSX files
    files.filter(f => f.name.endsWith('.jsx') || f.name.endsWith('.js')).forEach(f => {
      try {
        const res = Babel.transform(f.content, { presets: ['env', 'react'] });
        compiledModules[f.name] = res.code;
      } catch (err) {
        if (onError) onError(`Babel Compile Error in ${f.name}: ` + err.message);
        hasErrors = true;
      }
    });

    if (hasErrors) return;

    // Find the entry point
    const entryPointName = files.find(f => f.name === 'App.jsx' || f.name === 'index.jsx')?.name 
      || Object.keys(compiledModules)[0];

    if (!entryPointName) return;

    const moduleDefinitions = Object.entries(compiledModules).map(([name, code]) => {
      const moduleKey = name.replace(/\.jsx?$/, '');
      return `'${moduleKey}': function(exports, require, module) {
        ${code}
      }`;
    }).join(',\n');

    const entryKey = entryPointName.replace(/\.jsx?$/, '');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>body { margin: 0; padding: 1rem; font-family: sans-serif; }</style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            window.onerror = function(msg) {
              window.parent.postMessage({ source: 'dynamic-preview', type: 'error', message: msg }, '*');
            };
            
            try {
              const modules = {
                ${moduleDefinitions}
              };
              const moduleCache = {};
              
              const require = (mod) => {
                if (mod === 'react') return window.React;
                if (mod === 'react-dom') return window.ReactDOM;
                
                let target = mod;
                if (target.startsWith('./')) target = target.slice(2);
                if (target.endsWith('.jsx')) target = target.slice(0, -4);
                if (target.endsWith('.js')) target = target.slice(0, -3);

                if (moduleCache[target]) return moduleCache[target].exports;
                
                if (modules[target]) {
                  const newModule = { exports: {} };
                  moduleCache[target] = newModule;
                  modules[target](newModule.exports, require, newModule);
                  return newModule.exports;
                }
                
                console.warn('Module not found: ' + mod);
                return {};
              };
              
              const data = ${JSON.stringify(jsonData || {})};
              
              const onChange = (path, value) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onChange', path, value }, '*');
              };
              
              const onAction = (actionName, payload) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onAction', actionName, payload }, '*');
              };
              
              const root = ReactDOM.createRoot(document.getElementById('root'));
              
              // Evaluate entry module
              const entryModule = { exports: {} };
              moduleCache['${entryKey}'] = entryModule;
              modules['${entryKey}'](entryModule.exports, require, entryModule);
              
              let ComponentToRender = entryModule.exports.default;
              
              if (!ComponentToRender && typeof entryModule.exports === 'object') {
                const exportKeys = Object.keys(entryModule.exports).filter(k => k !== '__esModule');
                if (exportKeys.length > 0 && typeof entryModule.exports[exportKeys[0]] === 'function') {
                  ComponentToRender = entryModule.exports[exportKeys[0]];
                } else {
                  ComponentToRender = entryModule.exports;
                }
              } else if (!ComponentToRender) {
                ComponentToRender = entryModule.exports;
              }
              
              if (ComponentToRender && (typeof ComponentToRender === 'function' || (typeof ComponentToRender === 'object' && ComponentToRender.$$typeof))) {
                 root.render(React.createElement(ComponentToRender, { data, onChange, onAction }));
              } else {
                 throw new Error("Could not find a valid React component in ${entryPointName}. Ensure your code has 'export default YourComponent;'.");
              }
            } catch (err) {
              window.parent.postMessage({ source: 'dynamic-preview', type: 'error', message: err.message }, '*');
            }
          </script>
        </body>
      </html>
    `;
    
    if (iframeRef.current) {
       iframeRef.current.srcdoc = html;
    }
  }, [files, jsonData, onError]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

import React, { useEffect, useRef } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOM from 'react-dom';
import * as Babel from '@babel/standalone';
import * as LucideReact from 'lucide-react';

// Expose to iframe sandbox
window.React = React;
window.ReactDOM = ReactDOM;
window.ReactDOMClient = ReactDOMClient;
window.LucideReact = LucideReact;

let reactBlobUrl = '';
let reactDomBlobUrl = '';
let reactDomClientBlobUrl = '';

if (typeof URL !== 'undefined') {
  const reactExports = Object.keys(React).map(k => `export const ${k} = window.parent.React.${k};`).join('\n');
  reactBlobUrl = URL.createObjectURL(new Blob([`export default window.parent.React;\n${reactExports}`], { type: 'text/javascript' }));
  
  const reactDomExports = Object.keys(ReactDOM).map(k => `export const ${k} = window.parent.ReactDOM.${k};`).join('\n');
  reactDomBlobUrl = URL.createObjectURL(new Blob([`export default window.parent.ReactDOM;\n${reactDomExports}`], { type: 'text/javascript' }));

  const reactDomClientExports = Object.keys(ReactDOMClient).map(k => `export const ${k} = window.parent.ReactDOMClient.${k};`).join('\n');
  reactDomClientBlobUrl = URL.createObjectURL(new Blob([`export default window.parent.ReactDOMClient;\n${reactDomClientExports}`], { type: 'text/javascript' }));
}

export default function DynamicRenderer({ files = [], jsonData, dependencies = [], onChange, onAction, onError, onMissingDependency }) {
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
      } else if (e.data.type === 'missing_dependency') {
        onMissingDependency && onMissingDependency(e.data.module);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange, onAction, onError, onMissingDependency]);

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
          <script type="importmap">
            {
              "imports": {
                "react": "${reactBlobUrl}",
                "react-dom": "${reactDomBlobUrl}",
                "react-dom/client": "${reactDomClientBlobUrl}"
              }
            }
          </script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>body { margin: 0; padding: 1rem; font-family: sans-serif; }</style>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            window.DynamicModules = window.DynamicModules || {};
            const deps = ${JSON.stringify(dependencies || [])};
            
            if (deps.length === 0) {
               window.dispatchEvent(new Event('dependencies-ready'));
            } else {
               Promise.all(
                 deps.map(dep => import('https://esm.sh/' + dep + '?external=react,react-dom')
                   .then(m => window.DynamicModules[dep] = m)
                 )
               ).then(() => {
                 window.dispatchEvent(new Event('dependencies-ready'));
               }).catch(err => {
                 window.parent.postMessage({ source: 'dynamic-preview', type: 'error', message: 'Failed to load dependencies: ' + err.message }, '*');
               });
            }
          </script>
          <script>
            window.onerror = function(msg) {
              window.parent.postMessage({ source: 'dynamic-preview', type: 'error', message: msg }, '*');
            };
            
            window.addEventListener('dependencies-ready', () => {
              try {
                // Babel's classic JSX runtime needs a global 'React'
                window.React = window.parent.React;
                window.ReactDOM = window.parent.ReactDOM;
                window.ReactDOMClient = window.parent.ReactDOMClient;
              
              const modules = {
                ${moduleDefinitions}
              };
              const moduleCache = {};
              
              const require = (mod) => {
                if (mod === 'react') return window.parent.React;
                if (mod === 'react-dom') return window.parent.ReactDOM;
                if (mod === 'lucide-react') return window.parent.LucideReact;
                if (window.DynamicModules && window.DynamicModules[mod]) return window.DynamicModules[mod];
                
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
                
                window.parent.postMessage({ source: 'dynamic-preview', type: 'missing_dependency', module: mod }, '*');
                throw new Error('Missing dependency: ' + mod);
              };
              
              const data = ${JSON.stringify(jsonData || {})};
              
              const onChange = (path, value) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onChange', path, value }, '*');
              };
              
              const onAction = (actionName, payload) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onAction', actionName, payload }, '*');
              };
              
              const root = window.parent.ReactDOMClient.createRoot(document.getElementById('root'));
              
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
                 root.render(window.parent.React.createElement(ComponentToRender, { data, onChange, onAction }));
              } else {
                 throw new Error("Could not find a valid React component in ${entryPointName}. Ensure your code has 'export default YourComponent;'.");
              }
            } catch (err) {
              window.parent.postMessage({ source: 'dynamic-preview', type: 'error', message: err.message }, '*');
            }
          });
          </script>
        </body>
      </html>
    `;
    
    if (iframeRef.current) {
       iframeRef.current.srcdoc = html;
    }
  }, [files, jsonData, dependencies, onError]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

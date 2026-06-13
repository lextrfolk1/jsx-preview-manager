import React, { useEffect, useRef } from 'react';
import * as Babel from '@babel/standalone';

export default function DynamicRenderer({ jsxCode, jsonData, onChange, onAction, onError }) {
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
    let compiledCode = '';
    try {
      const res = Babel.transform(jsxCode, { presets: ['env', 'react'] });
      compiledCode = res.code;
    } catch (err) {
      if (onError) onError('Babel Compile Error: ' + err.message);
      return;
    }

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
              // Polyfill CommonJS environment
              const exports = {};
              const module = { exports };
              const require = (mod) => {
                if (mod === 'react') return window.React;
                if (mod === 'react-dom') return window.ReactDOM;
                return {};
              };
              
              // Execute compiled code
              ${compiledCode}
              
              const data = ${JSON.stringify(jsonData || {})};
              
              const onChange = (path, value) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onChange', path, value }, '*');
              };
              
              const onAction = (actionName, payload) => {
                window.parent.postMessage({ source: 'dynamic-preview', type: 'onAction', actionName, payload }, '*');
              };
              
              const root = ReactDOM.createRoot(document.getElementById('root'));
              
              let ComponentToRender = exports.default || module.exports.default || module.exports;
              
              if (ComponentToRender && typeof ComponentToRender === 'function' || typeof ComponentToRender === 'object') {
                 root.render(React.createElement(ComponentToRender, { data, onChange, onAction }));
              } else {
                 throw new Error("Could not find a default export component.");
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
  }, [jsxCode, jsonData, onError]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

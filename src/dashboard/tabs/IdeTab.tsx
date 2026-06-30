import React, { useState, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Play, Loader2, FilePlus, FolderOpen, Save, Share2, Wand2, StopCircle, Settings, X } from 'lucide-react';
import './ide.css';

// Configure Monaco to use local webpack bundle (no CDN)
loader.config({ monaco });

const COMPILERS: Record<string, string[]> = {
  'c++': ['gcc-13.2.0', 'gcc-12.3.0', 'gcc-11.4.0', 'clang-head'],
  'python': ['cpython-3.14.0', 'cpython-3.13.8', 'cpython-3.12.7', 'cpython-3.11.10', 'cpython-3.10.15'],
  'java': ['openjdk-jdk-22+36', 'openjdk-jdk-21+35'],
  'javascript': ['nodejs-20.17.0', 'nodejs-18.20.4'],
  'rust': ['rust-1.82.0', 'rust-1.81.0', 'rust-1.80.1'],
  'go': ['go-1.23.2', 'go-1.22.8', 'go-1.16.3']
};

export const IdeTab: React.FC = () => {
  const [language, setLanguage] = useState<string>('c++');
  const [compilerVersion, setCompilerVersion] = useState<string>(COMPILERS['c++'][0]);
  const [code, setCode] = useState<string>(`#include <iostream>
using namespace std;

int main() {
  cout << "Hello L'Amigo IDE!" << endl;
  return 0;
}`);
  const [input, setInput] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Editor Settings
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs' | 'hc-black'>('vs-dark');
  const [fontSize, setFontSize] = useState<number>(18);
  const [tabSize, setTabSize] = useState<number>(4);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [autocomplete, setAutocomplete] = useState<boolean>(true);
  const [extraFlags, setExtraFlags] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const handleNewFile = () => {
    if (window.confirm('Are you sure you want to clear the editor?')) {
      setCode('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCode(evt.target?.result as string || '');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    const element = document.createElement('a');
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    const extMap: Record<string, string> = { 'c++': 'cpp', 'python': 'py', 'java': 'java', 'javascript': 'js', 'rust': 'rs', 'go': 'go' };
    element.download = `main.${extMap[language] || 'txt'}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied to clipboard!');
    } catch (err) {
      alert('Failed to copy code to clipboard.');
    }
  };

  const handleBeautify = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  // Automatically switch compiler when language changes
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCompilerVersion(COMPILERS[newLang][0]);
  };

  const getMonacoLanguage = () => {
    switch (language) {
      case 'c++': return 'cpp';
      case 'python': return 'python';
      case 'java': return 'java';
      case 'javascript': return 'javascript';
      case 'rust': return 'rust';
      case 'go': return 'go';
      default: return 'cpp';
    }
  };

  const executeCode = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setOutput('Compiling and running on Wandbox...');
    
    abortControllerRef.current = new AbortController();
    
    let finalCode = code;
    if (language === 'java') {
      finalCode = finalCode.replace(/public\s+class\s+([a-zA-Z0-9_]+)/g, 'class $1');
    }
    
    try {
      const payload: any = {
        compiler: compilerVersion,
        code: finalCode,
        stdin: input,
        save: false
      };
      
      if (extraFlags.trim()) {
        payload['compiler-option-raw'] = extraFlags;
      }
      
      const res = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (data.compiler_error) {
        setOutput(`Compilation Error:\n${data.compiler_error}`);
      } else if (data.program_error) {
        setOutput(`Runtime Error:\n${data.program_error}\n\nOutput:\n${data.program_output || ''}`);
      } else {
        setOutput(data.program_output || 'Execution completed with no output.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setOutput('Execution cancelled by user.');
      } else {
        setOutput(`Network Error: Failed to reach execution engine.\n${err.message}`);
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  };

  const stopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="ide-container">
      {/* Top Bar */}
      <div className="ide-header">
        <div className="ide-header-left" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="ide-btn-icon" onClick={handleNewFile} title="New File"><FilePlus size={16} /></button>
          <button className="ide-btn-icon" onClick={() => fileInputRef.current?.click()} title="Open File"><FolderOpen size={16} /></button>
          <input type="file" ref={fileInputRef} hidden accept=".cpp,.c,.py,.js,.ts,.java,.rs,.go,.txt" onChange={handleFileUpload} />
          
          <div className="ide-separator"></div>

          <button className="ide-btn-icon" onClick={handleSave} title="Save File"><Save size={16} /></button>
          <button className="ide-btn-icon" onClick={handleShare} title="Share (Copy Code)"><Share2 size={16} /></button>
          <button className="ide-btn-icon" onClick={handleBeautify} title="Beautify (Format)"><Wand2 size={16} /></button>
          
          <div className="ide-separator"></div>

          <select
            value={language}
            onChange={handleLanguageChange}
            className="ide-select"
          >
            <option value="c++">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="javascript">JavaScript</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
          </select>
          
          <select
            value={compilerVersion}
            onChange={(e) => setCompilerVersion(e.target.value)}
            className="ide-select"
          >
            {COMPILERS[language].map((ver) => (
              <option key={ver} value={ver}>{ver}</option>
            ))}
          </select>
          
          <button
            onClick={executeCode}
            disabled={isExecuting}
            className="ide-btn ide-btn-run"
          >
            {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isExecuting ? 'Running...' : 'Run'}
          </button>

          <button
            onClick={stopExecution}
            disabled={!isExecuting}
            className="ide-btn ide-btn-stop"
          >
            <StopCircle size={16} />
            Stop
          </button>
        </div>

        <div className="ide-header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          <button className="ide-btn-icon" onClick={() => setShowSettings(!showSettings)} title="Settings"><Settings size={16} /></button>
          
          {showSettings && (
            <div className="ide-settings-popover">
              <div className="ide-settings-header">
                <h3>Editor Settings</h3>
                <button className="ide-btn-icon-small" onClick={() => setShowSettings(false)}><X size={14}/></button>
              </div>
              <div className="ide-settings-body">
                <div className="ide-setting-row">
                  <label>Theme:</label>
                  <select value={editorTheme} onChange={(e) => setEditorTheme(e.target.value as any)} className="ide-select-small">
                    <option value="vs-dark">Dark</option>
                    <option value="vs">Light</option>
                    <option value="hc-black">High Contrast</option>
                  </select>
                </div>
                <div className="ide-setting-row">
                  <label>Font Size:</label>
                  <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="ide-select-small">
                    <option value={12}>12</option>
                    <option value={14}>14</option>
                    <option value={16}>16</option>
                    <option value={18}>18</option>
                    <option value={20}>20</option>
                  </select>
                </div>
                <div className="ide-setting-row">
                  <label>Tab Space:</label>
                  <select value={tabSize} onChange={(e) => setTabSize(Number(e.target.value))} className="ide-select-small">
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                  </select>
                </div>
                <div className="ide-setting-row">
                  <label>Word Wrap:</label>
                  <div className="ide-radio-group">
                    <label><input type="radio" checked={wordWrap === 'on'} onChange={() => setWordWrap('on')} /> On</label>
                    <label><input type="radio" checked={wordWrap === 'off'} onChange={() => setWordWrap('off')} /> Off</label>
                  </div>
                </div>
                <div className="ide-setting-row">
                  <label>Autocomplete:</label>
                  <div className="ide-radio-group">
                    <label><input type="radio" checked={autocomplete} onChange={() => setAutocomplete(true)} /> On</label>
                    <label><input type="radio" checked={!autocomplete} onChange={() => setAutocomplete(false)} /> Off</label>
                  </div>
                </div>
                <div className="ide-setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <label>Extra Compiler Flags:</label>
                  <input 
                    type="text" 
                    value={extraFlags} 
                    onChange={(e) => setExtraFlags(e.target.value)}
                    className="ide-input"
                    placeholder="-O3 -std=c++20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="ide-main">
        {/* Editor */}
        <div className="ide-editor-wrapper">
          <Editor
            height="100%"
            language={getMonacoLanguage()}
            theme={editorTheme}
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: fontSize,
              tabSize: tabSize,
              wordWrap: wordWrap,
              quickSuggestions: autocomplete,
              suggestOnTriggerCharacters: autocomplete,
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
            onMount={handleEditorDidMount}
          />
        </div>

        {/* Input / Output */}
        <div className="ide-io-panel">
          <div className="ide-io-section">
            <div className="ide-io-header">
              Input (stdin)
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="ide-io-textarea"
              placeholder="Paste input here..."
            />
          </div>
          
          <div className="ide-io-section">
            <div className="ide-io-header">
              <span>Output (stdout)</span>
            </div>
            <textarea
              value={output}
              readOnly
              className="ide-io-textarea"
              placeholder="Output will appear here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

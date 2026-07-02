import React, { useState, useRef, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Play, Loader2, FilePlus, FolderOpen, Save, Share2, Wand2, StopCircle, Settings, X, FileCode, BookOpen } from 'lucide-react';
import { STORAGE_KEYS } from '../../constants';
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

// Format math formulas and LaTeX tokens into clean readable Unicode HTML
const formatProblemHtml = (html: string): string => {
  if (!html) return '';

  const cleanMath = (formula: string) => {
    let res = formula.trim();

    // Subscripts: e.g. a_i -> a<sub>i</sub>
    res = res.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9]+)/g, '$1<sub>$2</sub>');
    res = res.replace(/([a-zA-Z0-9]+)_{([^}]+)}/g, '$1<sub>$2</sub>');

    // Superscripts: e.g. 10^9 -> 10<sup>9</sup>
    res = res.replace(/([a-zA-Z0-9]+)\^([a-zA-Z0-9\-+]+)/g, '$1<sup>$2</sup>');
    res = res.replace(/([a-zA-Z0-9]+)\^{([^}]+)}/g, '$1<sup>$2</sup>');

    // LaTeX math symbols
    res = res.replace(/\\le/g, '≤');
    res = res.replace(/\\ge/g, '≥');
    res = res.replace(/\\lt/g, '&lt;');
    res = res.replace(/\\gt/g, '&gt;');
    res = res.replace(/\\times/g, '×');
    res = res.replace(/\\ne/g, '≠');
    res = res.replace(/\\approx/g, '≈');
    res = res.replace(/\\dots/g, '...');
    res = res.replace(/\\cdots/g, '···');
    res = res.replace(/\\pm/g, '±');
    res = res.replace(/\\cdot/g, '·');
    res = res.replace(/\\bmod/g, 'mod');
    res = res.replace(/\\log/g, 'log');

    // Remove backslashes
    res = res.replace(/\\/g, '');

    // Italicize single-letter math variables
    if (/^[a-zA-Z]$/.test(res)) {
      res = `<i>${res}</i>`;
    }

    return res;
  };

  // Replace all $$$ ... $$$ formulas
  let processed = html.replace(/\$\$\$(.*?)\$\$\$/g, (_, formula) => {
    return `<span class="tex-span">${cleanMath(formula)}</span>`;
  });

  return processed;
};

export const IdeTab: React.FC = () => {
  const DEFAULT_TEMPLATES: Record<string, string> = {
    'c++': `#include <iostream>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    cout << "Hello L'Amigo CF IDE!" << endl;\n    return 0;\n}`,
    'python': `import sys\n\ndef solve():\n    pass\n\ndef main():\n    # Fast I/O\n    input = sys.stdin.read\n    print("Hello L'Amigo CF IDE!")\n\nif __name__ == '__main__':\n    main()`,
    'java': `import java.io.*;\nimport java.util.*;\n\npublic class main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        System.out.println("Hello L'Amigo CF IDE!");\n    }\n}`,
    'javascript': `// JavaScript Boilerplate\nconsole.log("Hello L'Amigo CF IDE!");`,
    'rust': `fn main() {\n    println!("Hello L'Amigo CF IDE!");\n}`,
    'go': `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello L'Amigo CF IDE!")\n}`
  };

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

  // Auto-Fetch Testcases State
  const [testCases, setTestCases] = useState<{ input: string; output: string }[]>([]);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState<number | null>(null);
  const [isFetchingTestcases, setIsFetchingTestcases] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<chrome.tabs.Tab[]>([]);
  const [showTabSelector, setShowTabSelector] = useState(false);

  // Code Templates State
  const [templates, setTemplates] = useState<Record<string, string>>(DEFAULT_TEMPLATES);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tempTemplateLang, setTempTemplateLang] = useState('c++');
  const [tempTemplateText, setTempTemplateText] = useState('');
  const [loadIntoEditorNow, setLoadIntoEditorNow] = useState(true);

  // Problem & Testcases Persistence State
  const [problemName, setProblemName] = useState<string>('');
  const [problemHtml, setProblemHtml] = useState<string>('');
  const [showProblemPanel, setShowProblemPanel] = useState<boolean>(false);

  // Resizable Panel & Console States
  const [leftWidth, setLeftWidth] = useState<number>(40); // in percentage
  const [consoleHeight, setConsoleHeight] = useState<number>(280); // in pixels
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [consoleTab, setConsoleTab] = useState<'input' | 'output'>('input');
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizeWidth = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const containerWidth = containerRef.current?.getBoundingClientRect().width || 1;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(80, Math.max(20, startWidth + deltaPercent));
      setLeftWidth(newWidth);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const startResizeHeight = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.min(600, Math.max(100, startHeight - deltaY));
      setConsoleHeight(newHeight);
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  // Refs for Monaco shortcuts to prevent closures staleness
  const executeCodeRef = useRef<() => any>(() => {});
  const handleSaveRef = useRef<() => any>(() => {});
  const handleNewFileRef = useRef<() => any>(() => {});




  // Editor Settings
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs' | 'hc-black'>('vs-dark');
  const [fontSize, setFontSize] = useState<number>(14);
  const [tabSize, setTabSize] = useState<number>(4);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [autocomplete, setAutocomplete] = useState<boolean>(true);
  const [extraFlags, setExtraFlags] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load custom templates and settings on mount
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEYS.IDE_TEMPLATES, STORAGE_KEYS.IDE_SETTINGS], (res) => {
      if (res[STORAGE_KEYS.IDE_TEMPLATES]) {
        const saved = res[STORAGE_KEYS.IDE_TEMPLATES];
        setTemplates((prev) => ({ ...prev, ...saved }));
        
        // Populate current editor if it matches default boilerplate
        if (code.includes("Hello L'Amigo IDE!")) {
          setCode(saved['c++'] || DEFAULT_TEMPLATES['c++']);
        }
      }

      if (res[STORAGE_KEYS.IDE_SETTINGS]) {
        const settings = res[STORAGE_KEYS.IDE_SETTINGS];
        if (settings.editorTheme) setEditorTheme(settings.editorTheme);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.tabSize) setTabSize(settings.tabSize);
        if (settings.wordWrap) setWordWrap(settings.wordWrap);
        if (settings.autocomplete !== undefined) setAutocomplete(settings.autocomplete);
        if (settings.extraFlags !== undefined) setExtraFlags(settings.extraFlags);
      }
      setSettingsLoaded(true);
    });
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    const settings = {
      editorTheme,
      fontSize,
      tabSize,
      wordWrap,
      autocomplete,
      extraFlags
    };
    chrome.storage.local.set({ [STORAGE_KEYS.IDE_SETTINGS]: settings });
  }, [editorTheme, fontSize, tabSize, wordWrap, autocomplete, extraFlags, settingsLoaded]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Ctrl + Enter to compile/run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeCodeRef.current();
    });

    // Ctrl + S to save file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current();
    });

    // Ctrl + L to reset/load template
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      handleNewFileRef.current();
    });
  };

  const handleNewFile = () => {
    if (window.confirm('Are you sure you want to reset the editor to the template for this language? Unsaved work will be lost.')) {
      setCode(templates[language] || DEFAULT_TEMPLATES[language] || '');
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

  // Automatically switch compiler and load template when language changes
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    const oldLang = language;
    setLanguage(newLang);
    setCompilerVersion(COMPILERS[newLang][0]);

    // Automatically load template if the current code is identical to old language template (or default boilerplate)
    const oldTemplate = templates[oldLang] || DEFAULT_TEMPLATES[oldLang] || '';
    const cleanCode = code.trim().replace(/\s+/g, ' ');
    const cleanOldTemplate = oldTemplate.trim().replace(/\s+/g, ' ');
    if (cleanCode === cleanOldTemplate || code.trim() === '' || code.includes("Hello L'Amigo IDE!")) {
      setCode(templates[newLang] || DEFAULT_TEMPLATES[newLang] || '');
    }
  };

  const handleOpenTemplateModal = () => {
    setTempTemplateLang(language);
    setTempTemplateText(templates[language] || DEFAULT_TEMPLATES[language] || '');
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = () => {
    const updated = {
      ...templates,
      [tempTemplateLang]: tempTemplateText
    };
    setTemplates(updated);
    chrome.storage.local.set({ [STORAGE_KEYS.IDE_TEMPLATES]: updated }, () => {
      if (loadIntoEditorNow && tempTemplateLang === language) {
        setCode(tempTemplateText);
      }
      setShowTemplateModal(false);
    });
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
    setShowConsole(true);
    setConsoleTab('output');
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

  useEffect(() => {
    executeCodeRef.current = executeCode;
  }, [executeCode]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    handleNewFileRef.current = handleNewFile;
  }, [handleNewFile]);

  const saveTestcasesToStorage = (list: { input: string; output: string }[], currentProblemName = problemName) => {
    if (currentProblemName.trim()) {
      chrome.storage.local.set({ [`ide_testcases_${currentProblemName}`]: list });
    }
  };

  const handleProblemNameChange = (newName: string) => {
    setProblemName(newName);
    if (newName.trim()) {
      chrome.storage.local.get([`ide_testcases_${newName}`, `ide_problem_html_${newName}`], (res) => {
        if (res[`ide_testcases_${newName}`]) {
          const list = res[`ide_testcases_${newName}`];
          setTestCases(list);
          if (list.length > 0) {
            setActiveTestCaseIndex(0);
            setInput(list[0].input);
          } else {
            setActiveTestCaseIndex(null);
            setInput('');
          }
        }
        if (res[`ide_problem_html_${newName}`]) {
          setProblemHtml(res[`ide_problem_html_${newName}`]);
          setShowProblemPanel(true);
        } else {
          setProblemHtml('');
          setShowProblemPanel(false);
        }
      });
    }
  };

  const handleAddTestCase = () => {
    const newTc = { input: '', output: '' };
    const updated = [...testCases, newTc];
    setTestCases(updated);
    setActiveTestCaseIndex(updated.length - 1);
    setInput('');
    saveTestcasesToStorage(updated);
  };

  const handleDeleteTestCase = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = testCases.filter((_, i) => i !== idx);
    setTestCases(updated);
    saveTestcasesToStorage(updated);
    if (activeTestCaseIndex === idx) {
      if (updated.length > 0) {
        setActiveTestCaseIndex(0);
        setInput(updated[0].input);
      } else {
        setActiveTestCaseIndex(null);
        setInput('');
      }
    } else if (activeTestCaseIndex !== null && activeTestCaseIndex > idx) {
      setActiveTestCaseIndex(activeTestCaseIndex - 1);
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (activeTestCaseIndex !== null) {
      const updated = [...testCases];
      updated[activeTestCaseIndex] = {
        ...updated[activeTestCaseIndex],
        input: val
      };
      setTestCases(updated);
      saveTestcasesToStorage(updated);
    }
  };

  const fetchFromTabUrl = async (url: string) => {
    setIsFetchingTestcases(true);
    setTestCases([]);
    setActiveTestCaseIndex(null);

    try {
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract problem title as name
      const titleEl = doc.querySelector('title');
      const titleText = titleEl?.textContent?.replace(' - Codeforces', '').trim() || 'Codeforces Problem';
      setProblemName(titleText);

      // Extract problem statement HTML
      const problemStatementEl = doc.querySelector('.problem-statement');
      let statementHtml = '';
      if (problemStatementEl) {
        statementHtml = problemStatementEl.innerHTML;
        setProblemHtml(statementHtml);
        setShowProblemPanel(true);
      } else {
        setProblemHtml('');
        setShowProblemPanel(false);
      }

      const sampleTests = doc.querySelectorAll('.sample-tests .sample-test');
      if (sampleTests.length === 0) {
        alert("No sample tests found on the detected Codeforces problem page.");
        setIsFetchingTestcases(false);
        return;
      }

      const list: { input: string; output: string }[] = [];
      sampleTests.forEach(test => {
        const inputPre = test.querySelector('.input pre');
        const outputPre = test.querySelector('.output pre');
        if (inputPre && outputPre) {
          const parsePre = (el: Element) => {
            const clone = el.cloneNode(true) as Element;
            clone.querySelectorAll('br').forEach(br => {
              br.replaceWith(doc.createTextNode('\n'));
            });
            clone.querySelectorAll('div').forEach(div => {
              div.before(doc.createTextNode('\n'));
            });
            return clone.textContent?.trim() || '';
          };
          list.push({
            input: parsePre(inputPre),
            output: parsePre(outputPre)
          });
        }
      });

      if (list.length > 0) {
        setTestCases(list);
        setActiveTestCaseIndex(0);
        setInput(list[0].input);
        saveTestcasesToStorage(list, titleText);
        // Save problem HTML as well
        chrome.storage.local.set({ [`ide_problem_html_${titleText}`]: statementHtml });
      } else {
        alert("Failed to parse Codeforces test cases.");
      }
    } catch (err: any) {
      alert(`Error fetching testcases: ${err.message || err}`);
    } finally {
      setIsFetchingTestcases(false);
    }
  };

  const fetchActiveTabTestCases = async () => {
    if (isFetchingTestcases) return;
    setAvailableTabs([]);
    setShowTabSelector(false);

    try {
      // Find open Codeforces problem tabs (either in contest or general problemset)
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
        chrome.tabs.query({
          url: [
            "*://codeforces.com/contest/*/problem/*",
            "*://codeforces.com/problemset/problem/*"
          ]
        }, resolve);
      });

      if (!tabs || tabs.length === 0) {
        alert("No Codeforces problem tabs found. Please open a Codeforces problem page in a browser tab.");
        return;
      }

      if (tabs.length === 1) {
        const url = tabs[0].url;
        if (url) await fetchFromTabUrl(url);
      } else {
        // Multiple tabs found, display selector popover
        setAvailableTabs(tabs);
        setShowTabSelector(true);
      }
    } catch (err: any) {
      alert(`Error querying tabs: ${err.message || err}`);
    }
  };

  const handleFetchFromTab = async (tab: chrome.tabs.Tab) => {
    setShowTabSelector(false);
    if (tab.url) {
      await fetchFromTabUrl(tab.url);
    }
  };

  const handleTestCaseSelect = (idx: number) => {
    setActiveTestCaseIndex(idx);
    setInput(testCases[idx].input);
  };

  // actual vs expected side-by-side diff renderer helpers
  const renderActualOutputWithDiff = () => {
    const isRunning = output.startsWith('Compiling and running') || output.startsWith('Error') || output.startsWith('Network Error');
    if (isRunning || activeTestCaseIndex === null || !testCases[activeTestCaseIndex]?.output) {
      return (
        <textarea
          value={output}
          readOnly
          className="ide-io-textarea"
          placeholder="Output will appear here..."
        />
      );
    }

    const expected = testCases[activeTestCaseIndex].output.trim();
    const actual = output.trim();
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    const maxLines = Math.max(actualLines.length, expectedLines.length);

    return (
      <div className="ide-diff-container ide-io-textarea" style={{ overflowY: 'auto', padding: '8px 12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre', lineHeight: '1.6', boxSizing: 'border-box' }}>
        {Array.from({ length: maxLines }).map((_, idx) => {
          const actLine = actualLines[idx] ?? '';
          const expLine = expectedLines[idx] ?? '';
          const isMatch = actLine === expLine;
          
          return (
            <div
              key={idx}
              className={`ide-diff-line ${isMatch ? 'ide-diff-match' : 'ide-diff-mismatch-act'}`}
              style={{
                backgroundColor: isMatch ? 'transparent' : 'rgba(239, 68, 68, 0.15)',
                color: isMatch ? 'var(--text-primary, #fff)' : '#ef4444',
                padding: '0 4px',
                minHeight: '20px'
              }}
            >
              {actLine}
            </div>
          );
        })}
      </div>
    );
  };

  const renderExpectedOutputWithDiff = () => {
    if (activeTestCaseIndex === null || !testCases[activeTestCaseIndex]?.output) return null;
    const isRunning = output.startsWith('Compiling and running') || output.startsWith('Error') || output.startsWith('Network Error');
    if (isRunning) return null;

    const expected = testCases[activeTestCaseIndex].output.trim();
    const actual = output.trim();
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    const maxLines = Math.max(actualLines.length, expectedLines.length);

    return (
      <div className="ide-expected-section">
        <div className="ide-expected-header">EXPECTED OUTPUT</div>
        <div className="ide-diff-container ide-io-textarea ide-expected-textarea" style={{ overflowY: 'auto', padding: '8px 12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre', lineHeight: '1.6', boxSizing: 'border-box' }}>
          {Array.from({ length: maxLines }).map((_, idx) => {
            const actLine = actualLines[idx] ?? '';
            const expLine = expectedLines[idx] ?? '';
            const isMatch = actLine === expLine;
            
            return (
              <div
                key={idx}
                className={`ide-diff-line ${isMatch ? 'ide-diff-match' : 'ide-diff-mismatch-exp'}`}
                style={{
                  backgroundColor: isMatch ? 'transparent' : 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  padding: '0 4px',
                  minHeight: '20px'
                }}
              >
                {expLine}
              </div>
            );
          })}
        </div>
      </div>
    );
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
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={fetchActiveTabTestCases}
              disabled={isFetchingTestcases}
              className="ide-btn ide-btn-fetch"
              title="Fetch problem description and testcases from open Codeforces tabs"
            >
              {isFetchingTestcases ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {isFetchingTestcases ? 'Fetching...' : 'Fetch Problem'}
            </button>

            {showTabSelector && availableTabs.length > 0 && (
              <div className="ide-tab-selector-popover">
                <div className="ide-tab-selector-header">
                  <span>Select Codeforces Tab:</span>
                  <button className="ide-btn-icon-small" onClick={() => setShowTabSelector(false)}><X size={14}/></button>
                </div>
                <div className="ide-tab-selector-body">
                  {availableTabs.map((tab) => (
                    <button
                      key={tab.id}
                      className="ide-tab-option"
                      onClick={() => handleFetchFromTab(tab)}
                      title={tab.title}
                    >
                      <span className="ide-tab-option-title">{tab.title || tab.url}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="ide-header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          {problemHtml && (
            <button className={`ide-btn-icon ${showProblemPanel ? 'active' : ''}`} onClick={() => setShowProblemPanel(!showProblemPanel)} title="Toggle Problem Description"><BookOpen size={16} /></button>
          )}
          <button className="ide-btn-icon" onClick={handleOpenTemplateModal} title="Edit Code Templates"><FileCode size={16} /></button>
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
      <div className="ide-main" ref={containerRef} style={{ display: 'flex', width: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Problem Description Panel */}
        {showProblemPanel && problemHtml && (
          <div className="ide-problem-panel" style={{ width: `${leftWidth}%`, height: '100%' }}>
            <div className="ide-problem-panel-header">
              <span>Problem Description</span>
              <button className="ide-btn-icon-small" onClick={() => setShowProblemPanel(false)}><X size={14} /></button>
            </div>
            <div className="ide-problem-panel-body" dangerouslySetInnerHTML={{ __html: formatProblemHtml(problemHtml) }} />
          </div>
        )}

        {/* Horizontal Resizer Divider */}
        {showProblemPanel && problemHtml && (
          <div
            className="ide-resizer-horizontal"
            onMouseDown={startResizeWidth}
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: 'var(--border-strong, #333)',
              zIndex: 10,
              height: '100%',
              transition: 'background 0.2s',
            }}
          />
        )}

        {/* Right workspace: Editor on top, Console drawer on bottom */}
        <div className="ide-right-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Editor */}
          <div className="ide-editor-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
                fontFamily: 'Consolas, Courier New, monospace',
              }}
              onMount={handleEditorDidMount}
            />
          </div>

          {/* Vertical Resizer Divider */}
          {showConsole && (
            <div
              className="ide-resizer-vertical"
              onMouseDown={startResizeHeight}
              style={{
                height: '4px',
                cursor: 'row-resize',
                background: 'var(--border-strong, #333)',
                zIndex: 10,
                width: '100%',
                transition: 'background 0.2s',
              }}
            />
          )}

          {/* Bottom Collapsible Console Drawer */}
          {showConsole && (
            <div className="ide-console-drawer" style={{ height: `${consoleHeight}px`, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary, #1e1e1e)', borderTop: '1px solid var(--border-color, #333)', boxSizing: 'border-box' }}>
              <div className="ide-console-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-tertiary, #252525)', borderBottom: '1px solid var(--border-color, #333)' }}>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600 }}>
                  <button 
                    className={`ide-console-tab-btn ${consoleTab === 'input' ? 'active' : ''}`}
                    onClick={() => setConsoleTab('input')}
                    style={{ background: 'transparent', border: 'none', color: consoleTab === 'input' ? '#ffa116' : 'var(--text-secondary, #888)', cursor: 'pointer', paddingBottom: '4px', borderBottom: consoleTab === 'input' ? '2px solid #ffa116' : 'none' }}
                  >
                    Testcase (stdin)
                  </button>
                  <button 
                    className={`ide-console-tab-btn ${consoleTab === 'output' ? 'active' : ''}`}
                    onClick={() => setConsoleTab('output')}
                    style={{ background: 'transparent', border: 'none', color: consoleTab === 'output' ? '#10b981' : 'var(--text-secondary, #888)', cursor: 'pointer', paddingBottom: '4px', borderBottom: consoleTab === 'output' ? '2px solid #10b981' : 'none' }}
                  >
                    Test Result (stdout)
                  </button>
                </div>
                <button className="ide-btn-icon-small" onClick={() => setShowConsole(false)}><X size={14} /></button>
              </div>

              <div className="ide-console-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {consoleTab === 'input' ? (
                  <div className="ide-io-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="ide-io-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '6px 16px', background: 'transparent', borderBottom: 'none' }}>
                      <div className="ide-problem-name-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary, #999)', fontWeight: 600 }}>Problem:</span>
                        <input
                          type="text"
                          value={problemName}
                          onChange={(e) => handleProblemNameChange(e.target.value)}
                          className="ide-problem-name-input"
                          placeholder="e.g. 1932C"
                        />
                      </div>
                      <div className="ide-tc-pills">
                        {testCases.map((_, idx) => (
                          <div key={idx} className="ide-tc-pill-container" style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                            <button
                              onClick={() => handleTestCaseSelect(idx)}
                              className={`ide-tc-pill ${activeTestCaseIndex === idx ? 'active' : ''}`}
                              style={{ paddingRight: '22px' }}
                            >
                              TC {idx + 1}
                            </button>
                            <button
                              onClick={(e) => handleDeleteTestCase(idx, e)}
                              className="ide-tc-delete-btn"
                              title="Delete testcase"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={handleAddTestCase}
                          className="ide-tc-add-btn"
                          title="Add custom testcase"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="ide-io-textarea"
                      placeholder="Paste input here..."
                      style={{ flex: 1, border: 'none', resize: 'none', background: 'transparent', padding: '12px' }}
                    />
                  </div>
                ) : (
                  <div className="ide-io-section" style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
                    <div className="ide-output-split" style={{ display: 'flex', width: '100%', height: '100%' }}>
                      {renderActualOutputWithDiff()}
                      {renderExpectedOutputWithDiff()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed Console Bar (LeetCode-style bottom row) */}
          <div className="ide-footer-console-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-tertiary, #252525)', borderTop: '1px solid var(--border-color, #333)' }}>
            <button 
              className="ide-console-toggle-btn"
              onClick={() => {
                setShowConsole(!showConsole);
                if (!showConsole) setConsoleTab('input');
              }}
              style={{ background: 'transparent', border: '1px solid var(--border-color, #444)', color: 'var(--text-primary, #fff)', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Console</span>
              <span style={{ fontSize: '10px' }}>{showConsole ? '▼' : '▲'}</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={async () => {
                  setShowConsole(true);
                  setConsoleTab('output');
                  await executeCode();
                }}
                disabled={isExecuting}
                className="ide-btn ide-btn-run"
                style={{ height: '32px', padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', border: 'none', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 600 }}
              >
                {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {isExecuting ? 'Running...' : 'Run Code'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Code Templates Modal */}
      {showTemplateModal && (
        <div className="ide-modal-backdrop">
          <div className="ide-modal">
            <div className="ide-modal-header">
              <h3>Edit Code Templates</h3>
              <button className="ide-btn-icon-small" onClick={() => setShowTemplateModal(false)}><X size={14}/></button>
            </div>
            <div className="ide-modal-body">
              <div className="ide-setting-row" style={{ marginBottom: '12px' }}>
                <label>Language:</label>
                <select
                  value={tempTemplateLang}
                  onChange={(e) => {
                    setTempTemplateLang(e.target.value);
                    setTempTemplateText(templates[e.target.value] || DEFAULT_TEMPLATES[e.target.value] || '');
                  }}
                  className="ide-select-small"
                >
                  <option value="c++">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="javascript">JavaScript</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                </select>
              </div>
              <div className="ide-setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px', flex: 1, height: '300px' }}>
                <label>Template Code:</label>
                <textarea
                  value={tempTemplateText}
                  onChange={(e) => setTempTemplateText(e.target.value)}
                  className="ide-template-textarea"
                  placeholder="Paste your boilerplate/template code here..."
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  id="load-into-editor"
                  checked={loadIntoEditorNow}
                  onChange={(e) => setLoadIntoEditorNow(e.target.checked)}
                />
                <label htmlFor="load-into-editor" style={{ cursor: 'pointer', color: 'var(--text-primary, #fff)' }}>Load template into active editor now</label>
              </div>
            </div>
            <div className="ide-modal-footer">
              <button
                className="ide-modal-btn ide-modal-btn-reset"
                onClick={() => {
                  if (confirm("Reset this language's template to default?")) {
                    setTempTemplateText(DEFAULT_TEMPLATES[tempTemplateLang] || '');
                  }
                }}
              >
                Reset to Default
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="ide-modal-btn ide-modal-btn-cancel" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button className="ide-modal-btn ide-modal-btn-save" onClick={handleSaveTemplate}>Save Template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

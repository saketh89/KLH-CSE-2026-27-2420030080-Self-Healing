import React, { useState } from 'react';
import { JAVA_DELIVERABLES, CodeSnippetFile } from '../data/javaDeliverables';
import { Copy, Check, Download, FileCode, Search, Sparkles, Terminal } from 'lucide-react';

export const CodeInspector: React.FC = () => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentFile: CodeSnippetFile = JAVA_DELIVERABLES[activeFileIndex] || JAVA_DELIVERABLES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = currentFile.code.split('\n');

  return (
    <div className="w-full bg-[#121214] border border-[#1E1E20] rounded-xl shadow-xl overflow-hidden flex flex-col">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between bg-[#0A0A0B] px-4 pt-3 border-b border-[#1E1E20] overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {JAVA_DELIVERABLES.map((file, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveFileIndex(idx);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeFileIndex === idx
                  ? 'bg-[#1A1A1D] text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-[#161618]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>{file.filename}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#0E0E10] text-slate-500 rounded font-sans border border-[#2A2A2C]">
                {file.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pb-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161618] hover:bg-[#1A1A1D] text-slate-200 text-xs font-medium rounded-lg transition-all cursor-pointer border border-[#2A2A2C]"
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-md shadow-blue-900/20"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Description Bar & In-File Search */}
      <div className="px-6 py-3 bg-[#0E0E10] border-b border-[#1E1E20] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium font-mono">{currentFile.description}</span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search within file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161618] border border-[#2A2A2C] rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Code Viewer with Line Numbers */}
      <div className="p-4 bg-[#0A0A0B] overflow-x-auto max-h-[560px] overflow-y-auto font-mono text-xs leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, lineIdx) => {
              const isMatch =
                searchQuery.trim().length > 0 &&
                line.toLowerCase().includes(searchQuery.toLowerCase());

              return (
                <tr
                  key={lineIdx}
                  className={`hover:bg-[#161618]/60 transition-colors ${
                    isMatch ? 'bg-amber-950/40 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <td className="w-12 pr-4 text-right select-none text-slate-600 font-mono text-[11px] align-top py-0.5">
                    {lineIdx + 1}
                  </td>
                  <td className="text-slate-300 whitespace-pre font-mono py-0.5 pl-2">
                    {formatSyntax(line, currentFile.language)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Simple syntax colorizer for crisp viewing
function formatSyntax(line: string, language: string): React.ReactNode {
  if (language === 'yaml') {
    if (line.trim().startsWith('#')) {
      return <span className="text-slate-500 italic">{line}</span>;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx);
      const val = line.slice(colonIdx + 1);
      return (
        <span>
          <span className="text-sky-300 font-semibold">{key}:</span>
          <span className="text-amber-200">{val}</span>
        </span>
      );
    }
    return <span className="text-slate-200">{line}</span>;
  }

  // Java / TSX simple highlighting
  if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }
  if (line.trim().startsWith('@')) {
    return <span className="text-purple-400 font-semibold">{line}</span>;
  }

  return <span className="text-slate-200">{line}</span>;
}

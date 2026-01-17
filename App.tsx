
import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

// Declare chrome global for TypeScript
declare const chrome: any;

// --- Types ---
interface AnalysisResult {
  deepfake_score: number;
  verdict: string;
  confidence: string;
  integrity: { score: number; notes: string };
  consistency: { score: number; notes: string };
  ai_pattern: { score: number; notes: string };
  temporal: { score: number; notes: string };
}

enum AppStatus {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// --- Components ---

const Header = ({ status }: { status: AppStatus }) => (
  <header className="flex items-center justify-between p-4 border-b border-white/10 bg-charcoal sticky top-0 z-50">
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 bg-neonGreen rounded-sm flex items-center justify-center font-bold text-charcoal text-xs">F</div>
      <h1 className="text-xl font-bold tracking-tighter text-white">fakey<span className="text-neonGreen">.ai</span></h1>
    </div>
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${status === AppStatus.SCANNING ? 'bg-neonGreen animate-pulse' : 'bg-white/20'}`} />
      <span className="text-[10px] uppercase tracking-widest text-white/50 font-mono">
        {status}
      </span>
    </div>
  </header>
);

const ScoreCircle = ({ score, verdict }: { score: number; verdict: string }) => {
  const color = score > 60 ? 'text-red-500' : score > 30 ? 'text-yellow-500' : 'text-neonGreen';
  const strokeColor = score > 60 ? '#ef4444' : score > 30 ? '#eab308' : '#39FF14';

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="transparent" stroke="#1A1A1A" strokeWidth="8" />
          <circle 
            cx="50" cy="50" r="45" fill="transparent" stroke={strokeColor} strokeWidth="8"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * score) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold font-mono ${color}`}>{score}</span>
          <span className="text-[10px] text-white/40 uppercase font-mono tracking-tighter">Likelihood</span>
        </div>
      </div>
      <div className={`mt-4 px-4 py-1 rounded-full border ${color} border-current text-xs font-bold uppercase tracking-widest bg-black/50`}>
        {verdict}
      </div>
    </div>
  );
};

const MetricRow = ({ label, score, notes }: { label: string; score: number; notes: string }) => (
  <div className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
    <div className="flex justify-between items-center mb-1">
      <span className="text-[11px] font-mono text-white/70 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-mono ${score > 60 ? 'text-red-400' : 'text-neonGreen'}`}>{score}%</span>
    </div>
    <div className="w-full bg-darkGray h-1 mb-2">
      <div 
        className={`h-full ${score > 60 ? 'bg-red-500' : 'bg-neonGreen'} transition-all duration-700`} 
        style={{ width: `${score}%` }}
      />
    </div>
    <p className="text-[10px] text-white/50 leading-relaxed italic">"{notes}"</p>
  </div>
);

// --- Main App ---

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performAnalysis = useCallback(async (base64Data: string) => {
    try {
      // Ensure we extract the pure base64 string without data:image/jpeg;base64, prefix
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      
      // Initializing GoogleGenAI with the named parameter apiKey
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Perform a forensic analysis of this screenshot to detect AI-generated content or deepfakes. Examine noise patterns, frequency domain artifacts, lighting inconsistencies, and anatomical errors. 
      Return the analysis in JSON format.`;

      // Calling generateContent with the model name 'gemini-3-flash-preview' for analysis
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { 
            parts: [
              { text: prompt }, 
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
            ] 
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deepfake_score: { type: Type.NUMBER, description: "Scale 0-100 where 100 is definitely deepfake" },
              verdict: { type: Type.STRING },
              confidence: { type: Type.STRING },
              integrity: {
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }
              },
              consistency: {
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }
              },
              ai_pattern: {
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }
              },
              temporal: {
                type: Type.OBJECT,
                properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }
              }
            },
            required: ["deepfake_score", "verdict", "integrity", "consistency", "ai_pattern", "temporal"]
          }
        }
      });

      // Extracting text output from GenerateContentResponse
      const responseText = response.text;
      if (!responseText) throw new Error("Empty analysis response");
      
      const data = JSON.parse(responseText);
      setResult(data);
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error('Analysis Error:', err);
      setError(err.message || 'Analysis failed. The image might be too large or incompatible.');
      setStatus(AppStatus.ERROR);
    }
  }, []);

  const handleScan = async () => {
    setStatus(AppStatus.SCANNING);
    setError(null);
    setResult(null);

    // Using the declared global chrome variable to communicate with the background script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "capture_tab" }, (response: any) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message);
          setStatus(AppStatus.ERROR);
        } else if (response && response.dataUrl) {
          performAnalysis(response.dataUrl);
        } else if (response && response.error) {
          setError(response.error);
          setStatus(AppStatus.ERROR);
        } else {
          setError("Failed to capture screen.");
          setStatus(AppStatus.ERROR);
        }
      });
    } else {
      // Development/Web environment fallback
      console.warn("Chrome API not available, using fallback.");
      setTimeout(() => {
        const fallbackImg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAboxj/2gAMAwEAAhEDEQA/AP/Z";
        performAnalysis(fallbackImg);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col min-h-[500px] font-mono selection:bg-neonGreen selection:text-charcoal bg-charcoal">
      <Header status={status} />

      <main className="flex-1 overflow-y-auto p-4">
        {status === AppStatus.IDLE && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 border border-dashed border-white/20 rounded-full flex items-center justify-center mb-6">
              <div className="w-2 h-2 bg-neonGreen rounded-full" />
            </div>
            <h2 className="text-lg font-bold mb-2">Ready to Scan</h2>
            <p className="text-xs text-white/50 mb-8 max-w-[200px]">
              Forensic analysis of visible media elements on the current page.
            </p>
            <button 
              onClick={handleScan}
              className="group relative px-8 py-3 bg-neonGreen text-charcoal font-bold text-sm uppercase tracking-tighter hover:bg-white transition-all active:scale-95"
            >
              Scan Current Screen
              <div className="absolute -inset-1 border border-neonGreen/30 -z-10 group-hover:-inset-2 transition-all opacity-0 group-hover:opacity-100" />
            </button>
            <p className="mt-4 text-[10px] text-white/30 uppercase tracking-widest">Requires one-time permission</p>
          </div>
        )}

        {status === AppStatus.SCANNING && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-2 border-neonGreen/20 rounded-full" />
              <div className="absolute inset-0 border-t-2 border-neonGreen rounded-full animate-spin" />
              <div className="absolute inset-4 bg-neonGreen/10 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-neonGreen text-xs font-bold animate-pulse">EXTRACTING FRAME DATA...</p>
              <p className="text-[10px] text-white/40 font-mono">Running GAN detection heuristic</p>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ScoreCircle score={result.deepfake_score} verdict={result.verdict} />
            
            <div className="space-y-1 mt-4">
              <MetricRow label="Integrity Check" score={result.integrity.score} notes={result.integrity.notes} />
              <MetricRow label="Consistency" score={result.consistency.score} notes={result.consistency.notes} />
              <MetricRow label="AI Pattern" score={result.ai_pattern.score} notes={result.ai_pattern.notes} />
              <MetricRow label="Temporal Logic" score={result.temporal.score} notes={result.temporal.notes} />
            </div>

            <div className="mt-8 p-4 bg-white/5 border border-white/10 text-[11px] leading-relaxed">
              <h3 className="font-bold text-white mb-1 uppercase tracking-wider text-[10px]">Forensic Verdict</h3>
              <p className="text-white/60">
                Found {result.deepfake_score}% correlation with synthetic generation patterns. {result.verdict === 'Likely Deepfake' ? 'The content displays typical GAN or diffusion artifacts.' : 'Source patterns are within expected variance.'}
              </p>
              <div className="mt-3 flex items-center gap-2 text-neonGreen font-bold uppercase text-[9px]">
                <span className="w-1 h-1 bg-neonGreen rounded-full" />
                Protocol: Verify source before sharing
              </div>
            </div>

            <button 
              onClick={() => setStatus(AppStatus.IDLE)}
              className="w-full mt-6 py-3 border border-white/10 text-white/50 text-[10px] uppercase font-bold tracking-widest hover:text-white hover:border-white/30 transition-all"
            >
              Return to Control
            </button>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="py-12 text-center">
            <div className="text-red-500 mb-4 font-bold text-sm">Forensic Failure: {error}</div>
            <button 
              onClick={() => setStatus(AppStatus.IDLE)}
              className="text-[10px] text-white/50 underline uppercase tracking-widest hover:text-white"
            >
              Reset Session
            </button>
          </div>
        )}
      </main>

      <footer className="p-4 border-t border-white/5 bg-charcoal text-[9px] text-white/30 font-mono flex justify-between uppercase tracking-widest">
        <span>Unit // FKY-01</span>
        <span>© fakey.ai 2025</span>
      </footer>
    </div>
  );
}

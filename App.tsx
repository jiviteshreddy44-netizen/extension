
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

declare const chrome: any;

interface AnalysisResult {
  deepfake_score: number;
  verdict: 'Likely Real' | 'Uncertain' | 'Likely Deepfake';
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

const Header = ({ status }: { status: AppStatus }) => (
  <header className="flex items-center justify-between p-4 border-b border-white/10 bg-charcoal">
    <div className="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="#39FF14" strokeWidth="2"/>
        <path d="M12 6V18M12 6L8 10M12 6L16 10" stroke="#39FF14" strokeWidth="2"/>
      </svg>
      <h1 className="text-lg font-bold tracking-tighter text-white">fakey<span className="text-neonGreen">.ai</span></h1>
    </div>
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${status === AppStatus.SCANNING ? 'bg-neonGreen animate-pulse' : 'bg-white/20'}`} />
      <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono">{status}</span>
    </div>
  </header>
);

const MetricItem = ({ label, score, notes }: { label: string; score: number; notes: string }) => (
  <div className="py-3 border-b border-white/5 last:border-0">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-[10px] text-white/60 uppercase tracking-tighter">{label}</span>
      <span className={`text-[11px] font-bold ${score > 60 ? 'text-red-500' : 'text-neonGreen'}`}>{score}%</span>
    </div>
    <div className="w-full bg-white/5 h-0.5 mb-2">
      <div 
        className={`h-full transition-all duration-1000 ${score > 60 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-neonGreen shadow-[0_0_8px_rgba(57,255,20,0.5)]'}`} 
        style={{ width: `${score}%` }}
      />
    </div>
    <p className="text-[9px] text-white/30 font-mono italic">{notes}</p>
  </div>
);

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performAnalysis = async (dataUrl: string) => {
    try {
      const base64Data = dataUrl.split(',')[1];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { parts: [
            { text: "Analyze this image for deepfake artifacts (GAN noise, pixel consistency, anatomical errors). Provide a forensic breakdown." },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ]}
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deepfake_score: { type: Type.NUMBER },
              verdict: { type: Type.STRING, enum: ['Likely Real', 'Uncertain', 'Likely Deepfake'] },
              confidence: { type: Type.STRING },
              integrity: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              consistency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              ai_pattern: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              temporal: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] }
            },
            required: ["deepfake_score", "verdict", "integrity", "consistency", "ai_pattern", "temporal"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setResult(data);
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "Forensic node failure.");
      setStatus(AppStatus.ERROR);
    }
  };

  const startScan = () => {
    setStatus(AppStatus.SCANNING);
    setError(null);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "capture_tab" }, (res: any) => {
        if (res?.dataUrl) performAnalysis(res.dataUrl);
        else {
          setError(res?.error || "Capture denied by system.");
          setStatus(AppStatus.ERROR);
        }
      });
    } else {
      setTimeout(() => {
        setError("Extension environment not detected.");
        setStatus(AppStatus.ERROR);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-charcoal text-white font-mono selection:bg-neonGreen selection:text-black">
      <Header status={status} />

      <div className="flex-1 overflow-y-auto px-4">
        {status === AppStatus.IDLE && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="mb-8 p-6 border border-white/5 bg-white/[0.02] rounded-lg">
              <p className="text-[11px] text-white/50 leading-relaxed mb-4">
                Verify on-screen media integrity using 
                <span className="text-white"> neural frequency analysis</span>.
              </p>
              <div className="flex justify-center gap-4 text-[9px] uppercase tracking-widest text-white/30">
                <span>// IMAGES</span>
                <span>// VIDEO</span>
                <span>// CANVAS</span>
              </div>
            </div>
            
            <button 
              onClick={startScan}
              className="w-full py-4 bg-neonGreen text-black font-bold uppercase tracking-tighter hover:bg-white transition-all active:scale-[0.98] border border-neonGreen"
            >
              Scan This Screen
            </button>
            <p className="mt-4 text-[9px] text-white/30 uppercase tracking-[0.2em]">Requires active tab permission</p>
          </div>
        )}

        {status === AppStatus.SCANNING && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-16 h-16 border border-neonGreen/20 border-t-neonGreen rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(57,255,20,0.2)]" />
            <h2 className="text-neonGreen text-xs font-bold tracking-widest animate-pulse">EXTRACTING METADATA...</h2>
            <p className="text-[9px] text-white/40 mt-2">Checking frequency domain artifacts</p>
          </div>
        )}

        {status === AppStatus.COMPLETED && result && (
          <div className="py-4 space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-sm text-center">
              <div className="text-[48px] font-bold tracking-tighter leading-none mb-1">
                {result.deepfake_score}<span className="text-sm text-white/30 font-normal">%</span>
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-widest inline-block px-3 py-1 rounded-sm border ${result.deepfake_score > 60 ? 'border-red-500 text-red-500' : 'border-neonGreen text-neonGreen'}`}>
                {result.verdict}
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 p-3">
              <MetricItem label="Integrity" score={result.integrity.score} notes={result.integrity.notes} />
              <MetricItem label="Consistency" score={result.consistency.score} notes={result.consistency.notes} />
              <MetricItem label="AI Pattern" score={result.ai_pattern.score} notes={result.ai_pattern.notes} />
              <MetricItem label="Temporal" score={result.temporal.score} notes={result.temporal.notes} />
            </div>

            <div className="text-[10px] text-white/40 leading-relaxed border-l-2 border-neonGreen pl-3">
              <span className="text-neonGreen font-bold block mb-1">RECOMMENDATION:</span>
              Verify source metadata before sharing. Forensic indicators suggest {result.deepfake_score}% non-human variance.
            </div>

            <button 
              onClick={() => setStatus(AppStatus.IDLE)}
              className="w-full py-2 border border-white/10 text-white/40 text-[9px] uppercase hover:text-white transition-colors"
            >
              Start New Analysis
            </button>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-red-500 text-xs font-bold mb-4 uppercase tracking-widest">Analysis Blocked</div>
            <p className="text-[10px] text-white/40 mb-6 px-8">{error}</p>
            <button onClick={() => setStatus(AppStatus.IDLE)} className="text-neonGreen text-[10px] underline uppercase font-bold">Retry Protocol</button>
          </div>
        )}
      </div>

      <footer className="p-3 border-t border-white/5 flex justify-between items-center text-[8px] text-white/20 uppercase tracking-[0.2em]">
        <span>REF: FKY-MV3-2025</span>
        <span className="text-neonGreenDim">Secure Channel Active</span>
      </footer>
    </div>
  );
}

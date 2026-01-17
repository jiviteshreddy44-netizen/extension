
import React, { useState } from 'https://esm.sh/react@19.2.3';
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@1.37.0';

declare const chrome: any;

interface AnalysisResult {
  deepfake_score: number;
  verdict: string;
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
            { text: "Analyze this image for deepfake artifacts. Focus on GAN noise, frequency domain anomalies, and anatomical consistency. Return results in JSON format." },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ]}
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deepfake_score: { type: Type.NUMBER },
              verdict: { type: Type.STRING },
              integrity: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              consistency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              ai_pattern: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] },
              temporal: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } }, required: ["score", "notes"] }
            },
            required: ["deepfake_score", "verdict", "integrity", "consistency", "ai_pattern", "temporal"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      setResult(JSON.parse(text));
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "Forensic analysis failed.");
      setStatus(AppStatus.ERROR);
    }
  };

  const startScan = () => {
    setStatus(AppStatus.SCANNING);
    setError(null);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "capture_tab" }, (res: any) => {
        if (res?.dataUrl) {
          performAnalysis(res.dataUrl);
        } else {
          setError(res?.error || "Tab capture failed. Check permissions.");
          setStatus(AppStatus.ERROR);
        }
      });
    } else {
      setError("Extension environment unavailable.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>fakey<span style={{ color: '#39FF14' }}>.ai</span></h1>
        <span style={{ fontSize: '10px', opacity: 0.5, letterSpacing: '1px' }}>{status}</span>
      </header>

      <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {status === AppStatus.IDLE && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '24px' }}>Forensic Neural Analysis Tool</p>
            <button 
              onClick={startScan}
              style={{ width: '100%', padding: '16px', backgroundColor: '#39FF14', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000', fontSize: '14px' }}
            >
              SCAN CURRENT TAB
            </button>
          </div>
        )}

        {status === AppStatus.SCANNING && (
          <div style={{ textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ color: '#39FF14', fontSize: '12px', fontWeight: 'bold' }}>ANALYZING ARTIFACTS...</p>
          </div>
        )}

        {status === AppStatus.COMPLETED && result && (
          <div className="fade-in-container">
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', textAlign: 'center', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', lineHeight: '1' }}>{result.deepfake_score}%</div>
              <div style={{ color: '#39FF14', fontSize: '12px', fontWeight: 'bold', marginTop: '8px' }}>{result.verdict.toUpperCase()}</div>
            </div>
            
            <div style={{ fontSize: '10px', opacity: 0.8, backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px' }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ color: '#39FF14' }}>INTEGRITY:</span> {result.integrity.notes}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ color: '#39FF14' }}>AI PATTERNS:</span> {result.ai_pattern.notes}
              </div>
            </div>

            <button onClick={() => setStatus(AppStatus.IDLE)} style={{ width: '100%', background: 'none', border: '1px solid #39FF14', color: '#39FF14', padding: '10px', marginTop: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>NEW SCAN</button>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div style={{ textAlign: 'center', color: '#ff4444' }}>
            <p style={{ fontSize: '11px', marginBottom: '15px' }}>{error}</p>
            <button onClick={() => setStatus(AppStatus.IDLE)} style={{ color: '#39FF14', background: 'none', border: '1px solid #39FF14', padding: '8px 20px', cursor: 'pointer', fontSize: '10px' }}>Retry Protocol</button>
          </div>
        )}
      </main>

      <footer style={{ padding: '12px', fontSize: '8px', opacity: 0.3, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', letterSpacing: '2px' }}>
        ESTABLISHED SECURE FORENSIC CHANNEL
      </footer>
    </div>
  );
}

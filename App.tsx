
import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

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
            { text: "Perform forensic deepfake analysis on this image. Identify GAN noise, frequency artifacts, and consistency errors. Return result as JSON." },
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
      if (!text) throw new Error("Analysis engine returned null.");
      setResult(JSON.parse(text));
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "Forensic capture failed.");
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
          setError(res?.error || "Permission denied for screen capture.");
          setStatus(AppStatus.ERROR);
        }
      });
    } else {
      setError("Extension environment not detected.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="header">
        <h1 className="logo">fakey<span className="accent">.ai</span></h1>
        <div className="status-badge">{status}</div>
      </header>

      <main className="main-content">
        {status === AppStatus.IDLE && (
          <div className="idle-state">
            <p className="subtitle">AUTHENTICITY VERIFICATION PROTOCOL</p>
            <button onClick={startScan} className="scan-button">
              SCAN THIS SCREEN
            </button>
            <p className="disclaimer">Requires active tab permission</p>
          </div>
        )}

        {status === AppStatus.SCANNING && (
          <div className="scanning-state">
            <div className="spinner"></div>
            <p className="loading-text">DECONSTRUCTING PIXELS...</p>
          </div>
        )}

        {status === AppStatus.COMPLETED && result && (
          <div className="fade-in-container">
            <div className="score-card">
              <div className="score-value">{result.deepfake_score}%</div>
              <div className="verdict-label">{result.verdict.toUpperCase()}</div>
            </div>
            
            <div className="details-grid">
              <div className="detail-item">
                <span className="label">INTEGRITY</span>
                <p className="note">{result.integrity.notes}</p>
              </div>
              <div className="detail-item">
                <span className="label">AI PATTERNS</span>
                <p className="note">{result.ai_pattern.notes}</p>
              </div>
            </div>

            <button onClick={() => setStatus(AppStatus.IDLE)} className="reset-button">
              NEW ANALYSIS
            </button>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="error-state">
            <p className="error-msg">{error}</p>
            <button onClick={() => setStatus(AppStatus.IDLE)} className="retry-button">RETRY PROTOCOL</button>
          </div>
        )}
      </main>

      <footer className="footer">
        FORENSIC CHANNEL ENCRYPTED
      </footer>
    </div>
  );
}

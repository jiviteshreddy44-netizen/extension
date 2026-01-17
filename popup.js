import { GoogleGenAI, Type } from "@google/genai";

/**
 * fakey.ai - Core Forensic Logic
 */

const state = {
  status: 'IDLE', // IDLE, SCANNING, COMPLETED, ERROR
  result: null,
  error: null
};

function render() {
  const root = document.getElementById('root');
  if (!root) return;

  let content = '';

  if (state.status === 'IDLE') {
    content = `
      <div class="idle-state">
        <p class="subtitle">AUTHENTICITY VERIFICATION PROTOCOL</p>
        <button id="scan-btn" class="scan-button">SCAN THIS SCREEN</button>
        <p class="disclaimer">Requires active tab permission</p>
      </div>
    `;
  } else if (state.status === 'SCANNING') {
    content = `
      <div class="scanning-state">
        <div class="spinner"></div>
        <p class="loading-text">DECONSTRUCTING PIXELS...</p>
      </div>
    `;
  } else if (state.status === 'COMPLETED' && state.result) {
    content = `
      <div class="fade-in-container">
        <div class="score-card">
          <div class="score-value">${state.result.deepfake_score}%</div>
          <div class="verdict-label">${state.result.verdict.toUpperCase()}</div>
        </div>
        <div class="details-grid">
          <div class="detail-item">
            <span class="label">INTEGRITY</span>
            <p class="note">${state.result.integrity.notes}</p>
          </div>
          <div class="detail-item">
            <span class="label">AI PATTERNS</span>
            <p class="note">${state.result.ai_pattern.notes}</p>
          </div>
        </div>
        <button id="reset-btn" class="reset-button">NEW ANALYSIS</button>
      </div>
    `;
  } else if (state.status === 'ERROR') {
    content = `
      <div class="error-state">
        <p class="error-msg">${state.error}</p>
        <button id="retry-btn" class="retry-button">RETRY PROTOCOL</button>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="flex-col h-full">
      <header class="header">
        <h1 class="logo">fakey<span class="accent">.ai</span></h1>
        <div class="status-badge">${state.status}</div>
      </header>
      <main class="main-content">
        ${content}
      </main>
      <footer class="footer">FORENSIC CHANNEL ENCRYPTED</footer>
    </div>
  `;

  // Attach listeners
  const scanBtn = document.getElementById('scan-btn');
  if (scanBtn) scanBtn.onclick = startScan;

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.onclick = () => { state.status = 'IDLE'; render(); };

  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) retryBtn.onclick = () => { state.status = 'IDLE'; render(); };
}

async function startScan() {
  state.status = 'SCANNING';
  state.error = null;
  render();

  chrome.runtime.sendMessage({ action: "capture_tab" }, async (response) => {
    if (chrome.runtime.lastError || !response || !response.dataUrl) {
      state.status = 'ERROR';
      state.error = "Capture failed. Check tab permissions.";
      render();
      return;
    }

    try {
      await performAnalysis(response.dataUrl);
    } catch (err) {
      state.status = 'ERROR';
      state.error = err.message || "Forensic analysis failed.";
      render();
    }
  });
}

async function performAnalysis(dataUrl) {
  const base64Data = dataUrl.split(',')[1];
  
  // Use official SDK initialization as per developer rules
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: "Perform forensic analysis for AI generation. Return JSON." },
        { inlineData: { mimeType: "image/jpeg", data: base64Data } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          deepfake_score: { type: Type.NUMBER },
          verdict: { type: Type.STRING },
          integrity: { 
            type: Type.OBJECT, 
            properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } },
            required: ["score", "notes"]
          },
          ai_pattern: { 
            type: Type.OBJECT, 
            properties: { score: { type: Type.NUMBER }, notes: { type: Type.STRING } },
            required: ["score", "notes"]
          }
        },
        required: ["deepfake_score", "verdict", "integrity", "ai_pattern"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty forensic report.");
  
  state.result = JSON.parse(text);
  state.status = 'COMPLETED';
  render();
}

// Initial boot
document.addEventListener('DOMContentLoaded', render);
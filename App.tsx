import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StructuredLecture } from './types.ts';
import { processLectureContent, ProcessingInput } from './services/geminiService.ts';
import { BilingualText } from './components/BilingualText.tsx';
import { ThreeDConcept } from './components/ThreeDConcept.tsx';
import { LectureSectionView } from './components/LectureSectionView.tsx';
import { AIChatBot } from './components/AIChatBot.tsx';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Upload, 
  Loader2, 
  Sparkles, 
  LayoutDashboard, 
  Info,
  ChevronRight,
  Menu,
  X,
  Volume2,
  CheckCircle2,
  FileUp,
  Image as ImageIcon,
  File,
  AlertTriangle,
  ArrowRight,
  Monitor,
  Cpu,
  Zap,
  BookOpen
} from 'lucide-react';

// Audio decoding utilities
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioDataToBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lecture, setLecture] = useState<StructuredLecture | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Artificial delay to ensure all heavy Three.js/React components are loaded in browser memory
    const timer = setTimeout(() => setIsAppReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!rawInput.trim() && !selectedFile) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const input: ProcessingInput = selectedFile 
        ? { file: { data: selectedFile.data.split(',')[1], mimeType: selectedFile.type } }
        : { text: rawInput };

      const result = await processLectureContent(input);
      setLecture(result);
      if (result.sections.length > 0) {
        setActiveSectionId(result.sections[0].id);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Synthesizer failed to parse content. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [rawInput, selectedFile]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: e.target?.result as string
      });
      setRawInput(''); 
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSpeakOverview = async () => {
    if (!lecture || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lecture Overview: ${lecture.overview.en}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioDataToBuffer(decodeBase64(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
        return;
      }
    } catch (error) { console.error("TTS Error:", error); }
    setIsSpeaking(false);
  };

  if (!isAppReady) return null; // Let index.html handle initial static load

  const activeSection = lecture?.sections.find(s => s.id === activeSectionId);

  if (!lecture) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        </div>

        <div className="max-w-5xl w-full z-10 space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4">
              <Sparkles size={14} className="animate-pulse" /> Intelligence v2.0
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none animate-in fade-in zoom-in-95 duration-700">
              Lecture<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500">Lens</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed opacity-70">
              The professional environment for distilling raw knowledge into interactive interlinear insights.
            </p>
          </div>

          {/* Main Action Area */}
          <div className="glass-card rounded-[3rem] p-1 md:p-2 border-white/5 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="bg-[#0f172a]/40 rounded-[2.5rem] p-8 md:p-12 space-y-8">
              {errorMsg && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400 animate-in shake">
                  <AlertTriangle size={20} />
                  <p className="text-sm font-bold uppercase tracking-wide">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Controls */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                      <Zap size={12} className="text-indigo-500" /> Source Input
                    </label>
                    <textarea
                      className="w-full h-64 p-6 rounded-3xl bg-slate-900/50 border border-white/5 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-indigo-100 placeholder:text-slate-700 resize-none font-medium text-base"
                      placeholder="Paste your lecture transcript, notes, or research paper here..."
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Upload Section */}
                <div className="space-y-6 flex flex-col">
                  <div className="space-y-2 flex-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                      <Monitor size={12} className="text-indigo-500" /> Asset Ingestion
                    </label>
                    <div 
                      className={`h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group relative overflow-hidden ${
                        selectedFile ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 hover:border-indigo-500/30 hover:bg-white/5'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
                      
                      {!selectedFile ? (
                        <>
                          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileUp size={32} className="text-slate-500 group-hover:text-indigo-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-white font-bold text-sm tracking-wide">Drop PDF or Images</p>
                            <p className="text-slate-500 text-[10px] uppercase font-black mt-1">Multi-format support</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-4 px-6 text-center">
                          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                            {selectedFile.type.includes('image') ? <ImageIcon size={32} /> : <File size={32} />}
                          </div>
                          <div>
                            <p className="text-white font-bold truncate max-w-[200px]">{selectedFile.name}</p>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-400 text-[10px] font-black uppercase mt-2 hover:underline">Remove Asset</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleProcess}
                disabled={isProcessing || (!rawInput.trim() && !selectedFile)}
                className="group relative w-full py-6 rounded-3xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-500/40 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <div className="flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <><Loader2 className="animate-spin" size={24} /> <span className="text-lg font-black uppercase tracking-widest">Processing Intelligence...</span></>
                  ) : (
                    <><Cpu size={24} /> <span className="text-xl font-black uppercase tracking-widest">Generate Learning Studio</span> <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" /></>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
             <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-white"><Sparkles size={16} className="text-indigo-400"/> Multilingual Engine</div>
             <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-white"><LayoutDashboard size={16} className="text-indigo-400"/> 3D Logic Models</div>
             <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-white"><BookOpen size={16} className="text-indigo-400"/> Interlinear Analysis</div>
          </div>
        </div>
        <AIChatBot lecture={null} />
      </div>
    );
  }

  // --- Main Dashboard Rendering ---
  return (
    <div className="min-h-screen bg-[#030712] flex selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-white/5 transform transition-transform duration-500 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-8 flex flex-col h-full space-y-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl">
                <Sparkles size={20} />
              </div>
              <h2 className="text-xl font-black text-white tracking-tighter">STUDIO</h2>
            </div>
            <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}><X /></button>
          </div>
          
          <nav className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {lecture.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setActiveSectionId(section.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-start gap-4 p-5 rounded-3xl transition-all border ${
                  activeSectionId === section.id 
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/20' 
                  : 'bg-white/2 border-transparent text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm tracking-tight leading-tight">{section.title.en}</div>
                  <div className={`text-[10px] mt-1 arabic-subtext font-medium ${activeSectionId === section.id ? 'text-indigo-100' : 'text-slate-600'}`} dir="rtl">{section.title.ar}</div>
                </div>
              </button>
            ))}
          </nav>

          <button onClick={() => setLecture(null)} className="p-5 bg-white/2 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
            <Upload size={14}/> Reset Studio
          </button>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 md:ml-80 min-h-screen relative">
        <header className="md:hidden p-6 glass-card border-b border-white/5 flex justify-between items-center sticky top-0 z-40">
          <h2 className="font-black text-white text-lg tracking-tighter">LectureLens</h2>
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/5 rounded-2xl"><Menu size={20}/></button>
        </header>

        <div className="max-w-6xl mx-auto px-6 md:px-16 py-12 md:py-24 space-y-24">
          {/* Header Section */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/20">
              Session Live
            </div>
            <BilingualText 
              data={lecture.mainTitle} 
              as="h1" 
              className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none" 
              subClassName="text-2xl mt-6 text-slate-500"
            />
            
            <div className="relative p-10 glass-card rounded-[3rem] border border-white/5 overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Info size={14}/> Context Overview</h3>
                <button onClick={handleSpeakOverview} className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl hover:bg-indigo-600/20 disabled:opacity-30 transition-all border border-indigo-500/20">
                  {isSpeaking ? <Loader2 className="animate-spin" size={22}/> : <Volume2 size={22}/>}
                </button>
              </div>
              <BilingualText data={lecture.overview} as="p" className="text-slate-300 text-xl md:text-2xl leading-relaxed font-medium" subClassName="mt-8 text-lg text-slate-500"/>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8">
              {activeSection && <LectureSectionView section={activeSection} />}
            </div>
            
            <div className="lg:col-span-4 space-y-12">
              <div className="sticky top-24 space-y-12">
                <ThreeDConcept color={activeSectionId ? `#${activeSectionId.slice(0,6)}` : '#6366f1'} />
                
                <div className="p-8 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                  <h4 className="font-bold flex items-center gap-2 mb-4 tracking-tight"><CheckCircle2 size={20}/> Learning Assistant</h4>
                  <p className="text-indigo-100 text-sm leading-relaxed opacity-90">Your lecture has been structurally decomposed. Use the Chat v2.0 below for deeper insights or exam preparation.</p>
                </div>

                <div className="p-6 glass-card rounded-[2rem] border-white/5 text-slate-500">
                  <p className="text-[9px] font-black uppercase tracking-widest text-center">Engine Status: Optimized</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="p-16 border-t border-white/5 text-center space-y-4 opacity-30">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">LectureLens Studio &bull; Precision Synthesizer</p>
        </footer>
      </main>
      <AIChatBot lecture={lecture} />
    </div>
  );
};

export default App;
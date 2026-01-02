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
  Cpu,
  Zap,
  BookOpen,
  Terminal,
  MousePointer2
} from 'lucide-react';

// Audio decoding utilities for TTS functionality
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

  // Mount sequence to ensure all modules are loaded
  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 1200);
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
      setErrorMsg(error.message || "Synthesis engine encountered a structural error.");
    } finally {
      setIsProcessing(false);
    }
  }, [rawInput, selectedFile]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSelectedFile({
          name: file.name,
          type: file.type,
          data: ev.target?.result as string
        });
        setRawInput(''); 
        setErrorMsg(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSpeakOverview = async () => {
    if (!lecture || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Executive Summary: ${lecture.overview.en}` }] }],
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

  if (!isAppReady) return null;

  const activeSection = lecture?.sections.find(s => s.id === activeSectionId);

  // --- Landing UI (Obsidian Studio Console) ---
  if (!lecture) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-indigo-500/30">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/5 rounded-full blur-[160px] animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-violet-600/5 rounded-full blur-[160px] animate-pulse"></div>
        </div>

        <div className="max-w-4xl w-full z-10 space-y-16 stagger-in">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-panel border-white/5 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] shadow-xl">
              <Terminal size={12} /> System Status: Operational
            </div>
            <h1 className="text-8xl md:text-[10rem] font-black text-white tracking-tighter leading-none">
              Lecture<span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-indigo-800">Lens</span>
            </h1>
            <p className="text-slate-500 text-xl font-medium max-w-xl mx-auto leading-relaxed">
              Distill raw knowledge into professional interlinear insights using the Gemini 3 Pro reasoning engine.
            </p>
          </div>

          <div className="glass-panel rounded-[4rem] p-2 border-white/5 shadow-2xl relative">
            <div className="bg-[#0f172a]/20 rounded-[3.8rem] p-10 md:p-14 space-y-12">
              {errorMsg && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400">
                  <AlertTriangle size={24} />
                  <p className="text-sm font-black uppercase tracking-widest">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={12} className="text-indigo-400" /> Source Data
                    </label>
                  </div>
                  <textarea
                    className="w-full h-72 p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 focus:border-indigo-500/30 transition-all outline-none text-indigo-100 placeholder:text-slate-700 resize-none font-medium text-base shadow-inner"
                    placeholder="Paste lecture transcript or unstructured notes..."
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                  />
                </div>

                <div className="space-y-4 flex flex-col">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                    <FileUp size={12} className="text-indigo-400" /> Asset Ingestion
                  </label>
                  <div 
                    className={`flex-1 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-6 transition-all cursor-pointer group relative ${
                      selectedFile ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:border-indigo-500/20 hover:bg-white/5'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
                    {!selectedFile ? (
                      <>
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                          <MousePointer2 size={32} className="text-slate-600 group-hover:text-indigo-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-black text-xs uppercase tracking-[0.2em]">Import Asset</p>
                          <p className="text-slate-600 text-[9px] uppercase font-bold mt-2">Supports PDF / IMG / TXT</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-6 px-10 text-center animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-600/20">
                          {selectedFile.type.includes('image') ? <ImageIcon size={36} /> : <File size={36} />}
                        </div>
                        <div className="max-w-full">
                          <p className="text-white font-bold text-base truncate">{selectedFile.name}</p>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-500 text-[10px] font-black uppercase mt-3 hover:underline tracking-widest">Discard File</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleProcess}
                disabled={isProcessing || (!rawInput.trim() && !selectedFile)}
                className="group w-full py-8 rounded-[2.5rem] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-5 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                {isProcessing ? (
                  <><Loader2 className="animate-spin" size={28} /> <span className="text-xl font-black uppercase tracking-[0.3em]">Synthesizing Environment...</span></>
                ) : (
                  <><Cpu size={28} /> <span className="text-2xl font-black uppercase tracking-[0.3em]">Launch Studio</span> <ArrowRight size={24} className="group-hover:translate-x-3 transition-transform" /></>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-center gap-16 opacity-30">
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-white"><Sparkles size={16} className="text-indigo-400"/> Multilingual</div>
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-white"><BookOpen size={16} className="text-indigo-400"/> Interlinear</div>
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-white"><LayoutDashboard size={16} className="text-indigo-400"/> Professional</div>
          </div>
        </div>
        <AIChatBot lecture={null} />
      </div>
    );
  }

  // --- Main Workspace Dashboard ---
  return (
    <div className="min-h-screen bg-[#020617] flex selection:bg-indigo-500/30 overflow-x-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#070b14] border-r border-white/5 transform transition-transform duration-700 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-3xl' : '-translate-x-full'}`}>
        <div className="p-12 flex flex-col h-full space-y-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter">STUDIO</h2>
            </div>
            <button className="md:hidden text-slate-500" onClick={() => setIsSidebarOpen(false)}><X /></button>
          </div>
          
          <nav className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] px-2 mb-8">Navigation Tree</p>
            {lecture.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setActiveSectionId(section.id); setIsSidebarOpen(false); }}
                className={`w-full flex flex-col items-start gap-2 p-6 rounded-[2rem] transition-all border ${
                  activeSectionId === section.id 
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-2xl shadow-indigo-950/50' 
                  : 'bg-white/2 border-transparent text-slate-500 hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-sm tracking-tight">{section.title.en}</div>
                <div className={`text-[10px] arabic-subtext font-black ${activeSectionId === section.id ? 'text-indigo-200' : 'text-slate-700'}`} dir="rtl">{section.title.ar}</div>
              </button>
            ))}
          </nav>

          <button onClick={() => setLecture(null)} className="p-6 bg-white/2 border border-white/5 text-slate-600 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all flex items-center justify-center gap-3">
            <Upload size={16}/> New Analysis
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-80 min-h-screen relative flex flex-col">
        <header className="md:hidden p-8 glass-panel border-b border-white/5 flex justify-between items-center sticky top-0 z-40">
          <h2 className="font-black text-white text-xl tracking-tighter">STUDIO</h2>
          <button onClick={() => setIsSidebarOpen(true)} className="p-4 bg-white/5 rounded-2xl"><Menu size={24}/></button>
        </header>

        <div className="max-w-6xl mx-auto px-10 md:px-24 py-20 md:py-40 space-y-40 flex-1">
          <div className="space-y-12 stagger-in">
            <div className="inline-flex items-center gap-3 bg-indigo-500/10 text-indigo-400 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.4em] border border-indigo-500/20 shadow-lg">
              Session Live: 02.40.11
            </div>
            <BilingualText 
              data={lecture.mainTitle} 
              as="h1" 
              className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none" 
              subClassName="text-3xl mt-10 text-slate-600"
            />
            
            <div className="relative p-14 glass-panel rounded-[4.5rem] border border-white/5 group">
              <div className="absolute top-0 left-0 w-2.5 h-full bg-indigo-600/30 rounded-l-[4.5rem]" />
              <div className="flex items-center justify-between mb-12">
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.5em] flex items-center gap-3"><Info size={16}/> Executive Matrix</h3>
                <button onClick={handleSpeakOverview} className="p-5 bg-indigo-600/10 text-indigo-400 rounded-3xl hover:bg-indigo-600/20 disabled:opacity-30 transition-all border border-indigo-500/10">
                  {isSpeaking ? <Loader2 className="animate-spin" size={28}/> : <Volume2 size={28}/>}
                </button>
              </div>
              <BilingualText data={lecture.overview} as="p" className="text-slate-300 text-3xl md:text-4xl leading-relaxed font-medium" subClassName="mt-14 text-2xl text-slate-600"/>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-24">
            <div className="lg:col-span-8">
              {activeSection && <LectureSectionView section={activeSection} />}
            </div>
            
            <div className="lg:col-span-4">
              <div className="sticky top-40 space-y-20">
                <ThreeDConcept color={activeSectionId ? `#${activeSectionId.slice(0,6)}` : '#6366f1'} />
                
                <div className="p-12 bg-gradient-to-br from-indigo-700 to-indigo-950 rounded-[4rem] shadow-3xl text-white relative overflow-hidden group border border-white/5">
                  <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-[80px] group-hover:scale-150 transition-transform duration-[2000ms]"></div>
                  <h4 className="font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 mb-8"><CheckCircle2 size={22}/> Analysis Logic</h4>
                  <p className="text-indigo-100 text-base leading-relaxed font-medium opacity-90">Interlinear mapping is synchronized. Sentence fragments are decomposed for optimized cross-lingual focus.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="p-24 border-t border-white/5 text-center opacity-10">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.6em]">LectureLens Studio &bull; Precision Intelligence Engine</p>
        </footer>
      </main>
      <AIChatBot lecture={lecture} />
    </div>
  );
};

export default App;
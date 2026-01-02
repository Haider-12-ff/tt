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
  BookOpen,
  Settings2,
  History
} from 'lucide-react';

// Decoding utilities for TTS
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

  // Critical fix: Ensure JS mounting is signaled to replace static loading screen
  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 800);
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
      setErrorMsg(error.message || "Synthesizer encountered a parsing conflict.");
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
        contents: [{ parts: [{ text: `Executive Overview: ${lecture.overview.en}` }] }],
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

  // --- Landing / Landing UI ---
  if (!lecture) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 rounded-full blur-[140px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-600/5 rounded-full blur-[140px] animate-pulse-slow"></div>
        </div>

        <div className="max-w-4xl w-full z-10 space-y-16 stagger-in">
          {/* Brand Header */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-white/5 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">
              <Sparkles size={12} className="animate-pulse" /> Precision Learning Studio
            </div>
            <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none">
              Lecture<span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 to-indigo-600">Lens</span>
            </h1>
            <p className="text-slate-500 text-lg md:text-xl font-medium max-w-xl mx-auto leading-relaxed">
              Synthesize raw notes into a high-fidelity interlinear environment.
            </p>
          </div>

          {/* Upload/Input Console */}
          <div className="glass-card rounded-[3.5rem] p-2 border-white/5 shadow-3xl">
            <div className="bg-[#0f172a]/20 rounded-[3rem] p-8 md:p-12 space-y-10">
              {errorMsg && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400">
                  <AlertTriangle size={20} />
                  <p className="text-xs font-black uppercase tracking-widest">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                    <Zap size={12} className="text-indigo-400" /> Text Transcript
                  </label>
                  <textarea
                    className="w-full h-64 p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 focus:border-indigo-500/30 transition-all outline-none text-indigo-100 placeholder:text-slate-700 resize-none font-medium text-sm"
                    placeholder="Paste lecture content here..."
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                  />
                </div>

                <div className="space-y-4 flex flex-col">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                    <Monitor size={12} className="text-indigo-400" /> Document Ingestion
                  </label>
                  <div 
                    className={`flex-1 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group relative ${
                      selectedFile ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:border-indigo-500/20 hover:bg-white/5'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
                    {!selectedFile ? (
                      <>
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center">
                          <FileUp size={28} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-xs uppercase tracking-widest">Select Asset</p>
                          <p className="text-slate-600 text-[9px] uppercase font-black mt-1">PDF / IMAGE / TXT</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 px-6 text-center">
                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                          {selectedFile.type.includes('image') ? <ImageIcon size={32} /> : <File size={32} />}
                        </div>
                        <div className="max-w-full">
                          <p className="text-white font-bold text-sm truncate">{selectedFile.name}</p>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-500 text-[9px] font-black uppercase mt-2 hover:underline">Discard</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleProcess}
                disabled={isProcessing || (!rawInput.trim() && !selectedFile)}
                className="group w-full py-7 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-4"
              >
                {isProcessing ? (
                  <><Loader2 className="animate-spin" size={24} /> <span className="text-lg font-black uppercase tracking-[0.2em]">Processing...</span></>
                ) : (
                  <><Cpu size={24} /> <span className="text-xl font-black uppercase tracking-[0.2em]">Launch Environment</span> <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" /></>
                )}
              </button>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="flex justify-center gap-12 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white"><Zap size={14} className="text-indigo-400"/> Real-time Synthesizer</div>
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white"><Settings2 size={14} className="text-indigo-400"/> Adaptive Logic</div>
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white"><History size={14} className="text-indigo-400"/> Session Persist</div>
          </div>
        </div>
        <AIChatBot lecture={null} />
      </div>
    );
  }

  // --- Studio Workspace UI ---
  return (
    <div className="min-h-screen bg-[#030712] flex selection:bg-indigo-500/40 overflow-x-hidden">
      {/* Workspace Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#070b14] border-r border-white/5 transform transition-transform duration-500 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-3xl' : '-translate-x-full'}`}>
        <div className="p-10 flex flex-col h-full space-y-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                <Sparkles size={20} />
              </div>
              <h2 className="text-xl font-black text-white tracking-tighter">STUDIO</h2>
            </div>
            <button className="md:hidden text-slate-500" onClick={() => setIsSidebarOpen(false)}><X /></button>
          </div>
          
          <nav className="flex-1 space-y-4 overflow-y-auto pr-2">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 mb-6">Course Modules</p>
            {lecture.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setActiveSectionId(section.id); setIsSidebarOpen(false); }}
                className={`w-full flex flex-col items-start gap-1 p-5 rounded-3xl transition-all border ${
                  activeSectionId === section.id 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-900/40' 
                  : 'bg-white/2 border-transparent text-slate-500 hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-xs tracking-tight">{section.title.en}</div>
                <div className={`text-[9px] arabic-subtext font-bold ${activeSectionId === section.id ? 'text-indigo-200' : 'text-slate-700'}`} dir="rtl">{section.title.ar}</div>
              </button>
            ))}
          </nav>

          <button onClick={() => setLecture(null)} className="p-5 bg-white/2 border border-white/5 text-slate-600 hover:text-white hover:bg-white/5 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
            <Upload size={14}/> Reset Workspace
          </button>
        </div>
      </aside>

      {/* Main Studio Viewport */}
      <main className="flex-1 md:ml-80 min-h-screen relative flex flex-col">
        <header className="md:hidden p-6 glass-card border-b border-white/5 flex justify-between items-center sticky top-0 z-40">
          <h2 className="font-black text-white tracking-tighter">STUDIO</h2>
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/5 rounded-2xl"><Menu size={20}/></button>
        </header>

        <div className="max-w-6xl mx-auto px-8 md:px-20 py-16 md:py-32 space-y-32 flex-1">
          {/* Section Header */}
          <div className="space-y-10 stagger-in">
            <div className="inline-flex items-center gap-3 bg-indigo-500/10 text-indigo-400 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              Analysis Active
            </div>
            <BilingualText 
              data={lecture.mainTitle} 
              as="h1" 
              className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none" 
              subClassName="text-2xl mt-8 text-slate-600"
            />
            
            <div className="relative p-12 glass-card rounded-[3.5rem] border border-white/5 group">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600/40" />
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] flex items-center gap-2"><Info size={14}/> Executive Summary</h3>
                <button onClick={handleSpeakOverview} className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl hover:bg-indigo-600/20 disabled:opacity-30 transition-all border border-indigo-500/10">
                  {isSpeaking ? <Loader2 className="animate-spin" size={24}/> : <Volume2 size={24}/>}
                </button>
              </div>
              <BilingualText data={lecture.overview} as="p" className="text-slate-300 text-2xl md:text-3xl leading-relaxed font-medium" subClassName="mt-10 text-xl text-slate-600"/>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            <div className="lg:col-span-8">
              {activeSection && <LectureSectionView section={activeSection} />}
            </div>
            
            <div className="lg:col-span-4">
              <div className="sticky top-32 space-y-16">
                <ThreeDConcept color={activeSectionId ? `#${activeSectionId.slice(0,6)}` : '#6366f1'} />
                
                <div className="p-10 bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[3rem] shadow-3xl text-white relative overflow-hidden group">
                  <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                  <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-3 mb-6"><CheckCircle2 size={18}/> Learning Logic</h4>
                  <p className="text-indigo-100 text-sm leading-relaxed font-medium opacity-90">Deep interlinear analysis is active. Complex concepts are color-coded for visual indexing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="p-20 border-t border-white/5 text-center opacity-20">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.5em]">LectureLens Intelligence &bull; Studio Version 2.0</p>
        </footer>
      </main>
      <AIChatBot lecture={lecture} />
    </div>
  );
};

export default App;
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
  FileText
} from 'lucide-react';

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
  const [isDragging, setIsDragging] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setErrorMsg(error.message || "An error occurred. Please try again.");
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
      // Fix: Direct use of process.env.API_KEY in GoogleGenAI initialization
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Please read this overview clearly: ${lecture.overview.en}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      // Fix: inlineData is used to extract the PCM audio data
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
    } catch (error) { 
      console.error("TTS Error:", error); 
    }
    setIsSpeaking(false);
  };

  const activeSection = lecture?.sections.find(s => s.id === activeSectionId);

  if (!lecture) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 overflow-x-hidden">
        <div className="max-w-4xl w-full space-y-10 bg-white/5 backdrop-blur-xl p-8 md:p-16 rounded-[3rem] shadow-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="text-center space-y-6 relative">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-500/20 mb-4 animate-bounce">
              <Sparkles size={48} />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
              Lecture<span className="text-indigo-500">Lens</span>
            </h1>
            <p className="text-slate-400 text-xl max-w-xl mx-auto font-medium">
              Transform your notes into an interactive bilingual experience.
            </p>
          </div>

          <div className="space-y-6 relative">
            {errorMsg && (
              <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-[2rem] flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="text-red-500 shrink-0 mt-1" size={24} />
                <div className="space-y-1">
                  <p className="text-red-200 font-bold">System Alert</p>
                  <p className="text-red-300/80 text-sm leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {!selectedFile ? (
              <div className="space-y-4">
                <textarea
                  className="w-full h-64 p-8 rounded-[2rem] border-2 border-white/5 bg-white/5 focus:bg-white/10 focus:border-indigo-500/50 transition-all outline-none text-indigo-100 placeholder:text-slate-600 resize-none font-medium text-lg"
                  placeholder="Paste lecture notes here..."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
                <div className="p-8 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-indigo-500/40 hover:bg-white/5 transition-all cursor-pointer group"
                     onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" />
                  <FileUp size={40} className="text-slate-500 group-hover:text-indigo-500 transition-colors" />
                  <p className="text-slate-400 font-bold group-hover:text-white transition-colors text-sm uppercase tracking-widest">Upload PDF / TXT / IMG</p>
                </div>
              </div>
            ) : (
              <div className="w-full p-12 rounded-[2rem] border-2 border-indigo-500/50 bg-indigo-500/5 flex flex-col items-center justify-center gap-6 animate-in zoom-in-95">
                <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-xl">
                  {selectedFile.type.includes('image') ? <ImageIcon size={48} /> : <File size={48} />}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white">{selectedFile.name}</h3>
                  <button onClick={() => setSelectedFile(null)} className="text-indigo-400 text-xs mt-2 font-bold uppercase tracking-widest hover:text-indigo-300 underline">Change File</button>
                </div>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={isProcessing || (!rawInput.trim() && !selectedFile)}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-500/40 active:scale-[0.98]"
            >
              {isProcessing ? <><Loader2 className="animate-spin" size={32} /> Synthesizing...</> : <><Upload size={28} /> Start Learning</>}
            </button>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-wrap justify-center gap-8 opacity-40">
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white"><Sparkles size={14}/> Bilingual</div>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white"><LayoutDashboard size={14}/> 3D Mnemonic</div>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white"><Info size={14}/> Exam Focus</div>
          </div>
        </div>
        <AIChatBot lecture={null} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex selection:bg-indigo-100 overflow-x-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 transform transition-transform duration-500 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Sparkles size={20} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">LectureLens</h2>
            </div>
            <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}><X /></button>
          </div>
          
          <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            {lecture.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setActiveSectionId(section.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-start gap-4 p-5 rounded-3xl transition-all ${
                  activeSectionId === section.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ChevronRight size={16} className={`mt-1 ${activeSectionId === section.id ? 'rotate-90' : ''}`} />
                <div className="text-left">
                  <div className="font-bold text-sm">{section.title.en}</div>
                  <div className={`text-[10px] arabic-subtext ${activeSectionId === section.id ? 'text-indigo-100' : 'text-slate-400'}`} dir="rtl">{section.title.ar}</div>
                </div>
              </button>
            ))}
          </nav>

          <button onClick={() => setLecture(null)} className="mt-8 p-5 text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
            <Upload size={14}/> New Lecture
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-80 min-h-screen">
        <header className="md:hidden p-6 bg-white border-b flex justify-between items-center sticky top-0 z-40">
          <h2 className="font-black text-indigo-600">LectureLens</h2>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-100 rounded-xl"><Menu size={20}/></button>
        </header>

        <div className="max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-24 space-y-20">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Synthesized by AI
            </div>
            <BilingualText 
              data={lecture.mainTitle} 
              as="h1" 
              className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter leading-none" 
              subClassName="text-2xl mt-4"
            />
            
            <div className="relative p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm group hover:shadow-xl transition-all">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 rounded-l-[3rem]" />
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> Executive Overview</h3>
                <button onClick={handleSpeakOverview} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 disabled:opacity-30 transition-all">
                  {isSpeaking ? <Loader2 className="animate-spin" size={20}/> : <Volume2 size={20}/>}
                </button>
              </div>
              <BilingualText data={lecture.overview} as="p" className="text-slate-700 text-xl md:text-2xl leading-relaxed font-medium" subClassName="mt-6 text-lg"/>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              {activeSection && <LectureSectionView section={activeSection} />}
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div className="sticky top-24 space-y-8">
                <ThreeDConcept color={activeSectionId ? `#${activeSectionId.slice(0,6)}` : '#6366f1'} />
                <div className="p-8 bg-indigo-600 rounded-[2.5rem] shadow-xl text-white">
                  <h4 className="font-bold flex items-center gap-2 mb-3"><CheckCircle2 size={18}/> Learning Hub</h4>
                  <p className="text-indigo-100 text-sm leading-relaxed">Focus on the highlighted terms. Hover to see structural breakdowns of sentences.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="p-12 border-t text-center space-y-4">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">LectureLens Studio &bull; Precision Learning Environment</p>
        </footer>
      </main>
      <AIChatBot lecture={lecture} />
    </div>
  );
};

export default App;
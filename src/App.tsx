/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Music, 
  Brain, 
  Download, 
  Sparkles, 
  RotateCcw, 
  Cpu, 
  Play, 
  LineChart, 
  Wand2, 
  FileCheck,
  AlertCircle,
  BookOpen,
  Pause
} from "lucide-react";
import { PREDEFINED_SONGS } from "./data/songs";
import PianoRoll from "./components/PianoRoll";
import { MusicRNN, MusicMarkovChain, serializeNote } from "./models/MusicRNN";
import { NoteEvent, GenerationAlgorithm, ModelHyperparameters, TrainingProgress, ComposerAnalysis } from "./types";
import { downloadMidiFile } from "./utils/midi";

export default function App() {
  // -----------------------------------------
  // CORE COMPONENT STATES
  // -----------------------------------------
  const [selectedSongId, setSelectedSongId] = useState<string>("bach-minuet");
  const [activeNotes, setActiveNotes] = useState<NoteEvent[]>([]);
  const [customNotes, setCustomNotes] = useState<NoteEvent[]>([
    { pitch: 60, duration: 4, name: "C4" },
    { pitch: 64, duration: 4, name: "E4" },
    { pitch: 67, duration: 4, name: "G4" },
    { pitch: 72, duration: 8, name: "C5" },
    { pitch: 0, duration: 4, name: "Rest" },
    { pitch: 67, duration: 4, name: "G4" },
    { pitch: 72, duration: 4, name: "C5" }
  ]);

  const [activeAlgorithm, setActiveAlgorithm] = useState<GenerationAlgorithm>("rnn");
  const [hyperparams, setHyperparams] = useState<ModelHyperparameters>({
    rnn: {
      hiddenSize: 24,
      learningRate: 0.08,
      sequenceLength: 6,
      epochs: 40,
    },
    markov: {
      order: 2,
    },
  });

  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    epoch: 0,
    totalEpochs: 0,
    loss: 0,
    accuracy: 0,
    history: [],
    isTraining: false,
  });

  // Model references
  const [trainedRNN, setTrainedRNN] = useState<MusicRNN | null>(null);
  const [learnedMarkov, setLearnedMarkov] = useState<MusicMarkovChain | null>(null);

  // Intelligent Composition AI states
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingMelody, setIsGeneratingMelody] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComposerAnalysis | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"playground" | "theory">("playground");

  // Temperature configuration for generator sampler
  const [temperature, setTemperature] = useState(1.0);
  const [generateLength, setGenerateLength] = useState(16);

  // -----------------------------------------
  // CORPUS WORKFLOW SELECTION
  // -----------------------------------------
  const currentCorpus = PREDEFINED_SONGS.find((s) => s.id === selectedSongId) ?? {
    id: "custom",
    title: "User Composed Melody",
    genre: "custom",
    description: "Your custom piano roll creation, perfect for local fine-tuning experiments.",
    notes: customNotes,
  };

  useEffect(() => {
    if (selectedSongId === "custom") {
      setActiveNotes(customNotes);
    } else {
      const song = PREDEFINED_SONGS.find((s) => s.id === selectedSongId);
      if (song) {
        setActiveNotes([...song.notes]);
      }
    }
    // Reset trained models when switching song layouts
    setTrainedRNN(null);
    setLearnedMarkov(null);
    setTrainingProgress({
      epoch: 0,
      totalEpochs: 0,
      loss: 0,
      accuracy: 0,
      history: [],
      isTraining: false,
    });
  }, [selectedSongId, customNotes]);

  const handleCustomNotesChange = (updatedNotes: NoteEvent[]) => {
    setCustomNotes(updatedNotes);
    if (selectedSongId === "custom") {
      setActiveNotes(updatedNotes);
    }
  };

  // -----------------------------------------
  // MUSIC PREPROCESSING ANALYZER
  // -----------------------------------------
  // Extracts token vocab map from active song representation
  const activeTokens = activeNotes.map(serializeNote);
  const uniqueTokensList = Array.from(new Set(activeTokens));

  const slidingWindows: Array<{ inputs: string[]; target: string }> = [];
  const seqLength = hyperparams.rnn.sequenceLength;
  for (let i = 0; i <= activeTokens.length - seqLength - 1; i++) {
    slidingWindows.push({
      inputs: activeTokens.slice(i, i + seqLength),
      target: activeTokens[i + seqLength],
    });
  }

  // -----------------------------------------
  // TRAINING CONTROLLERS (RNN & MARKOV)
  // -----------------------------------------
  const handleTrainModel = () => {
    setApiError(null);
    if (activeAlgorithm === "rnn") {
      runRnnTraining();
    } else {
      runMarkovLearning();
    }
  };

  const runMarkovLearning = () => {
    const chain = new MusicMarkovChain(hyperparams.markov.order);
    chain.learn(activeNotes);
    setLearnedMarkov(chain);
    
    // Simulate training visual completion
    setTrainingProgress({
      epoch: 1,
      totalEpochs: 1,
      loss: 0.12,
      accuracy: 1.0,
      history: [{ epoch: 1, loss: 0.12, accuracy: 1.0 }],
      isTraining: false,
    });
  };

  const runRnnTraining = () => {
    const rnn = new MusicRNN(hyperparams.rnn.hiddenSize, hyperparams.rnn.learningRate);
    rnn.initializeVocabularyAndWeights(activeNotes);

    const [X, y] = rnn.prepareTrainingData(activeNotes, seqLength);
    if (X.length === 0) {
      setApiError(`Melody dataset is too short for sliding window length ${seqLength}. Add more notes or decrease window size.`);
      return;
    }

    setTrainingProgress({
      epoch: 0,
      totalEpochs: hyperparams.rnn.epochs,
      loss: 2.5,
      accuracy: 0.05,
      history: [],
      isTraining: true,
    });

    let currentEpoch = 0;
    const maxEpochs = hyperparams.rnn.epochs;
    const historyData: Array<{ epoch: number; loss: number; accuracy: number }> = [];

    const trainStepInterval = setInterval(() => {
      currentEpoch++;
      
      const stats = rnn.trainEpoch(X, y);
      historyData.push({
        epoch: currentEpoch,
        loss: stats.loss,
        accuracy: stats.accuracy,
      });

      setTrainingProgress({
        epoch: currentEpoch,
        totalEpochs: maxEpochs,
        loss: stats.loss,
        accuracy: stats.accuracy,
        history: [...historyData],
        isTraining: currentEpoch < maxEpochs,
      });

      if (currentEpoch >= maxEpochs) {
        clearInterval(trainStepInterval);
        setTrainedRNN(rnn);
      }
    }, 45); // quick updates for high-response UI feel
  };

  const handleGenerateMelody = () => {
    setApiError(null);
    
    // Check seed notes
    const seedSize = activeAlgorithm === "rnn" ? seqLength : hyperparams.markov.order;
    const seed = activeNotes.slice(0, seedSize);

    if (seed.length === 0) {
      setApiError("Active song dataset is empty. Cannot extract seed note patterns.");
      return;
    }

    if (activeAlgorithm === "rnn") {
      if (!trainedRNN) {
        setApiError("Please train your Recurrent Neural Network (RNN) model first before generating continuation streams.");
        return;
      }
      const generated = trainedRNN.generate(seed, seqLength, generateLength, temperature);
      setActiveNotes(generated);
    } else {
      const model = learnedMarkov || (() => {
        const tempChain = new MusicMarkovChain(hyperparams.markov.order);
        tempChain.learn(activeNotes);
        setLearnedMarkov(tempChain);
        return tempChain;
      })();
      const generated = model.generate(seed, generateLength, temperature);
      setActiveNotes(generated);
    }
  };

  const handleResetTrack = () => {
    setApiError(null);
    setAnalysisResult(null);
    if (selectedSongId === "custom") {
      setActiveNotes(customNotes);
    } else {
      const song = PREDEFINED_SONGS.find((s) => s.id === selectedSongId);
      if (song) {
        setActiveNotes([...song.notes]);
      }
    }
  };

  // -----------------------------------------
  // INTELLIGENT COMPOSITION SERVER-SIDE Flow
  // -----------------------------------------
  const handleGenerateMelodyWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsGeneratingMelody(true);
    setAiStatus("Prompting composition AI model on server...");
    setApiError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/ai/generate-melody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          keySignature: "C Major",
          length: generateLength
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to generate melody from standard backend script.");
      }

      const generatedEvents: NoteEvent[] = data.melody.map((note: any) => ({
        pitch: typeof note.pitch === "number" ? note.pitch : 60,
        duration: typeof note.duration === "number" ? note.duration : 4,
        name: note.name || "C4"
      }));

      // Map this new song layout as a loaded track
      setCustomNotes(generatedEvents);
      setSelectedSongId("custom");
      setActiveNotes(generatedEvents);
      setAiPrompt("");
      setAiStatus(null);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "An unexpected error occurred during melody generation.");
      setAiStatus(null);
    } finally {
      setIsGeneratingMelody(false);
    }
  };

  const handleAnalyzeMelodyWithAI = async () => {
    if (activeNotes.length === 0) return;

    setIsAnalyzing(true);
    setApiError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: activeNotes })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to acquire musicology evaluation.");
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to complete musicology evaluations.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // -----------------------------------------
  // RENDER DYNAMIC SVG LINE CHARTS
  // -----------------------------------------
  const renderTrainingChart = () => {
    const history = trainingProgress.history;
    if (history.length === 0) {
      return (
        <div className="h-44 border border-dashed border-white/10 flex flex-col items-center justify-center p-4 text-white/30 bg-white/5 text-center">
          <LineChart className="w-8 h-8 mb-2 opacity-40 animate-pulse text-[#CCFF00]" />
          <p className="text-xs font-mono uppercase tracking-wider">Loss & Accuracy Curves are mapped post-training</p>
        </div>
      );
    }

    const width = 360;
    const height = 150;
    const padding = 20;

    const maxLoss = Math.max(...history.map((h) => h.loss), 1.0);
    const minLoss = 0;

    const pointsLoss = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - ((h.loss - minLoss) / (maxLoss - minLoss)) * (height - padding * 2);
      return `${x},${y}`;
    }).join(" ");

    const pointsAcc = history.map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - (h.accuracy * (height - padding * 2));
      return `${x},${y}`;
    }).join(" ");

    return (
      <div id="ai-training-canvas-chart" className="bg-white/5 border border-white/10 p-3">
        <div className="flex justify-between items-center text-3xs font-mono text-white/50 mb-2 uppercase">
          <span className="text-[#FF3355]">● LOSS CURVE</span>
          <span className="text-[#CCFF00]">▲ ACCURACY SCORE</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="white" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="2,2" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="white" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="2,2" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="white" strokeOpacity="0.15" strokeWidth="1" />

          {/* Loss Line Path */}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#FF3355"
              strokeWidth="2.5"
              points={pointsLoss}
            />
          )}

          {/* Accuracy Line Path */}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#CCFF00"
              strokeWidth="2.5"
              points={pointsAcc}
              strokeDasharray="2,1"
            />
          )}

          {/* Bullet points on actual markers */}
          {history.length === 1 && (
            <>
              <circle cx={width / 2} cy={height / 2} r="4" fill="#FF3355" />
              <circle cx={width / 2} cy={height - padding - 10} r="4" fill="#CCFF00" />
            </>
          )}
        </svg>

        <div className="flex justify-between items-center text-3xs font-mono text-white/30 mt-2">
          <span>Ep 1</span>
          <span>Ep {trainingProgress.epoch}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans antialiased selection:bg-[#CCFF00] selection:text-black">
      
      {/* 1. BRAND HEADER */}
      <header className="border-b border-white/10 py-8 px-6 sm:px-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-[#030303]">
        <div className="flex flex-col">
          <span className="text-[#CCFF00] font-mono text-xs tracking-[0.3em] mb-2 font-bold uppercase">V.2.1.0 / NEURAL MIDI ENGINE</span>
          <h1 className="text-4xl sm:text-6xl lg:text-[72px] leading-[0.85] font-black tracking-tighter uppercase font-display select-none">
            Algorithmic<br/>
            <span className="text-transparent" style={{ WebkitTextStroke: "1px white" }}>Symphony</span>
          </h1>
          <p className="text-3xs font-mono text-white/40 uppercase tracking-[0.2em] mt-3">
            Deep Learning MIDI Composer & Preprocessing Visualizer
          </p>
        </div>

        {/* Global Toolbar and Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 shrink-0 lg:mb-1">
          <div className="flex bg-white/5 p-1 border border-white/10">
            <button
              onClick={() => setActiveTab("playground")}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider font-display transition duration-155 cursor-pointer ${
                activeTab === "playground" ? "bg-[#CCFF00] text-black" : "text-white/60 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Interactive Workbench</span>
            </button>
            <button
              onClick={() => setActiveTab("theory")}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider font-display transition duration-155 cursor-pointer ${
                activeTab === "theory" ? "bg-[#CCFF00] text-black" : "text-white/60 hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>AI Learning Manual</span>
            </button>
          </div>
          <div className="flex gap-6 font-mono items-center">
            <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse"></div>
            <div className="text-left">
              <div className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Training Uptime</div>
              <div className="text-2xl font-bold leading-none tracking-tighter text-[#CCFF00] mt-1">00:42:15</div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. ERROR OVERLAYS */}
      {apiError && (
        <div className="mx-6 sm:mx-12 mt-6 p-4 bg-red-955/20 border border-red-500/40 text-red-100 text-xs flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-mono text-[#CCFF00] font-black uppercase tracking-widest block mb-1">Execution Failure:</span>
            <p className="font-mono leading-relaxed">{apiError}</p>
          </div>
          <button onClick={() => setApiError(null)} className="font-mono text-red-400 hover:text-red-200 text-base px-1">✕</button>
        </div>
      )}

      {/* 3. CORE ROUTE VIEWS */}
      <main className="px-6 sm:px-12 py-10 max-w-[1600px] mx-auto">
        
        {activeTab === "theory" ? (
          /* ==================================
             AI LEARNING MANUAL (THEORY TAB)
             ================================== */
          <div className="grid md:grid-cols-3 gap-8 animate-fade-in">
            {/* Box 1: Preprocessing */}
            <div className="border border-white/10 bg-white/3 p-8 flex flex-col justify-between">
              <div>
                <div className="text-[52px] font-black font-display text-white/10 mb-2 leading-none">01</div>
                <div className="flex items-center gap-2 text-[#CCFF00] mb-6">
                  <FileCheck className="w-5 h-5" />
                  <h3 className="font-display font-bold text-xs uppercase tracking-[0.15em]">1. Data Preprocessing</h3>
                </div>
                <p className="text-xs text-white/70 leading-relaxed mb-6 font-sans">
                  Musical records (MIDI or scores) do not fit machine learning algorithms natively. To train sequential networks, algorithms convert raw files (containing delta velocities, durations, and channels) into discrete time grid steps.
                </p>
                <h4 className="text-3xs font-mono font-bold text-[#CCFF00] uppercase tracking-wider mb-2">The Tokenizer Routine</h4>
                <ul className="text-xs space-y-2 text-white/80 bg-white/3 p-4 border border-white/5 font-mono">
                  <li>• Notes map to strings: <span className="text-[#CCFF00] font-semibold">&quot;Pitch_Duration&quot;</span></li>
                  <li>• e.g., C4 (60) quarter note (4 steps) = <span className="bg-white/10 px-1 py-0.5 text-white/90 font-bold">&quot;60_4&quot;</span></li>
                  <li>• Rests map to silence: <span className="bg-white/10 px-1 py-0.5 text-white/90 font-bold">&quot;rest_2&quot;</span></li>
                  <li>• Vocabulary maps unique strings to index ID numbers.</li>
                </ul>
              </div>
              <p className="text-3xs text-white/40 italic mt-6 font-mono leading-relaxed">
                Pre-trained networks employ exact quantizers to structure chords and intervals into multi-hot token vectors.
              </p>
            </div>

            {/* Box 2: Recurrent Neural Network */}
            <div className="border border-white/10 bg-white/3 p-8 flex flex-col justify-between">
              <div>
                <div className="text-[52px] font-black font-display text-white/10 mb-2 leading-none">02</div>
                <div className="flex items-center gap-2 text-[#CCFF00] mb-6">
                  <Brain className="w-5 h-5 animate-pulse" />
                  <h3 className="font-display font-bold text-xs uppercase tracking-[0.15em]">2. RNNs & LSTMs</h3>
                </div>
                <p className="text-xs text-white/70 leading-relaxed mb-6 font-sans">
                  Recurrent Neural Networks (RNNs) hold feedback connections designed specifically for sequential and temporal information modeling. Unlike feed-forward networks, RNNs preserve context inside hidden state registers.
                </p>
                <h4 className="text-3xs font-mono font-bold text-[#CCFF00] uppercase tracking-wider mb-2">Mathematical Framework</h4>
                <div className="bg-white/3 p-4 border border-white/5 font-mono text-3xs text-white/75 space-y-3.5">
                  <div>
                    <span className="text-[#CCFF00] font-bold">Hidden Activation:</span><br />
                    h_t = tanh(W_xh * x_t + W_hh * h_(t-1) + b_h)
                  </div>
                  <div>
                    <span className="text-[#CCFF00] font-bold">Outputs Projection:</span><br />
                    y_t = W_hy * h_t + b_y
                  </div>
                  <div>
                    <span className="text-[#CCFF00] font-bold">Loss Optimizations:</span><br />
                    Categorical Cross-Entropy backpropagated (BPTT).
                  </div>
                </div>
              </div>
              <p className="text-3xs text-white/40 italic mt-6 font-mono leading-relaxed">
                LSTMs and GRUs prevent vanishing gradients by implementing gating controls, bypassing memory locks directly.
              </p>
            </div>

            {/* Box 3: Markov Chains */}
            <div className="border border-white/10 bg-white/3 p-8 flex flex-col justify-between">
              <div>
                <div className="text-[52px] font-black font-display text-white/10 mb-2 leading-none">03</div>
                <div className="flex items-center gap-2 text-[#CCFF00] mb-6">
                  <RotateCcw className="w-5 h-5" />
                  <h3 className="font-display font-bold text-xs uppercase tracking-[0.15em]">3. N-Gram Markov Chains</h3>
                </div>
                <p className="text-xs text-white/70 leading-relaxed mb-6 font-sans">
                  A Markov Chain represents a stochastic process mapping the probability of transitioning from a state (or historical node of states) to a future state, strictly obeying the Markov Property: the future depends only on the present.
                </p>
                <h4 className="text-3xs font-mono font-bold text-[#CCFF00] uppercase tracking-wider mb-2">Transition Matrices</h4>
                <ul className="text-xs space-y-2 text-white/80 bg-white/3 p-4 border border-white/5 font-mono">
                  <li>• Order 1: Count P( Note | Previous Note )</li>
                  <li>• Order 2: Count P( Note | Note_-2, Note_-1 )</li>
                  <li>• Normalizes transition occurrences to percentages.</li>
                  <li>• Generates fast with temperature sampling.</li>
                </ul>
              </div>
              <p className="text-3xs text-white/40 italic mt-6 font-mono leading-relaxed">
                While stable, high Markov orders limit structural variation, replicating the source training corpus almost identically.
              </p>
            </div>
          </div>
        ) : (
          /* ==================================
             INTERACTIVE WORKBENCH (DEFAULT VIEW)
             ================================== */
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: DATASETS COMPOSER & PREPROCESSING */}
            <div className="lg:col-span-1 flex flex-col gap-8">
              
              {/* Box A: Corpus Selector */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 font-sans">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-[#CCFF00]" />
                    <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">01 / Training Corpus Source</h2>
                  </div>
                  {selectedSongId === "custom" && (
                    <span className="text-[9px] font-mono bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30 px-2 py-0.5 uppercase tracking-wider font-bold">
                      Composer Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/50 mb-5 leading-relaxed font-sans">
                  Select a predefined melody dataset or switch to Composer mode to draw your own classical/jazz grid notes.
                </p>

                {/* Song Buttons list */}
                <div className="flex flex-col gap-2 mb-5">
                  {PREDEFINED_SONGS.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => setSelectedSongId(song.id)}
                      className={`text-left p-4.5 transition-all duration-150 border uppercase cursor-pointer ${
                        selectedSongId === song.id
                          ? "bg-[#CCFF00] border-transparent text-black font-black"
                          : "bg-white/3 border-white/5 hover:bg-white/10 text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs tracking-wide leading-none">{song.title}</span>
                        <span className={`text-[9px] font-mono font-bold border px-1.5 py-0.5 leading-none ${
                          selectedSongId === song.id ? "border-black/30 text-black/80" : "border-white/20 text-[#CCFF00]"
                        }`}>
                          {song.genre}
                        </span>
                      </div>
                      <p className={`text-[10px] uppercase font-mono tracking-wider mt-2 truncate ${
                        selectedSongId === song.id ? "text-black/60" : "text-white/40"
                      }`}>{song.description}</p>
                    </button>
                  ))}

                  <button
                    onClick={() => setSelectedSongId("custom")}
                    className={`text-left p-4.5 transition-all duration-150 border uppercase cursor-pointer ${
                      selectedSongId === "custom"
                        ? "bg-[#CCFF00] border-transparent text-black font-black"
                        : "bg-white/3 border-white/5 hover:bg-white/10 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs tracking-wide leading-none">Custom Canvas Melody</span>
                      <span className={`text-[9px] font-mono font-bold border px-1.5 py-0.5 leading-none ${
                        selectedSongId === "custom" ? "border-black/30 text-black/80" : "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10"
                      }`}>
                        Composer
                      </span>
                    </div>
                    <p className={`text-[10px] uppercase font-mono tracking-wider mt-2 ${
                      selectedSongId === "custom" ? "text-black/60" : "text-white/40"
                    }`}>Plot custom beats and note structures interactively on the piano roll matrix.</p>
                  </button>
                </div>

                {/* Song Stat badge */}
                <div className="bg-white/5 border border-white/10 p-3 flex justify-between text-2xs font-mono text-white/50 uppercase tracking-widest">
                  <div>
                    <span>SEQUENCE SIZE: </span>
                    <span className="text-white font-bold ml-1">{activeNotes.length} notes</span>
                  </div>
                  <div>
                    <span>SILENT BEATS: </span>
                    <span className="text-white font-bold ml-1">
                      {activeNotes.filter((n) => n.pitch === 0).length} rests
                    </span>
                  </div>
                </div>
              </div>

              {/* Box B: Interactive Preprocessing inspector */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#CCFF00]" />
                    <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">02 / Preprocessor & Tokens</h2>
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-4 leading-relaxed font-sans">
                  AI networks cannot analyze complex frequencies straight away. We quantize raw note properties into discrete vocabulary strings.
                </p>

                {/* Tokens display */}
                <div className="mb-5">
                  <span className="text-3xs font-mono font-black text-[#CCFF00] block mb-2 uppercase tracking-widest">
                    VOCABULARY DICTIONARY (SIZE: {uniqueTokensList.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border border-white/15 p-2 bg-black/50 text-white/80 custom-scrollbar">
                    {uniqueTokensList.map((tok, idx) => (
                      <span
                        key={tok}
                        className="text-3xs font-mono border border-white/10 bg-white/3 px-1.5 py-0.5 text-white/80 hover:bg-[#CCFF00] hover:text-black hover:border-transparent transition"
                      >
                        {tok} <span className="opacity-50">({idx})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sliding Window Inspector */}
                <div>
                  <span className="text-3xs font-mono font-black text-[#CCFF00] block mb-2 uppercase tracking-widest">
                    RNN SLIDING WINDOWS (X &rarr; Y) (SIZE: {slidingWindows.length})
                  </span>
                  <div className="flex flex-col gap-1 border border-white/15 max-h-36 overflow-y-auto bg-black/50 p-2.5 text-[10px] font-mono custom-scrollbar">
                    {slidingWindows.length === 0 ? (
                      <span className="text-white/30 italic">Not enough notes to construct windows.</span>
                    ) : (
                      slidingWindows.slice(0, 4).map((win, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                          <div className="truncate shrink max-w-[70%]">
                            <span className="text-white/40 mr-1.5 font-bold">w{idx + 1}:</span>
                            {win.inputs.map((inp, ii) => (
                              <span key={ii} className="bg-white/10 border border-white/5 px-1 py-0.2 rounded-xs mr-1 text-white/95">
                                {inp}
                              </span>
                            ))}
                          </div>
                          <div className="shrink-0 flex items-center">
                            <span className="text-white/30 mr-1.5 font-bold">&rarr;</span>
                            <span className="bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30 px-1 py-0.2 text-3xs font-bold uppercase tracking-wider">
                              {win.target}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    {slidingWindows.length > 4 && (
                      <div className="text-center text-white/35 text-3xs italic mt-2 font-mono uppercase tracking-widest">
                        + {slidingWindows.length - 4} sequences remaining in queue
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE COLUMN: MODEL TRAINING WORKBENCH */}
            <div className="lg:col-span-1 flex flex-col gap-8">
              
              {/* Box C: Model Trainer */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                  <Brain className="w-4 h-4 text-[#CCFF00]" />
                  <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">03 / AI Model Configurator</h2>
                </div>

                {/* Algorithm Switcher */}
                <div className="grid grid-cols-2 bg-white/5 p-1 border border-white/10 mb-5">
                  <button
                    onClick={() => setActiveAlgorithm("rnn")}
                    className={`py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      activeAlgorithm === "rnn" ? "bg-[#CCFF00] text-black font-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    Elman RNN Model
                  </button>
                  <button
                    onClick={() => setActiveAlgorithm("markov")}
                    className={`py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      activeAlgorithm === "markov" ? "bg-[#CCFF00] text-black font-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    Markov Chain
                  </button>
                </div>

                {/* Hyperparameter adjustments */}
                <div className="space-y-5 mb-6 text-white">
                  {activeAlgorithm === "rnn" ? (
                    <>
                      {/* Hidden Size Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-3xs font-mono font-bold text-white/50 uppercase tracking-wider">HIDDEN SIZE (NEURONS)</label>
                          <span className="text-xs font-mono font-bold text-[#CCFF00]">{hyperparams.rnn.hiddenSize}</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="64"
                          step="4"
                          value={hyperparams.rnn.hiddenSize}
                          onChange={(e) => setHyperparams({
                            ...hyperparams,
                            rnn: { ...hyperparams.rnn, hiddenSize: parseInt(e.target.value, 10) }
                          })}
                          className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                        />
                      </div>

                      {/* Learning Rate Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-3xs font-mono font-bold text-white/50 uppercase tracking-wider">LEARNING RATE (LR)</label>
                          <span className="text-xs font-mono font-bold text-[#CCFF00]">{hyperparams.rnn.learningRate}</span>
                        </div>
                        <input
                          type="range"
                          min="0.01"
                          max="0.5"
                          step="0.01"
                          value={hyperparams.rnn.learningRate}
                          onChange={(e) => setHyperparams({
                            ...hyperparams,
                            rnn: { ...hyperparams.rnn, learningRate: parseFloat(e.target.value) }
                          })}
                          className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                        />
                      </div>

                      {/* Epochs Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-3xs font-mono font-bold text-white/50 uppercase tracking-wider">TRAINING EPOCHS</label>
                          <span className="text-xs font-mono font-bold text-[#CCFF00]">{hyperparams.rnn.epochs}</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={hyperparams.rnn.epochs}
                          onChange={(e) => setHyperparams({
                            ...hyperparams,
                            rnn: { ...hyperparams.rnn, epochs: parseInt(e.target.value, 10) }
                          })}
                          className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                        />
                      </div>

                      {/* Sliding window context sequenceLength */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-3xs font-mono font-bold text-white/50 uppercase tracking-wider">WINDOW SIZE (CONTEXT)</label>
                          <span className="text-xs font-mono font-bold text-[#CCFF00]">{hyperparams.rnn.sequenceLength} notes</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="12"
                          value={hyperparams.rnn.sequenceLength}
                          onChange={(e) => setHyperparams({
                            ...hyperparams,
                            rnn: { ...hyperparams.rnn, sequenceLength: parseInt(e.target.value, 10) }
                          })}
                          className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Markov Order Selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-3xs font-mono font-bold text-white/50 uppercase tracking-wider">MARKOV CHAIN ORDER (HISTORY)</label>
                          <span className="text-xs font-mono font-bold text-[#CCFF00]">Order {hyperparams.markov.order}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={hyperparams.markov.order}
                          onChange={(e) => setHyperparams({
                            ...hyperparams,
                            markov: { order: parseInt(e.target.value, 10) }
                          })}
                          className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                        />
                        <p className="text-3xs text-white/40 mt-3 select-none leading-relaxed font-mono">
                          An Order {hyperparams.markov.order} chain means the likelihood of the next note depends on the exact sequence of the past {hyperparams.markov.order} notes.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Train Action Button */}
                <button
                  id="train-ai-model-btn"
                  onClick={handleTrainModel}
                  disabled={trainingProgress.isTraining}
                  className={`w-full py-3.5 px-4 font-bold font-display uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${
                    trainingProgress.isTraining
                      ? "bg-white/10 text-white/40 border border-white/5 cursor-not-allowed"
                      : "bg-[#CCFF00] text-black hover:bg-white hover:shadow-lg"
                  }`}
                >
                  {trainingProgress.isTraining ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin text-white/50" />
                      <span className="font-mono">TUNING WEIGHTS (EP {trainingProgress.epoch}/{trainingProgress.totalEpochs})...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      <span>{activeAlgorithm === "rnn" ? "Train Neural RNN Model" : "Build Markov Sequence Matrix"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Box D: Training Progress Feedback & SVGs */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                  <span className="text-3xs font-mono font-black text-[#CCFF00] uppercase tracking-widest">Training Feedback & Loss Graphs</span>
                  {trainingProgress.epoch > 0 && (
                    <span className="text-3xs font-mono bg-[#CCFF00]/10 text-[#CCFF00] px-2.5 py-0.5 border border-[#CCFF00]/30 font-bold uppercase tracking-wider">
                      {trainingProgress.isTraining ? "TUNING" : "STABLE"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-center pb-1">
                  <div className="bg-white/5 border border-white/5 p-3">
                    <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider font-semibold">Epochs Complete</span>
                    <span id="epoch-counter-stat" className="text-xl font-bold font-mono text-white tracking-tighter mt-1 block">
                      {trainingProgress.epoch} <span className="text-xs text-white/40 font-normal">/ {trainingProgress.totalEpochs}</span>
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3">
                    <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider font-semibold">Mean Cross Loss</span>
                    <span id="loss-ratio-stat" className="text-xl font-bold font-mono text-white tracking-tighter mt-1 block">
                      {trainingProgress.loss > 0 ? trainingProgress.loss.toFixed(4) : "—"}
                    </span>
                  </div>
                </div>

                {renderTrainingChart()}
              </div>
            </div>

            {/* RIGHT COLUMN: GENERATED MUSIC & AI INTEGRION */}
            <div className="lg:col-span-1 flex flex-col gap-8">
              
              {/* Box E: AI Composition controls */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                  <Wand2 className="w-4 h-4 text-[#CCFF00]" />
                  <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">04 / Compose Continuation</h2>
                </div>
                <p className="text-xs text-white/50 mb-5 leading-relaxed font-sans">
                  Customize note variations and hit Generate to continue your currently selected melody using our trained model weights.
                </p>

                <div className="space-y-5 mb-5">
                  {/* Generation Length */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xs font-mono text-white/50 uppercase tracking-wider font-bold">GENERATION STEPS (NOTES)</span>
                      <span className="text-xs font-mono font-bold text-[#CCFF00]">{generateLength} steps</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="32"
                      step="4"
                      value={generateLength}
                      onChange={(e) => setGenerateLength(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                    />
                  </div>

                  {/* Temperature slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xs font-mono text-white/50 uppercase tracking-wider font-bold">SAMPLING TEMPERATURE</span>
                      <span className="text-xs font-mono font-bold text-[#CCFF00]">
                        {temperature.toFixed(1)} {temperature < 0.5 ? "(Repetitive)" : temperature > 1.3 ? "(Creative Chaos)" : "(Balanced)"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    id="trigger-composition-btn"
                    onClick={handleGenerateMelody}
                    className="w-full bg-[#CCFF00] hover:bg-white text-black font-black uppercase text-xs tracking-widest py-3 transition duration-155 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4 text-black animate-spin" style={{ animationDuration: "3s" }} />
                    <span>Run AI Generation Sequence</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      id="reset-track-btn"
                      onClick={handleResetTrack}
                      className="py-2.5 px-3 border border-white/20 select-none text-xs font-mono uppercase tracking-wider text-white hover:bg-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Track</span>
                    </button>
                    
                    <button
                      id="download-midi-btn"
                      onClick={() => downloadMidiFile(activeNotes)}
                      className="py-2.5 px-3 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-[#CCFF00] transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Export sequence to playable MIDI"
                    >
                      <Download className="w-3.5 h-3.5 mt-[1px]" />
                      <span>Download MIDI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Box F: AI Prompt Assistant */}
              <div className="border border-white/10 bg-white/3 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#CCFF00]" />
                    <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">05 / Symphonic AI Improviser</h2>
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-4 leading-relaxed font-sans">
                  Ask the Symphonic AI to craft an initial monophonic MIDI melody or analyze the harmonic contours of your current canvas stream.
                </p>

                {/* Text-to-Melody Composer Form */}
                <form onSubmit={handleGenerateMelodyWithAI} className="mb-5 font-sans">
                  <label className="text-3xs font-mono font-bold text-white/50 block mb-2 uppercase tracking-wide">PROMPT CREATIVE MELODY SEED</label>
                  <div className="flex bg-white/5 border border-white/15 focus-within:border-[#CCFF00]/60 p-0.5">
                    <input
                      type="text"
                      placeholder="e.g. Melancholic rainy piano nocturne..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      disabled={isGeneratingMelody}
                      className="flex-1 bg-transparent text-xs text-white border-0 px-3.5 py-2.5 placeholder:text-white/25 focus:outline-none focus:ring-0 font-sans"
                    />
                    <button
                      type="submit"
                      disabled={isGeneratingMelody || !aiPrompt.trim()}
                      className="px-4 hover:shadow-xs bg-[#CCFF00] hover:bg-white text-black text-xs tracking-wider font-bold cursor-pointer transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="Generate notes with AI Model"
                    >
                      {isGeneratingMelody ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5 text-black" />
                      )}
                    </button>
                  </div>
                  {aiStatus && (
                    <span className="text-[10px] font-mono text-[#CCFF00] animate-pulse mt-2.5 block leading-relaxed uppercase tracking-wider">
                      ⚡ {aiStatus}
                    </span>
                  )}
                </form>

                {/* Ask musicology analysis */}
                <button
                  id="evaluate-melody-btn"
                  onClick={handleAnalyzeMelodyWithAI}
                  disabled={isAnalyzing || activeNotes.length === 0}
                  className="w-full bg-white hover:bg-[#CCFF00] text-black font-black uppercase text-xs tracking-widest py-3 px-3 transition duration-155 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin mr-1 text-black" />
                      <span>Review compiling...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-3.5 h-3.5 text-black" />
                      <span>Review Sheet with AI Musicology</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* 4. MAIN PIANO ROLL GRID PLAYER (ALWAYS DISPLAYED UNDER TAB CONTROLS ON PLAYGROUND TAB) */}
        {activeTab === "playground" && (
          <div className="mt-8 animate-fade-in">
            <div className="flex items-end justify-between mb-4 px-1 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-[#CCFF00]" />
                <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#CCFF00]">
                  {selectedSongId === "custom" ? "06 / Custom Composer Sequencer Canvas" : `06 / Interactive Sequencer: ${currentCorpus.title}`}
                </h2>
              </div>
              <span className="text-3xs font-mono font-bold bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-2.5 py-1 text-[#CCFF00] uppercase tracking-widest select-none leading-none">
                {selectedSongId === "custom" ? "Draw Mode: Click Grid Cells" : "Read-Only Preview Mode"}
              </span>
            </div>

            <PianoRoll
              notes={activeNotes}
              onChangeNotes={handleCustomNotesChange}
              isEditable={selectedSongId === "custom"}
            />
          </div>
        )}

        {/* 5. GORGEOUS MUSICOLOGY COMPOSER REPORT BOX (IF REPORT GENERATED) */}
        {activeTab === "playground" && analysisResult && (
          <div id="ai-analysis-report-panel" className="mt-8 border border-[#CCFF00]/20 bg-white/3 p-6.5 animate-fade-in relative overflow-hidden">
            {/* Ambient indicator accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#CCFF00]" />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-5 mb-5 border-b border-white/10">
              <div className="flex items-start gap-3.5">
                <Sparkles className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-widest text-white leading-tight">
                    &ldquo;{analysisResult.title}&rdquo; — AI Musicological Review
                  </h3>
                  <p className="text-3xs font-mono text-[#CCFF00] uppercase tracking-[0.25em] mt-2 font-bold leading-none">
                    Evaluated Close Key Signature: {analysisResult.keySignature}
                  </p>
                </div>
              </div>

              {/* Dynamic Score Badge */}
              <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 px-6 py-3.5 text-center shrink-0">
                <span className="text-[10px] font-mono font-black text-white/40 uppercase tracking-widest leading-none mb-1.5 font-sans">SCORE EVAL</span>
                <span className="text-3xl font-mono font-black text-[#CCFF00] leading-none">{analysisResult.score}<span className="text-sm text-white/30 font-normal">/100</span></span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 text-xs text-white/80 leading-relaxed font-sans">
              {/* Melodic Contour Column */}
              <div className="bg-white/3 border border-white/10 p-5">
                <span className="text-3xs font-mono font-bold text-[#CCFF00] block mb-3 uppercase tracking-widest leading-none border-b border-white/5 pb-2">Melodic Contour & Shapes</span>
                <p className="text-white/70 text-xs leading-relaxed font-sans">{analysisResult.contour}</p>
              </div>

              {/* Harmony Column */}
              <div className="bg-white/3 border border-white/10 p-5">
                <span className="text-3xs font-mono font-bold text-[#CCFF00] block mb-3 uppercase tracking-widest leading-none border-b border-white/5 pb-2">Implied Harmonic Chord Settings</span>
                <p className="text-white/70 text-xs font-mono leading-relaxed bg-[#000000]/40 p-3 border border-white/5">{analysisResult.harmony}</p>
              </div>

              {/* Rhythmic column */}
              <div className="bg-white/3 border border-white/10 p-5">
                <span className="text-3xs font-mono font-bold text-[#CCFF00] block mb-3 uppercase tracking-widest leading-none border-b border-[#ffffff10] pb-2">Tempo & Rhythmic Complexity</span>
                <p className="text-white/70 text-xs leading-relaxed font-sans">{analysisResult.rhythm}</p>
              </div>
            </div>

            {/* Overall analysis feedback markdown block */}
            <div className="mt-6 pt-5 border-t border-white/10 text-xs text-white/75 font-sans leading-relaxed">
              <span className="text-3xs font-mono font-bold text-[#CCFF00] block mb-2 uppercase tracking-widest">Musicologist Evaluation Overview</span>
              <p className="leading-relaxed text-white/80 select-none block bg-stone-950 p-4 border border-white/5 font-sans">{analysisResult.overallFeedback}</p>
            </div>
          </div>
        )}

      </main>

      {/* 6. SYSTEM FOOTER */}
      <footer className="mt-20 border-t border-[#ffffff10] py-10 px-12 text-center text-xs text-white/30 select-none font-sans bg-[#040404]">
        <p className="font-display font-medium text-white/50 uppercase tracking-widest">Algorithmic Symphony</p>
        <p className="font-mono text-3xs text-white/20 uppercase tracking-[0.25em] mt-2 leading-none">
          Standard Web-Audio Synthesizers.
        </p>
      </footer>

    </div>
  );
}

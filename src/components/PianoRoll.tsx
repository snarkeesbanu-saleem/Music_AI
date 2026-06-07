/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Music, Keyboard } from "lucide-react";
import { NoteEvent, InstrumentConfig } from "../types";

interface PianoRollProps {
  notes: NoteEvent[];
  onChangeNotes?: (updatedNotes: NoteEvent[]) => void;
  isEditable?: boolean;
}

export default function PianoRoll({ notes, onChangeNotes, isEditable = false }: PianoRollProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [instrument, setInstrument] = useState<InstrumentConfig>({
    waveform: "triangle",
    attack: 0.05,
    decay: 0.1,
    sustain: 0.6,
    release: 0.2,
  });

  const GRID_STEPS = 32;
  const MIN_PITCH = 55; // G3
  const MAX_PITCH = 81; // A5
  const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;

  const getNoteName = (pitch: number): string => {
    const notesArray = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const name = notesArray[pitch % 12];
    const octave = Math.floor(pitch / 12) - 1;
    return `${name}${octave}`;
  };

  const pitchList = Array.from({ length: PITCH_RANGE }, (_, i) => MAX_PITCH - i);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeOscillatorsRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const getGridNotesMap = (): Map<string, { pitch: number; isStart: boolean; duration: number }> => {
    const map = new Map<string, { pitch: number; isStart: boolean; duration: number }>();
    let accumulatedSteps = 0;

    for (const note of notes) {
      const dur = note.duration;
      if (note.pitch > 0) {
        for (let d = 0; d < dur; d++) {
          const stepIndex = accumulatedSteps + d;
          if (stepIndex < GRID_STEPS) {
            map.set(`${stepIndex}_${note.pitch}`, {
              pitch: note.pitch,
              isStart: d === 0,
              duration: dur,
            });
          }
        }
      }
      accumulatedSteps += dur;
    }
    return map;
  };

  const gridNotesMap = getGridNotesMap();

  const previewNoteSynth = (pitch: number) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = instrument.waveform;
      osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), ctx.currentTime);

      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.4, now + instrument.attack);
      gainNode.gain.linearRampToValueAtTime(0.4 * instrument.sustain, now + instrument.attack + instrument.decay);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      
      const sustainEnd = now + 0.25;
      gainNode.gain.setValueAtTime(0.4 * instrument.sustain, sustainEnd);
      gainNode.gain.exponentialRampToValueAtTime(0.001, sustainEnd + instrument.release);
      osc.stop(sustainEnd + instrument.release);
    } catch (e) {
      console.error("Web Audio preview failed:", e);
    }
  };

  const handleCellClick = (stepIdx: number, pitchValue: number) => {
    if (!isEditable || !onChangeNotes) return;

    previewNoteSynth(pitchValue);

    const key = `${stepIdx}_${pitchValue}`;
    const clickTargetExists = gridNotesMap.has(key);

    const stepNotesArray = new Array<{ pitch: number }>(GRID_STEPS).fill({ pitch: 0 });
    
    let tSteps = 0;
    for (const note of notes) {
      const dur = note.duration;
      for (let d = 0; d < dur; d++) {
        if (tSteps + d < GRID_STEPS) {
          stepNotesArray[tSteps + d] = { pitch: note.pitch };
        }
      }
      tSteps += dur;
    }

    if (clickTargetExists) {
      stepNotesArray[stepIdx] = { pitch: 0 };
    } else {
      stepNotesArray[stepIdx] = { pitch: pitchValue };
    }

    const newNotes: NoteEvent[] = [];
    let curPitch = stepNotesArray[0].pitch;
    let curDur = 1;

    for (let idx = 1; idx < GRID_STEPS; idx++) {
      const p = stepNotesArray[idx].pitch;
      if (p === curPitch) {
        curDur++;
      } else {
        newNotes.push({
          pitch: curPitch,
          duration: curDur,
          name: curPitch === 0 ? "Rest" : getNoteName(curPitch),
        });
        curPitch = p;
        curDur = 1;
      }
    }
    newNotes.push({
      pitch: curPitch,
      duration: curDur,
      name: curPitch === 0 ? "Rest" : getNoteName(curPitch),
    });

    onChangeNotes(newNotes);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    setIsPlaying(true);
    getAudioContext();
    
    const flatNoteAtStep: Array<{ pitch: number, isStart: boolean }> = Array.from({ length: GRID_STEPS }, () => ({ pitch: 0, isStart: false }));
    let stepCount = 0;

    for (const n of notes) {
      const dur = n.duration;
      for (let d = 0; d < dur; d++) {
        if (stepCount + d < GRID_STEPS) {
          flatNoteAtStep[stepCount + d] = {
            pitch: n.pitch,
            isStart: d === 0
          };
        }
      }
      stepCount += dur;
    }

    let nextStep = 0;
    setCurrentStep(0);

    const stepDurationMs = (60 * 1000) / (bpm * 4);

    const runSequencer = () => {
      const stepIdx = nextStep % GRID_STEPS;
      setCurrentStep(stepIdx);

      const cell = flatNoteAtStep[stepIdx];

      if (cell && cell.pitch > 0 && cell.isStart) {
        triggerSynth(cell.pitch, stepIdx, flatNoteAtStep);
      }

      nextStep++;
      playbackTimeoutRef.current = setTimeout(runSequencer, stepDurationMs);
    };

    runSequencer();
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentStep(null);
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    activeOscillatorsRef.current.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    activeOscillatorsRef.current = [];
  };

  const getNoteDurationRemaining = (stepIdx: number, flatNotes: Array<{ pitch: number, isStart: boolean }>): number => {
    let dur = 1;
    const initialPitch = flatNotes[stepIdx].pitch;
    for (let s = stepIdx + 1; s < GRID_STEPS; s++) {
      if (flatNotes[s].pitch === initialPitch && !flatNotes[s].isStart) {
        dur++;
      } else {
        break;
      }
    }
    return dur;
  };

  const triggerSynth = (pitch: number, stepIdx: number, flatNotes: Array<{ pitch: number, isStart: boolean }>) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = instrument.waveform;
      osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), ctx.currentTime);

      const stepDurationSec = 60 / (bpm * 4);
      const noteSteps = getNoteDurationRemaining(stepIdx, flatNotes);
      const playDurationSec = noteSteps * stepDurationSec;

      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + instrument.attack);
      gainNode.gain.linearRampToValueAtTime(0.35 * instrument.sustain, now + instrument.attack + instrument.decay);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);

      const noteReleaseTime = now + playDurationSec - instrument.release;
      const safeReleaseTime = noteReleaseTime > now ? noteReleaseTime : now + playDurationSec * 0.8;

      gainNode.gain.setValueAtTime(0.35 * instrument.sustain, safeReleaseTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, safeReleaseTime + instrument.release);
      osc.stop(safeReleaseTime + instrument.release);

      const activeEntry = { osc, gain: gainNode };
      activeOscillatorsRef.current.push(activeEntry);

      setTimeout(() => {
        activeOscillatorsRef.current = activeOscillatorsRef.current.filter(x => x !== activeEntry);
      }, (playDurationSec + instrument.release + 0.5) * 1000);

    } catch (e) {
      console.error("Synthesizer trigger error:", e);
    }
  };

  const clearComposerGrid = () => {
    if (!isEditable || !onChangeNotes) return;
    onChangeNotes([{ pitch: 0, duration: 32, name: "Rest" }]);
  };

  return (
    <div id="piano-roll-container" className="bg-white/3 border border-white/10 p-6">
      {/* Tracker Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10 text-white font-sans">
        <div className="flex items-center gap-2">
          <button
            id="play-toggle-btn"
            onClick={togglePlayback}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold font-display uppercase text-xs tracking-wider transition cursor-pointer ${
              isPlaying 
                ? "bg-[#CCFF00] text-black" 
                : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-black text-black" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white text-white" />
                <span>Play Melody</span>
              </>
            )}
          </button>

          <button
            id="stop-playback-btn"
            onClick={stopPlayback}
            disabled={!isPlaying && currentStep === null}
            className="flex items-center justify-center p-3 border border-white/10 text-white/55 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
            title="Stop playback"
          >
            <Square className="w-4 h-4 fill-current animate-pulse" />
          </button>

          {isEditable && (
            <button
              id="clear-composer-btn"
              onClick={clearComposerGrid}
              className="px-3 py-1.5 text-3xs font-mono font-bold uppercase tracking-wider text-red-400 bg-red-95/20 hover:bg-red-95/40 border border-red-500/30 transition ml-2 cursor-pointer"
            >
              Clear Grid
            </button>
          )}
        </div>

        {/* BPM & Instrument Waveform controls */}
        <div className="flex flex-wrap items-center gap-5 w-full sm:w-auto">
          {/* BPM Slider */}
          <div className="flex items-center gap-3 w-full sm:w-44">
            <span className="text-3xs font-mono font-bold text-white/40 tracking-wider">BPM</span>
            <input
              id="bpm-slider"
              type="range"
              min="60"
              max="200"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#CCFF00]"
            />
            <span className="text-xs font-mono font-bold bg-white/5 border border-white/10 px-2 py-0.5 text-[#CCFF00] min-w-[36px] text-center">
              {bpm}
            </span>
          </div>

          {/* Synth Options */}
          <div className="flex items-center gap-2.5">
            <span className="text-3xs font-mono font-bold text-white/40 tracking-wider">SYNTH VOICE</span>
            <div className="flex bg-black/40 p-0.5 border border-white/10">
              {(["triangle", "sine", "square", "sawtooth"] as OscillatorType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setInstrument({ ...instrument, waveform: type })}
                  className={`px-2.5 py-1 text-3xs font-mono font-bold uppercase transition cursor-pointer ${
                    instrument.waveform === type
                      ? "bg-[#CCFF00] text-black"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {type === "sawtooth" ? "saw" : type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Piano Roll Grid Area */}
      <div id="piano-roll-grid-scroll" className="relative overflow-x-auto border border-white/10 max-h-[440px] custom-scrollbar bg-[#050505]">
        <div className="flex min-w-[800px] select-none">
          {/* Left Keyboard Columns */}
          <div className="w-16 bg-[#0a0a0a] border-r border-[#ffffff1a] sticky left-0 z-10 select-none shrink-0">
            {pitchList.map((pitch) => {
              const semitone = pitch % 12;
              const isBlackKey = [1, 3, 6, 8, 10].includes(semitone);
              return (
                <div
                  key={pitch}
                  onClick={() => previewNoteSynth(pitch)}
                  className={`h-6 flex items-center justify-between px-1.5 text-[10px] font-mono border-b border-white/10 cursor-pointer transition ${
                    isBlackKey 
                      ? "bg-black text-[#CCFF00] hover:bg-white/10" 
                      : "bg-[#0b0b0b] text-white/70 hover:bg-[#CCFF00] hover:text-black hover:font-bold"
                  }`}
                >
                  <span className="truncate leading-none">{getNoteName(pitch)}</span>
                  <Keyboard className="w-2.5 h-2.5 opacity-40 shrink-0 text-[#CCFF00]" />
                </div>
              );
            })}
          </div>

          {/* Right Steps Grid Canvas */}
          <div className="flex-1 relative bg-black/40">
            {/* Step numbers header */}
            <div className="flex bg-[#0d0d0d] border-b border-white/15 h-6">
              {Array.from({ length: GRID_STEPS }).map((_, stepIdx) => {
                const isBar = stepIdx % 4 === 0;
                return (
                  <div
                    key={stepIdx}
                    className={`flex-1 min-w-[20px] text-center border-r border-white/5 text-[9px] font-mono leading-6 ${
                      isBar ? "text-[#CCFF00] font-black bg-white/5" : "text-white/30"
                    }`}
                  >
                    {stepIdx + 1}
                  </div>
                );
              })}
            </div>

            {/* Matrix row notes */}
            {pitchList.map((pitch) => {
              const semitone = pitch % 12;
              const isBlackKey = [1, 3, 6, 8, 10].includes(semitone);

              return (
                <div key={pitch} className="flex h-6 border-[#ffffff08] border-b relative">
                  {Array.from({ length: GRID_STEPS }).map((_, stepIdx) => {
                    const key = `${stepIdx}_${pitch}`;
                    const noteInfo = gridNotesMap.get(key);
                    const isActive = !!noteInfo;
                    const isStart = noteInfo?.isStart === true;
                    
                    const isSequenceCursor = currentStep === stepIdx;
                    const isQuarterBar = stepIdx % 4 === 0;

                    return (
                      <div
                        key={stepIdx}
                        onClick={() => handleCellClick(stepIdx, pitch)}
                        className={`flex-1 min-w-[20px] border-r border-white/5 cursor-pointer transition relative ${
                          isBlackKey ? "bg-white/[0.02]" : "bg-transparent"
                        } ${isQuarterBar ? "border-r-white/15" : ""} ${
                          isEditable ? "hover:bg-[#CCFF00]/10" : ""
                        }`}
                      >
                        {/* Highlights sequence cursor line */}
                        {isSequenceCursor && (
                          <div className="absolute inset-y-0 left-0 right-0 bg-[#CCFF00]/15 pointer-events-none border-x border-[#CCFF00]/40 z-[1] animate-pulse" />
                        )}

                        {/* Renders Note block block */}
                        {isActive && (
                          <div
                            className={`absolute inset-y-[1px] inset-x-0 ${
                              isStart 
                                ? "bg-[#CCFF00] text-black font-black border-l-2 border-black" 
                                : "bg-[#CCFF00]/80 text-black/85"
                            } border-y border-black/30 flex items-center justify-start px-1 font-mono text-[8px] overflow-hidden truncate z-[2]`}
                            style={{
                              paddingLeft: isStart ? "4px" : "0px",
                              opacity: isSequenceCursor ? 0.95 : 1
                            }}
                          >
                            {isStart && <Music className="w-2 h-2 mr-1 shrink-0 text-black animate-spin" style={{ animationDuration: "3s" }} />}
                            {isStart && getNoteName(pitch)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Guide captions */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-white/40 text-3xs font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#CCFF00]" /> Note Selection
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 border-r border-white/20 bg-white/5 inline-block" /> Quarter Bar Accents
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#CCFF00]/15 border border-[#CCFF00]/40 inline-block" /> Playback Head
        </span>
        {isEditable && (
          <span className="text-[#CCFF00] font-black tracking-normal">
            * Interactive composer active: Plot details by clicking cells!
          </span>
        )}
      </div>
    </div>
  );
}

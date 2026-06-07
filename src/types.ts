/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NoteEvent {
  pitch: number;    // MIDI pitch, e.g., 60 for C4. 0 represents a musical rest.
  duration: number; // Duration in 16th-note steps (e.g., 4 is a quarter note, 2 is an eighth note).
  name?: string;    // Text representation of note: "C4", "C#4", "Rest" etc.
}

export interface SongCorpus {
  id: string;
  title: string;
  genre: "classical" | "jazz" | "chiptune" | "folk" | "custom";
  description: string;
  notes: NoteEvent[];
}

export type GenerationAlgorithm = "rnn" | "markov";

export interface ModelHyperparameters {
  rnn: {
    hiddenSize: number;
    learningRate: number;
    sequenceLength: number; // sliding window size
    epochs: number;
  };
  markov: {
    order: number; // History length of previous notes
  };
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  history: Array<{ epoch: number; loss: number; accuracy: number }>;
  isTraining: boolean;
}

export interface ComposerAnalysis {
  title: string;
  keySignature: string;
  score: number;
  contour: string;
  harmony: string;
  rhythm: string;
  overallFeedback: string;
}

export interface InstrumentConfig {
  waveform: OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'
  attack: number;           // ADSR envelope properties
  decay: number;
  sustain: number;
  release: number;
}

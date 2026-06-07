/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteEvent } from "../types";

// Static helper to serialize note to token string, e.g. "60_4" or "rest_2"
export function serializeNote(note: NoteEvent): string {
  const pitchStr = note.pitch === 0 ? "rest" : note.pitch.toString();
  return `${pitchStr}_${note.duration}`;
}

// Static helper to deserialize token string back to NoteEvent
export function deserializeNote(token: string): NoteEvent {
  const [pitchPart, durationPart] = token.split("_");
  const pitch = pitchPart === "rest" ? 0 : parseInt(pitchPart, 10);
  const duration = parseInt(durationPart, 10);
  
  // Human readable name helper
  let noteName = "Rest";
  if (pitch > 0) {
    const notesArray = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const name = notesArray[pitch % 12];
    const octave = Math.floor(pitch / 12) - 1;
    noteName = `${name}${octave}`;
  }
  return { pitch, duration, name: noteName };
}

/**
 * ==========================================
 * ELMAN RECURRENT NEURAL NETWORK IMPLEMENTATION
 * ==========================================
 */
export class MusicRNN {
  public vocab: string[] = [];
  public vocabMap: Map<string, number> = new Map();
  
  // Model weights
  private Wxh: number[][] = []; // (hiddenSize x vocabSize)
  private Whh: number[][] = []; // (hiddenSize x hiddenSize)
  private Why: number[][] = []; // (vocabSize x hiddenSize)
  private bh: number[] = [];    // hidden size
  private by: number[] = [];    // vocab size
  
  // Historical gradient caches for AdaGrad optimizer
  private cacheWxh: number[][] = [];
  private cacheWhh: number[][] = [];
  private cacheWhy: number[][] = [];
  private cachebh: number[] = [];
  private cacheby: number[] = [];

  constructor(
    public hiddenSize: number = 24,
    public learningRate: number = 0.05
  ) {}

  /**
   * Initializes vocabulary and weights based on a given note corpus
   */
  public initializeVocabularyAndWeights(notes: NoteEvent[]): void {
    // 1. Build vocabulary
    const uniqueTokens = new Set<string>();
    
    // Add default fallbacks just in case vocabulary is extremely small
    uniqueTokens.add("rest_4");
    uniqueTokens.add("60_4");
    uniqueTokens.add("62_4");
    uniqueTokens.add("64_4");
    
    notes.forEach((note) => {
      uniqueTokens.add(serializeNote(note));
    });

    this.vocab = Array.from(uniqueTokens);
    this.vocabMap.clear();
    this.vocab.forEach((token, idx) => {
      this.vocabMap.set(token, idx);
    });

    const V = this.vocab.length;
    const H = this.hiddenSize;

    // 2. Initialize matrix weights randomly with small values
    const initMatrix = (rows: number, cols: number, std: number = 0.1): number[][] => {
      const mat: number[][] = [];
      for (let r = 0; r < rows; r++) {
        const row: number[] = [];
        for (let c = 0; c < cols; c++) {
          row.push((Math.random() * 2 - 1) * std);
        }
        mat.push(row);
      }
      return mat;
    };

    const initVector = (size: number): number[] => {
      return new Array(size).fill(0);
    };

    this.Wxh = initMatrix(H, V);
    this.Whh = initMatrix(H, H);
    this.Why = initMatrix(V, H);
    this.bh = initVector(H);
    this.by = initVector(V);

    // Initialize AdaGrad caches with tiny values to prevent division by zero
    const initCache = (rows: number, cols: number): number[][] => {
      return Array.from({ length: rows }, () => new Array(cols).fill(1e-8));
    };
    
    this.cacheWxh = initCache(H, V);
    this.cacheWhh = initCache(H, H);
    this.cacheWhy = initCache(V, H);
    this.cachebh = new Array(H).fill(1e-8);
    this.cacheby = new Array(V).fill(1e-8);
  }

  /**
   * Converts a list of notes to sequences of sliding windows of lengths sequenceLength
   * Returns [Inputs, Targets] represented as token indices
   */
  public prepareTrainingData(notes: NoteEvent[], sequenceLength: number): [number[][], number[]] {
    const tokens = notes.map(serializeNote);
    const indices = tokens.map(token => this.vocabMap.get(token) ?? 0);

    const inputs: number[][] = [];
    const targets: number[] = [];

    // Map notes into sliding windows
    for (let i = 0; i <= indices.length - sequenceLength - 1; i++) {
      const win = indices.slice(i, i + sequenceLength);
      const nextNote = indices[i + sequenceLength];
      inputs.push(win);
      targets.push(nextNote);
    }

    return [inputs, targets];
  }

  /**
   * Run one epoch of training (BPTT style gradient updates over all prepared sliding sequence batches)
   * Returns [average_loss, accuracy]
   */
  public trainEpoch(inputs: number[][], targets: number[]): { loss: number; accuracy: number } {
    if (inputs.length === 0) return { loss: 0, accuracy: 0 };

    let totalLoss = 0;
    let correctPredictions = 0;

    const H = this.hiddenSize;
    const V = this.vocab.length;

    // Define accumulated epoch gradient buffers
    const dWxh = Array.from({ length: H }, () => new Array(V).fill(0));
    const dWhh = Array.from({ length: H }, () => new Array(H).fill(0));
    const dWhy = Array.from({ length: V }, () => new Array(H).fill(0));
    const dbh = new Array(H).fill(0);
    const dby = new Array(V).fill(0);

    // Iterate over all training sequences
    for (let s = 0; s < inputs.length; s++) {
      const seq = inputs[s];
      const targetIdx = targets[s];
      const T = seq.length;

      // 1. FORWARD PASS THROUGH TIME
      const hs: number[][] = Array.from({ length: T + 1 }, () => new Array(H).fill(0)); // h_t list
      const as: number[][] = []; // pre-activation list

      for (let t = 0; t < T; t++) {
        const xIdx = seq[t];
        const hPrev = hs[t]; // this is hs[0] for t=0, which is all zeroes

        const hNext = new Array(H).fill(0);
        const preAct = new Array(H).fill(0);

        for (let i = 0; i < H; i++) {
          // Multiply Wxh by one-hot input index
          let sum = this.Wxh[i][xIdx];
          
          // Multiply Whh by previous hidden state
          for (let j = 0; j < H; j++) {
            sum += this.Whh[i][j] * hPrev[j];
          }
          sum += this.bh[i];
          preAct[i] = sum;
          hNext[i] = Math.tanh(sum); // tanh activation
        }
        
        as.push(preAct);
        hs[t + 1] = hNext;
      }

      // 2. PROJECT TO OUTPUT FROM THE FINAL STATE h_(T-1) (Many-to-One Model)
      const hFinal = hs[T];
      const logits = new Array(V).fill(0);
      let maxLogit = -Infinity;
      
      for (let i = 0; i < V; i++) {
        let sum = 0;
        for (let j = 0; j < H; j++) {
          sum += this.Why[i][j] * hFinal[j];
        }
        sum += this.by[i];
        logits[i] = sum;
        if (sum > maxLogit) maxLogit = sum;
      }

      // Compute Softmax probabilities
      const expLogits = logits.map((val) => Math.exp(val - maxLogit));
      const expSum = expLogits.reduce((a, b) => a + b, 0);
      const probs = expLogits.map((val) => val / expSum);

      // Compute Categorical Cross Entropy Loss
      const loss = -Math.log(Math.max(probs[targetIdx], 1e-12));
      totalLoss += loss;

      // Accuracy checklist
      let predIdx = 0;
      let maxProb = -1;
      for (let i = 0; i < V; i++) {
        if (probs[i] > maxProb) {
          maxProb = probs[i];
          predIdx = i;
        }
      }
      if (predIdx === targetIdx) {
        correctPredictions++;
      }

      // 3. BACKWARD PASS (BPTT)
      // Loss gradient at logits: dy = probs - target_onehot
      const dy = [...probs];
      dy[targetIdx] -= 1.0;

      // Output weight gradients
      for (let i = 0; i < V; i++) {
        dby[i] += dy[i];
        for (let j = 0; j < H; j++) {
          dWhy[i][j] += dy[i] * hFinal[j];
        }
      }

      // Gradient with respect to final hidden state h_T
      const dh = new Array(H).fill(0);
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < V; i++) {
          dh[j] += this.Why[i][j] * dy[i];
        }
      }

      // BPTT back through historical states
      const dhCurrent = [...dh];
      for (let t = T - 1; t >= 0; t--) {
        const xIdx = seq[t];
        const hPrev = hs[t];
        const hCurr = hs[t + 1];

        const da = new Array(H).fill(0);
        for (let i = 0; i < H; i++) {
          // dtanh = dloss/dh * (1 - tanh^2)
          da[i] = dhCurrent[i] * (1.0 - hCurr[i] * hCurr[i]);
        }

        for (let i = 0; i < H; i++) {
          dbh[i] += da[i];
          dWxh[i][xIdx] += da[i]; // input weights gradient accumulation
          
          for (let j = 0; j < H; j++) {
            dWhh[i][j] += da[i] * hPrev[j];
          }
        }

        // Project gradient back to previous step t-1
        const dhPrev = new Array(H).fill(0);
        for (let j = 0; j < H; j++) {
          for (let i = 0; i < H; i++) {
            dhPrev[j] += this.Whh[i][j] * da[i];
          }
        }
        
        for (let j = 0; j < H; j++) {
          dhCurrent[j] = dhPrev[j];
        }
      }
    }

    // 4. WEIGHT OPTIMIZATION & UPDATE WITH ADAGRAD & GRADIENT CLIPPING
    const averageLoss = totalLoss / inputs.length;
    const accuracy = correctPredictions / inputs.length;

    const clipValue = 5.0;
    const H_dim = H;
    const V_dim = V;

    // Normalizing gradients across batches and applying clipping
    const clipGradients = (grad: number[][]): number[][] => {
      let norm = 0;
      grad.forEach(row => row.forEach(val => (norm += val * val)));
      norm = Math.sqrt(norm);
      if (norm > clipValue) {
        return grad.map(row => row.map(val => (val / norm) * clipValue));
      }
      return grad;
    };

    const dWxhClipped = clipGradients(dWxh.map(r => r.map(v => v / inputs.length)));
    const dWhhClipped = clipGradients(dWhh.map(r => r.map(v => v / inputs.length)));
    const dWhyClipped = clipGradients(dWhy.map(r => r.map(v => v / inputs.length)));

    // Dynamic AdaGrad weight adjustments
    for (let i = 0; i < H_dim; i++) {
      this.cachebh[i] += dbh[i] * dbh[i];
      this.bh[i] -= (this.learningRate * dbh[i]) / Math.sqrt(this.cachebh[i] + 1e-8);
      
      for (let j = 0; j < V_dim; j++) {
        this.cacheWxh[i][j] += dWxhClipped[i][j] * dWxhClipped[i][j];
        this.Wxh[i][j] -= (this.learningRate * dWxhClipped[i][j]) / Math.sqrt(this.cacheWxh[i][j] + 1e-8);
      }
      for (let j = 0; j < H_dim; j++) {
        this.cacheWhh[i][j] += dWhhClipped[i][j] * dWhhClipped[i][j];
        this.Whh[i][j] -= (this.learningRate * dWhhClipped[i][j]) / Math.sqrt(this.cacheWhh[i][j] + 1e-8);
      }
    }

    for (let i = 0; i < V_dim; i++) {
      this.cacheby[i] += dby[i] * dby[i];
      this.by[i] -= (this.learningRate * dby[i]) / Math.sqrt(this.cacheby[i] + 1e-8);
      
      for (let j = 0; j < H_dim; j++) {
        this.cacheWhy[i][j] += dWhyClipped[i][j] * dWhyClipped[i][j];
        this.Why[i][j] -= (this.learningRate * dWhyClipped[i][j]) / Math.sqrt(this.cacheWhy[i][j] + 1e-8);
      }
    }

    return { loss: averageLoss, accuracy };
  }

  /**
   * Generates a continuation from a seed array of notes using temperature-guided Softmax probability sampling
   */
  public generate(seedNotes: NoteEvent[], sequenceLength: number, totalLength: number, temperature: number = 1.0): NoteEvent[] {
    const sequence = [...seedNotes];
    const H = this.hiddenSize;
    const V = this.vocab.length;

    // Standard fallback if seedNotes is completely empty or has fewer notes than sequenceLength
    while (sequence.length < sequenceLength) {
      sequence.push(deserializeNote(this.vocab[Math.floor(Math.random() * V)]));
    }

    // Generate up to totalLength
    for (let step = 0; step < totalLength; step++) {
      // Get the last `sequenceLength` notes to feed as sequence window context
      const contextWindow = sequence.slice(-sequenceLength);
      const seqIdxs = contextWindow.map(serializeNote).map(tok => this.vocabMap.get(tok) ?? 0);

      // 1. FORWARD PASS
      const hs = new Array(H).fill(0);
      for (let t = 0; t < sequenceLength; t++) {
        const xIdx = seqIdxs[t];
        const hPrev = [...hs];
        
        for (let i = 0; i < H; i++) {
          let sum = this.Wxh[i][xIdx];
          for (let j = 0; j < H; j++) {
            sum += this.Whh[i][j] * hPrev[j];
          }
          sum += this.bh[i];
          hs[i] = Math.tanh(sum);
        }
      }

      // 2. PROJECT TO LOGITS
      const logits = new Array(V).fill(0);
      for (let i = 0; i < V; i++) {
        let sum = 0;
        for (let j = 0; j < H; j++) {
          sum += this.Why[i][j] * hs[j];
        }
        sum += this.by[i];
        logits[i] = sum;
      }

      // Apply Temperature Scaling
      const temp = Math.max(0.1, Math.min(temperature, 2.5));
      const scaledLogits = logits.map(v => v / temp);

      // Shift logits safely to prevent overflow
      const maxLogit = Math.max(...scaledLogits);
      const expLogits = scaledLogits.map(v => Math.exp(v - maxLogit));
      const expSum = expLogits.reduce((a, b) => a + b, 0);
      const probs = expLogits.map(v => v / expSum);

      // Probabilistic sampling from distribution
      const r = Math.random();
      let cumulativeSum = 0;
      let chosenIdx = 0;
      
      for (let i = 0; i < V; i++) {
        cumulativeSum += probs[i];
        if (r <= cumulativeSum) {
          chosenIdx = i;
          break;
        }
      }

      const predictedToken = this.vocab[chosenIdx];
      sequence.push(deserializeNote(predictedToken));
    }

    return sequence;
  }
}

/**
 * ==========================================
 * MARKOV CHAIN MODEL IMPLEMENTATION (N-ORDER)
 * ==========================================
 */
export class MusicMarkovChain {
  // transition table: sequence of length N -> Map of follower-note token -> transition count
  public transitionTable: Map<string, Map<string, number>> = new Map();
  public vocab: string[] = [];

  constructor(public order: number = 2) {}

  /**
   * Learns n-gram mappings from the input note dataset
   */
  public learn(notes: NoteEvent[]): void {
    this.transitionTable.clear();
    const uniqueVocab = new Set<string>();
    
    const tokens = notes.map(serializeNote);
    tokens.forEach(tok => uniqueVocab.add(tok));
    this.vocab = Array.from(uniqueVocab);

    if (tokens.length <= this.order) {
      return; // Cannot acquire historical n-gram mappings
    }

    for (let i = 0; i < tokens.length - this.order; i++) {
      const history = tokens.slice(i, i + this.order).join("|");
      const follower = tokens[i + this.order];

      if (!this.transitionTable.has(history)) {
        this.transitionTable.set(history, new Map());
      }
      
      const countsMap = this.transitionTable.get(history)!;
      countsMap.set(follower, (countsMap.get(follower) ?? 0) + 1);
    }
  }

  /**
   * Generates a sequences of musical notes based on learned probabilities
   */
  public generate(seedNotes: NoteEvent[], length: number, temperature: number = 1.0): NoteEvent[] {
    const sequence = [...seedNotes];
    
    if (this.vocab.length === 0) {
      return sequence;
    }

    // Standardize seed lengths
    while (sequence.length < this.order) {
      const idx = Math.floor(Math.random() * this.vocab.length);
      sequence.push(deserializeNote(this.vocab[idx]));
    }

    for (let step = 0; step < length; step++) {
      const history = sequence.slice(-this.order).map(serializeNote).join("|");
      let followerCounts = this.transitionTable.get(history);

      // Fallback: If unseen history occurs, fall back to lower order or random
      if (!followerCounts || followerCounts.size === 0) {
        // Fallback: find any history in transition tables that matches the final note
        const lastToken = serializeNote(sequence[sequence.length - 1]);
        const keys = Array.from(this.transitionTable.keys());
        const partialMatches = keys.filter(k => k.endsWith(lastToken));

        if (partialMatches.length > 0) {
          const matchKey = partialMatches[Math.floor(Math.random() * partialMatches.length)];
          followerCounts = this.transitionTable.get(matchKey);
        }
      }

      // If we still can't match any history, choose completely at random to prevent stuck generation
      if (!followerCounts || followerCounts.size === 0) {
        const randomToken = this.vocab[Math.floor(Math.random() * this.vocab.length)];
        sequence.push(deserializeNote(randomToken));
        continue;
      }

      // Apply counts and weight them with temperature
      const candidates = Array.from(followerCounts.keys());
      const rawCounts = candidates.map(cand => followerCounts!.get(cand) ?? 1);

      // Apply basic temperature scaling to counts
      // Low temp makes most likely transition dominate, high temp levels counts
      const temp = Math.max(0.1, Math.min(temperature, 2.5));
      const adjustedLoss = rawCounts.map(count => Math.pow(count, 1 / temp));
      const lossSum = adjustedLoss.reduce((a, b) => a + b, 0);
      const probs = adjustedLoss.map(val => val / lossSum);

      // Sample a candidate note
      const r = Math.random();
      let cumSum = 0;
      let chosenToken = candidates[0];

      for (let i = 0; i < candidates.length; i++) {
        cumSum += probs[i];
        if (r <= cumSum) {
          chosenToken = candidates[i];
          break;
        }
      }

      sequence.push(deserializeNote(chosenToken));
    }

    return sequence;
  }
}

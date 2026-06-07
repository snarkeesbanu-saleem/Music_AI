/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteEvent } from "../types";

/**
 * Encodes a list of NoteEvents into a binary Standard MIDI File (Format 0)
 * MIDI clock division: 128 ticks per quarter note
 * Since our steps represent 16th notes, 1 step = 32 MIDI ticks (128 / 4).
 */
export function buildMidiFileBytes(notes: NoteEvent[]): Uint8Array {
  const TICKS_PER_STEP = 32; // 1 step = 16th note = 32 ticks
  const bytes: number[] = [];

  // Helper: push strings as chars
  const pushString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
  };

  // Helper: push 32-bit int as 4 bytes
  const pushInt32 = (val: number) => {
    bytes.push((val >> 24) & 0xff);
    bytes.push((val >> 16) & 0xff);
    bytes.push((val >> 8) & 0xff);
    bytes.push(val & 0xff);
  };

  // Helper: push 16-bit int as 2 bytes
  const pushInt16 = (val: number) => {
    bytes.push((val >> 8) & 0xff);
    bytes.push(val & 0xff);
  };

  // Helper: write variable-length quantity (for delta-times in MIDI)
  const pushVarLen = (val: number) => {
    let buffer = val & 0x7f;
    let temp = val;
    const stack: number[] = [];
    
    while ((temp >>= 7) > 0) {
      buffer <<= 8;
      buffer |= (temp & 0x7f) | 0x80;
    }
    
    while (true) {
      stack.push(buffer & 0xff);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }
    
    bytes.push(...stack);
  };

  // === 1. HEADER CHUNK (MThd) ===
  pushString("MThd");
  pushInt32(6); // length of header (six bytes)
  pushInt16(0); // format 0 (single track)
  pushInt16(1); // 1 track
  pushInt16(128); // ticks per quarter note (0x0080)

  // === 2. TRACK DATA BUILD ===
  const trackBytes: number[] = [];
  
  // Track helper: write delta-time and bytes
  const writeMidiEvent = (deltaTime: number, eventBytes: number[]) => {
    // Write delta time
    let buffer = deltaTime & 0x7f;
    let temp = deltaTime;
    const stack: number[] = [];
    
    while ((temp >>= 7) > 0) {
      buffer <<= 8;
      buffer |= (temp & 0x7f) | 0x80;
    }
    
    while (true) {
      stack.push(buffer & 0xff);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }
    
    trackBytes.push(...stack);
    trackBytes.push(...eventBytes);
  };

  // Set tempo meta event: 120 BPM (500,000 microseconds per quarter note)
  // Delta time 0
  // FF 51 03 (3 bytes of tempo: 07 A1 20)
  writeMidiEvent(0, [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]);

  // Track name meta-event for display inside DAW
  // FF 03 (length) string
  const trackName = "AI Generated Melody";
  const nameBytes = [0xff, 0x03, trackName.length];
  for (let i = 0; i < trackName.length; i++) {
    nameBytes.push(trackName.charCodeAt(i));
  }
  writeMidiEvent(0, nameBytes);

  let accumulatedDelta = 0; // accumulated silence/rests in ticks
  let currentActiveNote: number | null = null;

  for (const note of notes) {
    const durationTicks = note.duration * TICKS_PER_STEP;

    if (note.pitch === 0) {
      // It is a rest. Just add the duration of the rest to our silent accumulator
      accumulatedDelta += durationTicks;
    } else {
      // If we have an active playing note on format 0, turn it off first
      if (currentActiveNote !== null) {
        // Delta time is 0 because it ends right now relative to previous timing markers
        writeMidiEvent(0, [0x80, currentActiveNote, 0x00]); // note off velocity 0
      }

      // Start the new Note event.
      // Delta-time is the accumulated silence since the last note ended
      writeMidiEvent(accumulatedDelta, [0x90, note.pitch, 0x60]); // note on velocity 96
      accumulatedDelta = durationTicks; // the next event will happen after this pitch terminates
      currentActiveNote = note.pitch;
    }
  }

  // Finalize: turn off the last active note
  if (currentActiveNote !== null) {
    writeMidiEvent(accumulatedDelta, [0x80, currentActiveNote, 0x00]);
    accumulatedDelta = 0;
  }

  // End of Track meta event (FF 2F 00)
  writeMidiEvent(accumulatedDelta, [0xff, 0x2f, 0x00]);

  // === 3. WRITE TRACK CHUNK (MTrk) ===
  pushString("MTrk");
  pushInt32(trackBytes.length);
  bytes.push(...trackBytes);

  return new Uint8Array(bytes);
}

/**
 * Triggers a browser file download for a generated note sequence
 */
export function downloadMidiFile(notes: NoteEvent[], filename: string = "ai-melody.mid"): void {
  const bytes = buildMidiFileBytes(notes);
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SongCorpus } from "../types";

export const PREDEFINED_SONGS: SongCorpus[] = [
  {
    id: "bach-minuet",
    title: "Bach's Minuet in G Major",
    genre: "classical",
    description: "An elegant, scalar, steady 3/4 classical melody demonstrating beautiful voice leading and arches.",
    notes: [
      { pitch: 62, duration: 4, name: "D4" }, // Quarter Note D
      { pitch: 67, duration: 2, name: "G4" }, // Eighth G
      { pitch: 69, duration: 2, name: "A4" }, // Eighth A
      { pitch: 71, duration: 2, name: "B4" }, // Eighth B
      { pitch: 72, duration: 2, name: "C5" }, // Eighth C
      { pitch: 74, duration: 4, name: "D5" }, // Quarter D
      { pitch: 67, duration: 4, name: "G4" }, // Quarter G
      { pitch: 67, duration: 4, name: "G4" }, // Quarter G
      { pitch: 76, duration: 4, name: "E5" }, // Quarter E
      { pitch: 72, duration: 2, name: "C5" }, // Eighth C
      { pitch: 74, duration: 2, name: "D5" }, // Eighth D
      { pitch: 76, duration: 2, name: "E5" }, // Eighth E
      { pitch: 78, duration: 2, name: "F#5" }, // Eighth F#
      { pitch: 79, duration: 4, name: "G5" }, // Quarter G
      { pitch: 67, duration: 4, name: "G4" }, // Quarter G
      { pitch: 67, duration: 4, name: "G4" }, // Quarter G
      { pitch: 71, duration: 4, name: "B4" }, // Quarter B
      { pitch: 74, duration: 2, name: "D5" }, // Eighth D
      { pitch: 72, duration: 2, name: "C5" }, // Eighth C
      { pitch: 71, duration: 4, name: "B4" }, // Quarter B
      { pitch: 69, duration: 2, name: "A4" }, // Eighth A
      { pitch: 71, duration: 2, name: "B4" }, // Eighth B
      { pitch: 72, duration: 2, name: "C5" }, // Eighth C
      { pitch: 71, duration: 2, name: "B4" }, // Eighth B
      { pitch: 69, duration: 4, name: "A4" }, // Quarter A
      { pitch: 62, duration: 4, name: "D4" }, // Quarter D
      { pitch: 64, duration: 2, name: "E4" }, // Eighth E
      { pitch: 66, duration: 2, name: "F#4" }, // Eighth F#
      { pitch: 67, duration: 4, name: "G4" }, // Quarter G
      { pitch: 62, duration: 4, name: "D4" }, // Quarter D
      { pitch: 67, duration: 4, name: "G4" }  // Quarter G
    ]
  },
  {
    id: "ode-to-joy",
    title: "Beethoven's Ode to Joy",
    genre: "folk",
    description: "A simple, scalar, highly structured melody. A perfect baseline dataset that trains very quickly.",
    notes: [
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 62, duration: 4, name: "D4" },
      { pitch: 60, duration: 4, name: "C4" },
      { pitch: 60, duration: 4, name: "C4" },
      { pitch: 62, duration: 4, name: "D4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 64, duration: 6, name: "E4" },
      { pitch: 62, duration: 2, name: "D4" },
      { pitch: 62, duration: 8, name: "D4" },
      // Phrase 2
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 62, duration: 4, name: "D4" },
      { pitch: 60, duration: 4, name: "C4" },
      { pitch: 60, duration: 4, name: "C4" },
      { pitch: 62, duration: 4, name: "D4" },
      { pitch: 64, duration: 4, name: "E4" },
      { pitch: 62, duration: 6, name: "D4" },
      { pitch: 60, duration: 2, name: "C4" },
      { pitch: 60, duration: 8, name: "C4" }
    ]
  },
  {
    id: "jazz-blues",
    title: "Autumn Jazz Blues Vibe",
    genre: "jazz",
    description: "A syncopated, expressive minor jazz melody containing wider leaps, swings, and minor-blues chromaticism.",
    notes: [
      { pitch: 62, duration: 2, name: "D4" },
      { pitch: 65, duration: 2, name: "F4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 0,  duration: 4, name: "Rest" }, // Syncopation
      { pitch: 70, duration: 2, name: "Bb4" },
      { pitch: 69, duration: 2, name: "A4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 62, duration: 8, name: "D4" },
      { pitch: 0,  duration: 4, name: "Rest" },
      { pitch: 67, duration: 2, name: "G4" },
      { pitch: 69, duration: 2, name: "A4" },
      { pitch: 70, duration: 4, name: "Bb4" },
      { pitch: 72, duration: 4, name: "C5" },
      { pitch: 74, duration: 4, name: "D5" },
      { pitch: 77, duration: 4, name: "F5" },
      { pitch: 74, duration: 8, name: "D5" },
      { pitch: 72, duration: 2, name: "C5" },
      { pitch: 70, duration: 2, name: "Bb4" },
      { pitch: 67, duration: 4, name: "G4" },
      { pitch: 65, duration: 4, name: "F4" },
      { pitch: 62, duration: 8, name: "D4" }
    ]
  },
  {
    id: "chiptune-retro",
    title: "8-Bit Arcade Jump & Theme",
    genre: "chiptune",
    description: "A fast-paced, high-pass retro chiptune melody with rapid leaps, 16th-note arpeggios, and dense notes.",
    notes: [
      { pitch: 60, duration: 1, name: "C4" },
      { pitch: 64, duration: 1, name: "E4" },
      { pitch: 67, duration: 1, name: "G4" },
      { pitch: 72, duration: 1, name: "C5" },
      { pitch: 60, duration: 1, name: "C4" },
      { pitch: 64, duration: 1, name: "E4" },
      { pitch: 67, duration: 1, name: "G4" },
      { pitch: 72, duration: 1, name: "C5" },
      { pitch: 62, duration: 2, name: "D4" },
      { pitch: 66, duration: 2, name: "F#4" },
      { pitch: 69, duration: 2, name: "A4" },
      { pitch: 74, duration: 2, name: "D5" },
      { pitch: 67, duration: 1, name: "G4" },
      { pitch: 71, duration: 1, name: "B4" },
      { pitch: 74, duration: 1, name: "D5" },
      { pitch: 79, duration: 1, name: "G5" },
      { pitch: 79, duration: 2, name: "G5" },
      { pitch: 76, duration: 2, name: "E5" },
      { pitch: 74, duration: 2, name: "D5" },
      { pitch: 72, duration: 2, name: "C5" },
      { pitch: 67, duration: 8, name: "G4" }
    ]
  }
];

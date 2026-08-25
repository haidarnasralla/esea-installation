# Model Collapse Installation — Project Notes

## Concept

The interaction data of workshop participants with a local chatbot is collected. The text is processed and resynthesised in a generative audiovisual installation, where human language slowly decays into incoherent machine chatter—gesturing toward questions of privacy, digital persistence, and what remains of human intent once it is processed by a machine.

**Display:** 72" TV with headphones

## Core Mechanics

### Text Display
- Snippets appear at random screen positions
- Typewriter effect (character by character)
- Random font selection from curated pool (monospace, sans-serif, serif)
- Fade out after holding

### Scheduling
- Poisson process for snippet arrivals
- Gives organic but statistically regular timing
- Configurable λ (arrival rate) controls density
- Formula: `nextDelay = -Math.log(Math.random()) / lambda * 1000`

### TTS
- Each snippet is spoken aloud as it appears
- Random voice selection (English only)
- Slight variation in rate and pitch

## Simulating Collapse (Design Notes)

Markov chain approach—more tractable than actual model training and more legible as art.

### Original Staged Degradation Concept
1. **Verbatim excerpts** from corpus
2. **Sentence-level Markov** (order 4-5 words) — still coherent-ish
3. **Word-level Markov** (order 2-3) — grammatical but nonsensical
4. **Word-level Markov** (order 1) — word salad
5. **Character-level Markov** (order 5-6) — almost words
6. **Character-level Markov** (order 2-3) — phonetic mush
7. **Character-level Markov** (order 1) — random characters

### Implemented Version
See "Degradation Cycle (Implemented)" section below for the actual implementation, which uses a finer-grained order progression (10 → 1) and introduces a mixed mode where word and character generation coexist.

---

## Technical Issues & Solutions

### Framework Choice

**Issue:** Is React appropriate?

**Decision:** Skipped React entirely. Canvas with vanilla JS gives direct pixel control without DOM reconciliation overhead. React's value is in managing complex UI state—if the core experience is "one big animation," you pay the abstraction cost without benefit.

**Alternatives considered:**
- p5.js — designed for creative coding
- Three.js — if 3D needed later
- Svelte — lighter than React

---

### TTS Options

#### Web Speech API (current)
Built into all modern browsers, uses OS native voices.

**Pros:**
- Zero setup, works immediately
- Multiple voices per OS (macOS ~70+, fewer on Windows/Linux)
- Control over rate, pitch, volume
- Free and offline

**Cons:**
- Voice quality varies by OS
- Linux (Debian) defaults to espeak—very robotic
- Chrome requires user interaction to start
- **Cannot play multiple voices simultaneously** — utterances queue

#### Piper TTS (recommended for production)
Lightweight neural TTS, runs on CPU, even on Raspberry Pi.

**Pros:**
- Good quality voices
- ~50MB binary, 15-100MB per voice
- Faster than real-time on modest hardware
- Fully offline

**Cons:**
- Separate service to run alongside the installation
- More setup than Web Speech API

**Setup:**
```bash
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
tar -xzf piper_amd64.tar.gz

# Download voice
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

echo "Hello world" | ./piper --model en_US-lessac-medium.onnx --output_file test.wav
```

**Integration options:**
1. Run as HTTP server, fetch audio from JS
2. Pre-generate audio for corpus snippets
3. Node server that shells out to binary

#### Linux Voice Packages
If sticking with Web Speech API on Debian:
```bash
sudo apt install festival festvox-kallpc16k  # Festival
sudo apt install espeak-ng                    # eSpeak (default, robotic)
sudo apt install libttspico-utils             # Pico TTS (decent)
sudo apt install flite                        # CMU Flite
```

---

### Simultaneous Voice Playback

**Issue:** Web Speech API queues utterances—only one voice at a time.

**Solutions:**

1. **Web Audio API** — Generate audio buffers, play independently. Full control but requires audio files.

2. **Multiple iframes** — Each has own `speechSynthesis` context. Hacky.

3. **Piper + audio elements** — Generate WAV files, play as `<audio>` or via Web Audio. Multiple elements can overlap.

**Recommendation:** Move to audio-file-based approach (Piper) for overlapping voices, spatialization, and effects.

---

### Font Selection

Curated pool mixing human and machine aesthetics:

```js
const FONTS = [
  // Monospace (machine/terminal)
  'Courier New, monospace',
  'Monaco, monospace',
  'SF Mono, monospace',
  // Sans-serif (clinical/neutral)
  'Helvetica, Arial, sans-serif',
  'SF Pro, system-ui, sans-serif',
  // Serif (human/literary)
  'Georgia, serif',
  'Times New Roman, serif',
  'Palatino, serif',
];
```

**For later collapse stages:** Could introduce expressive/unusual fonts (Comic Sans, Impact, system emoji) as decay progresses.

---

## Current Implementation

### Files
- `index.html` — Fullscreen black canvas + control panel overlay
- `main.js` — Poisson scheduler, typewriter rendering, TTS, degradation integration
- `corpus/corpus.txt` — Source text (one sentence per line)
- `processes/markov-generator.js` — Flexible n-gram generator (word and character level)
- `processes/degradation-cycle.js` — State machine for phase progression

### Configuration (in main.js)
```js
const CONFIG = {
  lambda: 0.5,           // snippets per second (average)
  minFontSize: 16,
  maxFontSize: 48,
  minCharDelay: 30,      // ms between characters
  maxCharDelay: 80,
  holdDuration: 3,       // seconds after typing completes
  fadeOutDuration: 2,
  minSnippetWords: 6,    // for word-level Markov
  maxSnippetWords: 11,
  minSnippetChars: 20,   // for character-level Markov
  maxSnippetChars: 60,
};
```

### Running
```bash
npx serve .
# or
python3 -m http.server 8000
```

---

## Degradation Cycle (Implemented)

The text degradation now follows a one-way journey into entropy, controlled manually via a step button (timer to be added later).

### Phases

1. **Verbatim** — Exact lines from corpus, unchanged
2. **Word Markov (order 10 → 6)** — Snippets of 6-11 words, order decreases by 1 each step
3. **Mixed Mode (word 5 → 1, char 10 → 1)** — Once word order hits 5, character-level becomes available. Each snippet randomly selects between:
   - Word-level (6-11 words) at current word order
   - Character-level (20-60 chars) at current char order
   - Both orders decrease by 1 each step
   - Word-level drops out after order 1
4. **Character Only** — Character order continues decreasing toward 1
5. **Final State** — Character-level order 1, stays here forever (maximum entropy)

### Files

- `processes/degradation-cycle.js` — State machine managing phase transitions
- `processes/markov-generator.js` — Flexible n-gram generator (word and character level)
- `main.js` — Integrates cycle with text generation and UI
- `index.html` — Control panel overlay showing current phase/orders

### Control Panel

Displays:
- Current phase
- Word order (10 → 1)
- Character order (10 → 1)
- Whether character mode is active
- Human-readable description

Press "Step →" to advance through the cycle. Button disables at final state.

### Corpus Format

One sentence per line in `corpus/corpus.txt`. This format works for both verbatim extraction (whole lines) and Markov training (full text).

### Visual Entropy Effects (Implemented)

As degradation progresses, visual glitch effects intensify:

**Flicker Effects:**
| Effect | Description | Range |
|--------|-------------|-------|
| Flicker | Full frame skip | 0→15% |
| Fade Flicker | Partial opacity drop (30-80%) | 0→20% |
| Inverse | Black text on white flash | 0→8% |

**Color Effects:**
| Effect | Description | Range |
|--------|-------------|-------|
| Chromatic Aberration | RGB channel offset | 0→5px |
| Color Shift | Random color (red, cyan, magenta, green, yellow) | 0→18% |
| Bit Crush | Posterized grayscale flash | 0→12% |

**Corruption Effects:**
| Effect | Description | Range |
|--------|-------------|-------|
| Character Dropout | Random chars become spaces | 0→25% |
| Duplicate Ghost | Faint offset copy | 0→35% |
| Slice Displacement | Horizontal slices offset | 0→20% |
| Noise Overlay | Static/grain on canvas | 0→50% |

All effects scale with degradation phase, starting at 0 in verbatim and reaching maximum in final state.

---

## Planned Features

### Spawn Rate Scaling

λ (spawn rate) increases with degradation phase — fewer snippets early, more towards the end.

| Phase | λ | Avg interval |
|-------|---|--------------|
| Verbatim | 0.25 | ~4s |
| Word 10→6 | 0.3→0.5 | ~3.3→2s |
| Mixed | 0.6→0.9 | ~1.7→1.1s |
| Char only | 1.0→1.3 | ~1→0.8s |
| Final | 1.5 | ~0.7s |

---

## Next Steps

1. ~~Integrate Markov generator~~ ✓
2. ~~Spawn rate scaling~~ ✓
3. ~~Visual entropy effects~~ ✓
4. ~~Time-based auto-stepping~~ ✓
5. **Piper integration** — Better voices, simultaneous playback
6. **Voice degradation** — Match audio quality to text collapse stage

---

## Environment Modes

Edit `config.js` to switch between modes:

```js
MODE: 'test',       // dashboard visible, manual stepping
MODE: 'production', // dashboard hidden, time-based auto-stepping
```

### Test Mode
- Control panel visible in top-right
- Click "Step →" to advance through degradation cycle
- All effect values displayed in real-time

### Production Mode
- Control panel hidden
- Automatically calculates current step based on time
- Syncs every 60 seconds to stay on schedule
- Survives restarts (recalculates from installation start time)

---

## Time-based Auto-stepping (Implemented)

Installation runs Tuesday 9am → Saturday 6pm (~105 hours), with accelerating decay.

### Configuration (in config.js)

```js
INSTALLATION: {
  startTime: '2026-09-01T09:00:00',  // Tuesday 9am
  endTime: '2026-09-05T18:00:00',    // Saturday 6pm
  totalSteps: 20,
  syncInterval: 60000, // recalculate every 60 seconds
}
```

### Pacing (accelerating decay)

Early steps take longer, later steps happen faster — mimics real entropy/collapse.

| Day | Cumulative Hours | Steps | Phase |
|-----|------------------|-------|-------|
| Tue | 0-10 | 0-1 | Verbatim, Word 10 |
| Wed | 10-20 | 2-4 | Word 9-7 |
| Thu | 20-30 | 5-8 | Word 6, Mixed begins |
| Fri | 30-40 | 9-14 | Mixed deepens |
| Sat | 40-50 | 15-20 | Char only → Final |

### Easing function

Quadratic ease-in: `progress² × totalSteps`

### Edge cases

- Before start time → stay at step 0 (verbatim)
- After end time → stay at final step (maximum entropy)
- Computer turned off overnight → catches up on next startup

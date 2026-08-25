# Eventually, the Machines Speak Without Us

## Concept

The interaction data of workshop participants with a local chatbot is collected. The text is processed and resynthesised in a generative audiovisual installation, where human language slowly decays into incoherent machine chatter—gesturing toward questions of privacy, digital persistence, and what remains of human intent once it is processed by a machine.

**Display:** 72" TV with headphones

## Core Mechanics

### Text Display
- Snippets appear at random screen positions
- Typewriter effect (character by character)
- Random font selection from curated pool (monospace, sans-serif, serif)
- Flicker-out effect when disappearing (intensity scales with degradation)

### Scheduling
- Poisson process for snippet arrivals
- Gives organic but statistically regular timing
- Configurable λ (arrival rate) controls density
- Formula: `nextDelay = -Math.log(Math.random()) / lambda * 1000`

### TTS
- Hybrid TTS system combining human-recorded LPC voices with SAM (Software Automatic Mouth)
- Early phases: Human voices (Daniel, Samantha, Whisper) encoded as LPC
- Late phases: SAM synthetic voice takes over completely
- Stereo panning matches text position on screen
- Volume scales with text size (larger = louder)
- Audio chain includes limiter to prevent distortion

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

#### Hybrid TTS (current — default)

Combines three TTS technologies with a fallback chain:

1. **LPC Voices (Daniel, Samantha, Whisper)** — Human speech recorded via macOS `say`, encoded to TMS5220 LPC bitstreams
2. **SAM (Software Automatic Mouth)** — 1982 Commodore 64 speech synthesizer, JavaScript port
3. **Fallback chain:** Primary LPC voice → Other LPC voices → SAM

**Voice Transition:**
| Progress | LPC Probability | Behavior |
|----------|-----------------|----------|
| 0–20% | 100% | Pure LPC (human voices) |
| 20–50% | 100% → 70% | LPC dominant, occasional SAM |
| 50–80% | 70% → 10% | SAM taking over |
| 80–100% | 10% → 0% | Pure SAM (robotic/glitchy) |

**SAM Voice Degradation:**
- Early: Varied human-like voices (female pitch 100-150, male 70-100, child 140-180)
- Mid: Blending toward robotic monotone
- Late: Extreme/glitchy parameters with stutter and noise effects

#### LPC Vocabulary Build

Pre-encode corpus words with macOS voices:

```bash
# Prerequisites
brew install ffmpeg
python3 -m venv /tmp/esea-venv
cd /tmp && git clone https://github.com/ptwz/python_wizard.git
cd /tmp/python_wizard && /tmp/esea-venv/bin/pip install .

# Build vocabulary (takes ~90 minutes for 3 voices × 2000 words)
caffeinate -i ./scripts/build-vocab.sh
```

**Output:**
- `build/voices/Daniel.js` — ~1.4MB
- `build/voices/Samantha.js` — ~1.3MB  
- `build/voices/Whisper.js` — ~1.6MB

Each file: `export default { 'word': [0x00, 0x01, ...], ... }`

#### SAM (Software Automatic Mouth)

1982 C64 speech synthesizer — perfect period-accurate robotic voice.

**Voice Parameters:**
| Parameter | Range | Effect |
|-----------|-------|--------|
| speed | 1-255 | Speech rate |
| pitch | 1-255 | Voice frequency |
| throat | 1-255 | Resonance |
| mouth | 1-255 | Formant shaping |

**Presets:**
- Female: pitch 100-150, throat 120-145, mouth 128-155
- Male: pitch 70-100, throat 115-140, mouth 110-135
- Child: pitch 140-180, throat 130-155, mouth 140-170
- Robot: pitch 64, throat 180, mouth 180

#### Audio Routing

```
source → snippetGain → panner → masterGain → limiter → destination
```

- **snippetGain:** Per-snippet volume (font size → 0.4–1.0)
- **panner:** StereoPanner, position from text center (-1 left, +1 right)
- **masterGain:** Global volume control
- **limiter:** DynamicsCompressor (threshold -6dB, ratio 20:1)

#### Piper TTS (alternative)
Lightweight neural TTS, runs on CPU, even on Raspberry Pi. Could be used if more natural speech is desired.

**Setup:**
```bash
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
tar -xzf piper_amd64.tar.gz

# Download voice
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

echo "Hello world" | ./piper --model en_US-lessac-medium.onnx --output_file test.wav
```

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

### File Structure
```
├── index.html                    — Fullscreen canvas + control panel
├── config.js                     — Environment mode, TTS engine selection
├── main.js                       — Entry point, init, render loop
├── corpus.js                     — CORPUS array (inlined text)
├── lib/
│   ├── renderer.js               — Rendering, glitch effects, flicker-out
│   ├── collision.js              — Position finding, overlap detection
│   ├── tts.js                    — TTS router (hybrid/sam/lpc)
│   ├── hybrid-tts.js             — Hybrid TTS (LPC + SAM fallback)
│   ├── sam-synth.js              — SAM wrapper with Web Audio
│   ├── formant-synth.js          — LPC decoder and TMS5100 synthesizer
│   └── vendor/
│       └── sam.js                — SAM.js library (v0.3.0)
├── build/
│   └── voices/                   — Generated LPC vocabulary
│       ├── Daniel.js
│       ├── Samantha.js
│       └── Whisper.js
├── scripts/
│   └── build-vocab.sh            — LPC vocabulary encoder
└── processes/
    ├── degradation-cycle.js      — State machine, voice params, effects
    └── markov-generator.js       — Word and character level n-grams
```

### Configuration (in main.js)
```js
const CONFIG = {
  // Snippet appearance
  minFontSize: 16,
  maxFontSize: 48,
  color: 'rgba(240, 238, 235, 1)',
  minOpacity: 0.6,
  maxOpacity: 1.0,
  
  // Layout
  lineHeightMultiplier: 1.2,
  edgePadding: 20,
  
  // Typewriter timing
  minCharDelay: 80,
  maxCharDelay: 150,
  
  // Lifespan
  holdDuration: 3,
  // flickerOutDuration controlled by DegradationCycle
  
  // Markov snippet length
  minSnippetWords: 6,
  maxSnippetWords: 11,
  minSnippetChars: 20,
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

### State Machine

`processes/degradation-cycle.js` — Manages phase transitions and effect intensity scaling

### Control Panel

Displays:
- Current phase
- Word order (10 → 1)
- Character order (10 → 1)
- Whether character mode is active
- Human-readable description

Press "Step →" to advance through the cycle. Button disables at final state.

### Corpus

Text is inlined in `corpus.js` as an array for reliability during the installation (no file loading). Format: one sentence per array element.

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
5. ~~Modular code structure~~ ✓
6. ~~Flicker-out effect~~ ✓
7. ~~LPC speech synthesis~~ ✓
8. ~~Voice degradation~~ ✓ (human → robot → glitchy)
9. ~~Hybrid TTS (LPC + SAM)~~ ✓
10. ~~Stereo panning~~ ✓ (position-based)
11. ~~Volume scaling~~ ✓ (font size-based)
12. ~~Audio limiter~~ ✓
13. **Production testing** — Full run-through with real corpus
14. **Performance optimization** — Profile and optimize if needed

---

## Flicker-Out Effect (Implemented)

Replaced smooth fade-out with a glitchy "flicker away" effect for text disappearance. Text now fights to stay visible before vanishing.

### How It Works

Each frame during the flicker-out phase:
1. Calculate `progress` (0→1 over the duration)
2. `visibilityThreshold = (1 - progress) * (1 - intensity * 0.3)`
3. Roll `Math.random()` — if above threshold, skip rendering (invisible this frame)
4. If visible: apply jitter, then either render normally or with character scatter
5. Occasionally render ghost flashes when invisible

**Key design:** Pure random each frame — no rhythmic patterns. Early in flicker-out: mostly visible with occasional dropout. Late: mostly invisible with rare flashes.

### Parameters (scale with degradation phase)

| Parameter | Verbatim | Final | Description |
|-----------|----------|-------|-------------|
| Duration | 0.4s | 2.0s | How long the flicker phase lasts |
| Intensity | 20% | 100% | Controls visibility decay rate |
| Character Scatter | 0% | 90% | Individual chars disappear at different times |
| Jitter | 0px | 12px | Position shake during flicker |

**Note:** Flicker duration is captured at snippet spawn time, not when flickering starts. This means a snippet born at step 5 will use step-5 parameters for its death animation, even if degradation advances while it's alive. This is intentional — each snippet carries its "birth" characteristics throughout its lifecycle, creating a smoother visual blend during transitions.

### Files Modified
- `processes/degradation-cycle.js` — Added `getFlickerOutDuration()`, `getFlickerOutIntensity()`, `getCharacterScatter()`, `getFlickerJitter()`
- `lib/renderer.js` — Added `renderFlickerOut()` function
- `main.js` — Changed snippet state from `fading` to `flickering`
- `index.html` — Added "Flicker-Out (Disappearance)" section to control panel

---

## LPC Speech Synthesis

### TMS5100 Decoder (formant-synth.js)

Custom implementation of Texas Instruments TMS5100 algorithm (Speak & Spell chip).

**How it works:**
1. **Excitation source:** Chirp waveform (voiced) or LFSR noise (unvoiced)
2. **10-pole lattice filter:** Shapes excitation using reflection coefficients K1-K10
3. **Frame-based:** Parameters update every 25ms (200 samples at 8kHz)
4. **Vocabulary:** Built-in Talkie library words + custom LPC-encoded corpus

### Built-in Vocabulary

~112 common English words from Talkie library (GPLv2):
`the`, `a`, `is`, `to`, `in`, `for`, `on`, `at`, `from`, `by`, `i`, `you`, `not`, `all`, `have`, `go`, `no`, etc.

### Custom LPC Vocabulary

Full corpus encoded with macOS voices via `scripts/build-vocab.sh`:

1. Extract unique words from `corpus.js`
2. Synthesize each word with `say -v Daniel/Samantha/Whisper`
3. Convert to 8kHz mono WAV with `ffmpeg`
4. Encode to TMS5220 LPC with `python_wizard`
5. Output as JavaScript modules

**Voices available:** Daniel (British male), Samantha (US female), Whisper (breathy)

### Typing Synchronization

Speech is pre-rendered when a snippet spawns, then played back at a rate adjusted to match the typing duration:

```js
const typingDuration = (text.length * charDelay) / 1000;
speakOverDuration(text, typingDuration, { voiceMix, samVoiceParams, pan, volume });
```

---

## Hybrid TTS System (Implemented)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    hybrid-tts.js                        │
├─────────────────────────────────────────────────────────┤
│  For each word in phrase:                               │
│    1. Try primary LPC voice (Daniel/Samantha/Whisper)   │
│    2. Try other LPC voices                              │
│    3. Fall back to SAM                                  │
│                                                         │
│  Voice selection based on degradation progress:         │
│    - getVoiceMix() returns { lpcProbability }           │
│    - getVoiceParams() returns SAM parameters            │
└─────────────────────────────────────────────────────────┘
```

### Configuration (config.js)

```js
// TTS Engine Selection
// - 'hybrid': LPC voices with SAM fallback (default)
// - 'sam': SAM only (Software Automatic Mouth)
// - 'lpc': LPC only (TMS5100/Speak&Spell style)
TTS_ENGINE: 'hybrid',
```

### Spatial Audio

- **Stereo panning:** Text center X position → pan (-1 left to +1 right)
- **Volume:** Font size maps to volume (16px → 40%, 48px → 100%)
- **Limiter:** DynamicsCompressor prevents clipping with multiple voices

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

Installation runs continuously from **Tuesday 25 Aug 5pm → Saturday 29 Aug 5pm** (96 hours total).

### Configuration (in config.js)

```js
INSTALLATION: {
  startTime: '2026-08-25T17:00:00+01:00',  // Tuesday 5pm BST
  endTime: '2026-08-29T17:00:00+01:00',    // Saturday 5pm BST
  totalSteps: 20,
  syncInterval: 60000,
}
```

### Timing Model

Simple continuous elapsed time calculation:
- Uses ISO 8601 timestamps with timezone for reliability
- No gallery hours complexity — degradation progresses 24/7
- Quadratic easing (accelerating decay): `progress²` maps elapsed time to steps
- Computer restarts automatically recalculate correct position

### Pacing (accelerating decay)

Quadratic easing across 96 hours. Early hours are slow, later hours accelerate.

| Day | Time | Cumulative Hours | Steps | Phase |
|-----|------|------------------|-------|-------|
| Tue | 5pm–midnight | 0–7 | 0–0 | Verbatim |
| Wed | all day | 7–31 | 0–2 | Word 10–9 |
| Thu | all day | 31–55 | 2–6 | Word 8–6, Mixed begins |
| Fri | all day | 55–79 | 6–13 | Mixed deepens |
| Sat | midnight–5pm | 79–96 | 13–20 | Char only → Final |

### Edge cases

- Before Tue 25 Aug 5pm → stay at step 0
- After Sat 29 Aug 5pm → stay at step 20 (final)
- Computer restarted → recalculates from current time

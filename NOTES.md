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

---

## Planned Features

### LFO on Spawn Rate

Rather than a constant λ, modulate spawn rate with a low-frequency oscillator for organic breathing rhythm.

| LFO Parameter | Early Phases | Late Phases |
|---------------|--------------|-------------|
| Base λ | 0.3 | 1.5 |
| Amplitude | ±0.1 (subtle) | ±0.5 (dramatic swings) |
| Frequency | Slow (0.02 Hz, ~50s cycle) | Faster (0.1 Hz, ~10s cycle) |
| Waveform | Sine (gentle) | Could shift to square/irregular |

Implementation:
```js
getLambda(time) {
  const base = this.getBaseLambda();        // from phase
  const amplitude = this.getLfoAmplitude(); // grows with degradation
  const frequency = this.getLfoFrequency(); // speeds up with degradation
  
  const lfo = Math.sin(time * frequency * Math.PI * 2);
  return base + lfo * amplitude;
}
```

Could extend LFO modulation to other parameters: font size range, typewriter speed, hold duration, overlap tolerance.

### Visual Entropy Effects

As degradation progresses, introduce visual instability to the text:

**Flickering**
- Random opacity fluctuations
- Occasional brief disappearance (1-2 frames)
- Intensity increases with degradation

**Jittering**
- Small random position offsets each frame
- Could affect x, y, or both
- Amplitude increases: 0px → 1px → 3px → 5px+

**Other possibilities**
- Character-level jitter (each letter offset independently)
- Color shifts / chromatic aberration
- Blur pulses
- Glitch rectangles / scan lines
- Font switching mid-word (late stages)

**Implementation approach:**
Add per-snippet or global `getJitter()` and `getFlicker()` methods to DegradationCycle, apply in render loop:

```js
// In render loop
const jitter = cycle.getJitter();
const flicker = cycle.getFlicker();

const offsetX = (Math.random() - 0.5) * jitter;
const offsetY = (Math.random() - 0.5) * jitter;
const flickerOpacity = Math.random() > flicker ? 1 : 0;

ctx.globalAlpha = s.opacity * flickerOpacity;
ctx.fillText(visibleText, s.x + offsetX, s.y + offsetY);
```

---

## Next Steps

1. ~~Integrate Markov generator~~ ✓
2. **Add timed progression** — Replace manual stepping with configurable timer
3. **Piper integration** — Better voices, simultaneous playback
4. **Voice degradation** — Match audio quality to text collapse stage
5. **Collision detection** — Prevent text overlap (or embrace it?)

# Markov Chain Text Generator: Problem Statement & Research

## Problem Statement

Build a **flexible Markov chain text generator in JavaScript** that can:

1. **Ingest a corpus** from JSON (with flexible schema support for various formats)
2. **Operate in dual tokenization modes**: word-level and character-level, built simultaneously from the same corpus
3. **Provide a "chaos dial"** — a parameter that progressively degrades output from coherent text to fragmented nonsense by:
   - Injecting statistically unlikely tokens (wrong-word/wrong-character insertion)
   - Blending between word-level and character-level models mid-generation
   - Optionally ramping chaos over time within a single generation call

The goal is creative text generation where output can smoothly transition from recognizable language to abstract, glitchy fragments — useful for generative art, experimental writing, or data sonification.

---

## Core Algorithm: How Markov Chains Work

> **The "index card" mental model** (from the original prompt):
>
> Picture a box of index cards, one card per word. Every time you spot a word in the text, you look at whatever word comes right after it, and drop a sticky note with that next word onto that card's pile. Same word shows up again with the same follow-up? You don't count anything — you just toss on another identical sticky note. The pile just gets thicker.
>
> That's the entire "training" step. Now here's how you write something new with it: pick a card to start on, close your eyes, reach into its pile, and grab one sticky note at random. Whatever's written on it becomes your next word — and that word is now the card you go to next. Repeat.
>
> The clever part: since a popular next-word has more copies of its sticky note sitting in the pile, a blind grab is more likely to land on it — automatically. Nobody calculates a percentage anywhere. A thicker pile just wins more often. That's "duplicates = probability."

In code terms:
- **Model**: A `Map` from n-gram (tuple of n tokens) → array of tokens that followed it (duplicates preserved)
- **Training**: Slide a window over the corpus, recording what follows each n-gram
- **Generation**: Start with a seed n-gram, randomly sample from its followers, shift the window, repeat

An **n-gram** just means the "card label" can be more than one token — `("the", "cat")` instead of just `("the")`. Higher order = more context = more coherent (but less creative) output.

---

## Research: Existing Libraries

### Python

| Library | Key Features | Limitations |
|---------|--------------|-------------|
| **[markovify](https://github.com/jsvine/markovify)** | Most popular. Adjustable `state_size`, JSON export/import, overlap rejection, model combining with weights. | Word-level only by default. Can hack char-mode by pre-splitting text into single-character "words". |
| **[shmarkov.py](https://gist.github.com/aparrish/14cb94ce539a868e6b8714dd84003f06)** (Allison Parrish) | ~60 lines, token-agnostic (works on any sequence type). Supports `'char'` and `'word'` levels explicitly. Clean, educational. | No built-in persistence, no incremental training. |

### JavaScript

| Library | Key Features | Limitations |
|---------|--------------|-------------|
| **[js-markov](https://www.npmjs.com/package/js-markov)** | `setOrder(n)` to change n-gram size, `clearChain()` for retraining, works in browser and Node. Supports both text and numeric modes. | Word-level only for text mode. |
| **[markov-strings](https://www.npmjs.com/package/markov-strings)** | `stateSize` config, `.addData()` for incremental training, TypeScript types, `.export()`/`.import()` for persistence. Actively maintained. | Word-level only. |
| **[string-markov-js](https://www.npmjs.com/package/string-markov-js)** | Direct model inspection via `getPossibilities()`, manual editing via `updateGram()`, order passed per-train call. Originality checking. | Less maintained (7 years old). |

### Key Insight

> None of these libraries ship a built-in "letter cluster" mode — that granularity (syllable-ish chunks between single letters and full words) isn't a standard tokenization anyone's pre-built. But because the core Markov mechanism is agnostic to what a "token" is, the cleanest path is to write a custom tokenizer and feed the resulting array into a generic n-gram engine.

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MarkovGenerator                         │
├─────────────────────────────────────────────────────────────┤
│  constructor({ wordOrder = 2, charOrder = 5 })              │
│                                                             │
│  train(jsonCorpus)                                          │
│    └─> normalizeCorpus() → tokenize() → build both models   │
│                                                             │
│  generate({ length, chaos = 0, rampRate = 0, seed })        │
│    └─> walk word model, inject chaos:                       │
│        • random token substitution                          │
│        • drop into char-model for bursts                    │
│                                                             │
│  reset()                                                    │
│  toJSON() / fromJSON()                                      │
└─────────────────────────────────────────────────────────────┘
```

### Chaos Mechanism (Two Effects)

1. **Nonsensical** = wrong-token injection
   - At each step, roll against `chaos`: sometimes substitute a uniformly random token from the whole vocabulary instead of a statistically likely one

2. **Fragmented** = word breakdown
   - Also rolled against `chaos`: instead of emitting a clean predicted word, drop into the character-level model for a short burst, splicing letter sequences into the output

3. **Ramp over time** (optional)
   - `effectiveChaos = chaos + rampRate * tokensGenerated`
   - One passage can start coherent and visibly dissolve by the end

### Design Decision: Context Preservation

The word-level walk's context window keeps advancing using the *real* predicted word, even when the displayed output is corrupted. This keeps chaos a clean, reversible dial — turn it back to 0 mid-generation and output immediately recovers, rather than the model having permanently wandered off into a dead zone of unseen n-grams.

(Alternative: let corruption feed back into context so degradation compounds — valid but riskier.)

---

## References

### Primary Sources

1. **Allison Parrish — shmarkov.py**
   - https://gist.github.com/aparrish/14cb94ce539a868e6b8714dd84003f06
   - MIT License, ~60 lines, token-agnostic Markov chain implementation
   - Supports both `'char'` and `'word'` levels

2. **Allison Parrish — RWET Course (Reading and Writing Electronic Text)**
   - https://rwet.decontextualize.com/
   - NYU ITP course covering Markov chains, n-grams, and text generation

3. **Allison Parrish — Predictive Text Tutorial**
   - https://github.com/aparrish/predictive-text-and-text-generation
   - Jupyter notebook explaining Markov chains and Markovify usage

### Libraries

4. **markovify** (Python)
   - https://github.com/jsvine/markovify
   - MIT License, most popular Python Markov text library
   - Features: `state_size`, JSON export/import, model combining, overlap rejection

5. **js-markov** (JavaScript/npm)
   - https://www.npmjs.com/package/js-markov
   - MIT License, browser + Node compatible
   - Features: `setOrder()`, `clearChain()`, `getPossibilities()`

6. **markov-strings** (JavaScript/npm)
   - https://www.npmjs.com/package/markov-strings
   - MIT License, TypeScript, actively maintained
   - Features: `stateSize`, `.addData()`, `.export()`/`.import()`

7. **string-markov-js** (JavaScript/npm)
   - https://www.npmjs.com/package/string-markov-js
   - MIT License
   - Features: `getPossibilities()`, `updateGram()`, originality checking

### Background Reading

8. **Wikipedia — Markov chain**
   - https://en.wikipedia.org/wiki/Markov_chain
   - Formal definition: "A stochastic model describing a sequence of possible events in which the probability of each event depends only on the state attained in the previous event."

---

## Implementation Notes

### Corpus Normalization (Flexible JSON Ingestion)

```javascript
function normalizeCorpus(data) {
  // Handle various shapes:
  // - raw string
  // - array of strings
  // - array of objects with text/content/body field
  // - wrapper object like { documents: [...] }
  // TODO: per-document metadata (weighting, tagging)
  // TODO: streaming ingestion for huge corpora
}
```

### Tokenization

```javascript
function tokenize(text, mode) {
  // 'word': split on whitespace
  // 'char': Array.from(text) — handles Unicode correctly
  // TODO: 'cluster' mode for syllable-ish chunks
}
```

### Unicode Consideration

Use `Array.from(text)` rather than `text.split('')` for character tokenization — `split('')` breaks multi-byte Unicode (emoji, accented characters) into garbage half-characters, while `Array.from` splits on actual code points.

---

## Next Steps

1. Implement the `MarkovGenerator` class in JavaScript
2. Add flexible corpus ingestion with TODO comments for future schema changes
3. Build dual word/char models from the same corpus
4. Implement chaos dial with nonsensical + fragmented effects
5. Add optional ramp rate for progressive degradation
6. Add JSON serialization for model persistence

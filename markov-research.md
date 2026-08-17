# Markov Chain Text Generator: Problem Statement & Research

## Problem Statement

Build a **flexible Markov chain text generator in JavaScript** that can:

1. **Ingest a corpus** from JSON (with flexible schema support)
2. **Provide a single "coherence dial"** that controls output from highly coherent (5-word n-grams) down to fragmented (single characters)

---

## The Dial: N-gram Order + Tokenization Mode

The "dial" is actually **two parameters** that work together:

| Dial Position | Mode | Order | Output Character |
|---------------|------|-------|------------------|
| 10 (max coherence) | word | 5 | Nearly copies source, very constrained |
| 8 | word | 3 | Coherent sentences, recognizable style |
| 6 | word | 2 | Readable but novel, standard Markov |
| 4 | word | 1 | Grammatically loose, word salad |
| 3 | char | 10 | Word-like, mostly real words emerge |
| 2 | char | 5 | Fragments, some recognizable syllables |
| 1 | char | 3 | Mostly gibberish |
| 0 (max chaos) | char | 1 | Pure random characters from corpus |

### Why Two Parameters?

You can't smoothly interpolate between "3 words" and "4 characters" with a single model — they're different tokenizations. A word is a variable number of characters, so there's no mathematical mapping.

**Solution**: Treat the dial as a **lookup table** that maps a 0-10 (or 0-100) value to a `(mode, order)` pair. The user sees one dial; internally it switches modes at a threshold.

```javascript
function dialToParams(dial) {
  // dial: 0-100
  if (dial >= 50) {
    // Word mode: dial 50-100 maps to order 1-5
    return { mode: 'word', order: Math.ceil((dial - 50) / 10) };
  } else {
    // Char mode: dial 0-49 maps to order 1-10
    return { mode: 'char', order: Math.ceil(dial / 5) || 1 };
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MarkovGenerator                         │
├─────────────────────────────────────────────────────────────┤
│  train(corpus)                                              │
│    → stores raw corpus for on-demand model building         │
│                                                             │
│  generate({ length, dial = 75 })                            │
│    → converts dial to (mode, order)                         │
│    → builds/caches model for that config                    │
│    → generates output                                       │
│                                                             │
│  setDial(value) / getDial()                                 │
│    → convenience for real-time adjustment                   │
└─────────────────────────────────────────────────────────────┘
```

### Model Caching

Since the user might sweep the dial in real-time, rebuild on every change is expensive. Options:

1. **Pre-build all models** at training time (memory heavy but instant switching)
2. **LRU cache** of recently-used (mode, order) combinations
3. **Lazy build** on first use, then cache

For a small corpus, option 1 is fine. For large corpora, option 2/3.

---

## Existing Libraries

### JavaScript

| Library | Adjustable Order? | Char Mode? | Retrain/Update? |
|---------|-------------------|------------|-----------------|
| **[js-markov](https://npmjs.com/package/js-markov)** | Yes (`setOrder(n)`) | No (word only) | Yes (`clearChain()`) |
| **[markov-strings](https://npmjs.com/package/markov-strings)** | Yes (`stateSize`) | No | Yes (`.addData()`) |
| **[string-markov-js](https://npmjs.com/package/string-markov-js)** | Yes (per-train) | No | Yes (`clearData()`) |

**None support character mode out of the box** — but all are token-agnostic internally. Feed them `Array.from(text)` instead of `text.split(' ')` and they become character-level.

### Python (Reference)

| Library | Notes |
|---------|-------|
| **[shmarkov.py](https://gist.github.com/aparrish/14cb94ce539a868e6b8714dd84003f06)** | Explicitly supports `level='char'\|'word'`, ~60 lines, good reference impl |
| **[markovify](https://github.com/jsvine/markovify)** | Word-only but hackable via pre-splitting to chars |

---

## Implementation Path

### Option A: Wrap Existing Library

Use `js-markov` or `markov-strings`, wrap with:
- Dual tokenizer (word/char)
- Dial-to-params mapping
- Model caching layer

**Pros**: Battle-tested, less code
**Cons**: Dependency, may fight the abstraction

### Option B: Custom Implementation

Port `shmarkov.py` logic to JS (~100 lines), add:
- Dial mapping
- JSON corpus ingestion
- Caching

**Pros**: Full control, tiny footprint, no dependencies
**Cons**: More upfront work

### Recommendation

**Option B** — the core algorithm is trivial (~50 lines), and you want precise control over the dial behavior. The existing JS libraries don't save much complexity and add constraints.

---

## References

1. **Allison Parrish — shmarkov.py** (reference implementation)
   https://gist.github.com/aparrish/14cb94ce539a868e6b8714dd84003f06

2. **js-markov** (npm)
   https://npmjs.com/package/js-markov

3. **markov-strings** (npm)
   https://npmjs.com/package/markov-strings

4. **markovify** (Python, for reference)
   https://github.com/jsvine/markovify

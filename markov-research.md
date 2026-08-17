# Markov Chain Text Generator: Problem Statement & Research

## Problem Statement

Build a **flexible Markov chain text generator in JavaScript** that can:

1. **Ingest a corpus** from JSON (with flexible schema support)
2. **Provide a single "coherence dial"** that controls output from highly coherent (5-word n-grams) down to fragmented (single characters)

---

## The Controls: Mode + Order

Two independent parameters:

### Mode (toggle)
- **`word`** — tokenize by whitespace, each token is a word
- **`char`** — tokenize by character (using `Array.from()` for Unicode safety)

### Order (1-10 slider)
The n-gram size. Applies to whichever mode is active.

| Order | Word Mode | Char Mode |
|-------|-----------|-----------|
| 10 | Nearly copies source | Real words, very constrained |
| 5 | Coherent, recognizable style | Word-like fragments |
| 3 | Readable but novel | Syllable-ish chunks |
| 2 | Standard Markov output | Recognizable letter patterns |
| 1 | Word salad | Random characters |

### API

```javascript
generator.generate({
  length: 100,
  mode: 'word',  // or 'char'
  order: 3
})
```

### UI Mapping

Two controls:
- **Toggle/Switch**: Word ↔ Char
- **Slider**: Order 1-10

No artificial thresholds or lookup tables — the user controls both dimensions directly.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MarkovGenerator                         │
├─────────────────────────────────────────────────────────────┤
│  train(corpus)                                              │
│    → stores raw corpus, tokenizes both ways                 │
│                                                             │
│  generate({ length, mode, order })                          │
│    → builds/caches model for (mode, order) combo            │
│    → generates output                                       │
└─────────────────────────────────────────────────────────────┘
```

### Model Caching

Up to 20 possible models (2 modes × 10 orders). Options:

1. **Pre-build all** at training time — fine for small corpora
2. **Lazy build + cache** — build on first use, keep in memory
3. **LRU cache** — if memory constrained, evict least-used

For most use cases, option 2 is the sweet spot.

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

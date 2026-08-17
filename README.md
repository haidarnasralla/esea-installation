# Markov Chain Text Generator

A flexible n-gram text generator in JavaScript with adjustable tokenisation (word/character) and order (1-10).

## Usage

### Web Interface

Open `markov/markov.html` in your browser. Paste text, adjust the dials, watch it type.

### Programmatic

```javascript
const MarkovGenerator = require('./markov/markov-generator.js');

const generator = new MarkovGenerator();
generator.train('Your corpus text here...');

// Word mode, order 3
generator.generate({ length: 50, mode: 'word', order: 3 });

// Character mode, order 5
generator.generate({ length: 200, mode: 'char', order: 5 });
```

## Controls

### Mode (toggle)
- **`word`** — tokenise by whitespace
- **`char`** — tokenise by character

### Order (1-10)

| Order | Word Mode | Char Mode |
|-------|-----------|-----------|
| 10 | Nearly copies source | Real words, constrained |
| 5 | Coherent, recognisable style | Word-like fragments |
| 3 | Readable but novel | Syllable-ish chunks |
| 2 | Standard Markov output | Recognisable letter patterns |
| 1 | Word salad | Random characters |

## API

### `train(corpus)`

Accepts:
- Plain string
- Array of strings
- Array of objects with `text`/`content`/`body` field
- Wrapper object with `documents`/`items`/`data` array

### `generate({ length, mode, order })`

- `length` — number of tokens to generate
- `mode` — `'word'` or `'char'`
- `order` — n-gram size (1-10)

### `addToCorpus(data)`

Add more text without replacing existing corpus.

### `toJSON()` / `fromJSON(json)`

Persistence.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MarkovGenerator                         │
├─────────────────────────────────────────────────────────────┤
│  train(corpus)                                              │
│    → stores raw corpus, tokenises both ways                 │
│                                                             │
│  generate({ length, mode, order })                          │
│    → builds/caches model for (mode, order) combo            │
│    → generates output                                       │
└─────────────────────────────────────────────────────────────┘
```

Models are built lazily and cached (up to 20 combinations: 2 modes × 10 orders).

## Research

### Existing Libraries

| Library | Adjustable Order? | Char Mode? |
|---------|-------------------|------------|
| [js-markov](https://npmjs.com/package/js-markov) | Yes | No |
| [markov-strings](https://npmjs.com/package/markov-strings) | Yes | No |
| [string-markov-js](https://npmjs.com/package/string-markov-js) | Yes | No |

None support character mode out of the box. This implementation provides both.

### References

1. [shmarkov.py](https://gist.github.com/aparrish/14cb94ce539a868e6b8714dd84003f06) — Allison Parrish's reference implementation
2. [js-markov](https://npmjs.com/package/js-markov) — npm
3. [markov-strings](https://npmjs.com/package/markov-strings) — npm
4. [markovify](https://github.com/jsvine/markovify) — Python reference

## Files

```
├── README.md
├── markov/
│   ├── markov.html           — web UI with streaming output
│   ├── markov-generator.js  — main implementation
│   └── markov-demo.js       — quick test/demo
└── presentation/
    └── presentation.md      — explanation of tokenisation
```

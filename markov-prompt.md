Find online implementations of Markov chains for text in JS or Python where I can adjust the gram. I want to be able to train it on a corpus of text, update the corpus/retrain it, and adjust the grams - so having a gram be a series of words, a word, then individual clusters of letters then individual letters
Evaluated Python and JavaScript libraries for flexible n-gram text generation

Here's what's out there, sorted by how well each fits "swap between word-grams, char-grams, and letter-cluster-grams" plus easy retraining:

Best fits for your use case:

    decontextualize's MarkovGenerator (Python) — This is genuinely the best starting point for what you want. The MarkovGenerator class implements a general-purpose N-Gram-based text generator where n determines the order of the n-grams the object will look for. Crucially, it operates on a list of tokens, not hardcoded words — so if you feed it a list of words, you get word-grams; a list of single characters, you get char-grams; a list of syllable/cluster chunks (which you generate yourself, e.g. via regex or a syllabifier), you get letter-cluster-grams. It's short (~100 lines), meant to be modified, and retraining is just calling build_model() again on new tokens.
    Decontextualize
    js-markov (npm) — Built with exactly this kind of flexibility in mind. Order is used for dividing states into n-grams, and there's a setOrder() method (defaults to 3) plus a reset() method to wipe the chain clean for retraining, and a general train() method you can call repeatedly.
    npm
    string-markov-js (npm) — Lets you inspect/edit the model directly. You can use getPossibilities to see all words that follow a given gram, or updateGram to manually edit an entry — handy if you want to hand-tune cluster-level grams. Order is passed per training call (trainOnFile(files, order, ...)), so switching gram size is a parameter, not an architecture change.
    npm

Good but narrower (word-level only, order-adjustable, easy retrain):

    markovify (Python) — the most popular/robust option. You set state_size (the n-gram order) when constructing the model, e.g. markovify.Text(corpus, state_size=3), and it supports exporting/reloading models via JSON so retraining and persistence are easy. It's word-tokenized by design, but you can trick it into char-mode by pre-splitting your text into single-character "words" joined by spaces — a bit hacky but works.
    GitHub
    markov-strings (npm) — configured with stateSize, and you call .addData(data) repeatedly to add new training sentences without rebuilding from scratch. Word-level only.
    npm

Character-gram specific reference:

    Starbeamrainbowlabs' n-gram writeup walks through building a character-level n-gram generator from scratch with adjustable order — useful if you want to understand the char-gram mechanics before writing your own unified word/word-gram/cluster/char engine.

N-grams and Markov chains (MarkovGenerator)Generic Python n-gram text generator that works on any token list — words, characters, or custom chunks — with adjustable order.
decontextualize.com
jsvine/markovifyPopular Python Markov text library with adjustable state_size, JSON export/import for easy retraining.github.com
js-markovJS Markov chain library with setOrder() and reset() for adjustable gram size and retraining.npmjs.com
string-markov-jsJS Markov generator with direct gram inspection (getPossibilities) and manual editing (updateGram).npmjs.com
Markov Chain Part 1: N-GramsWalkthrough of building a character-level n-gram generator from scratch with adjustable order.
starbeamrainbowlabs.com

One honest note: none of these libraries ship a built-in "letter cluster" mode out of the box — that granularity (syllable-ish chunks between single letters and full words) isn't a standard tokenization anyone's pre-built. But because the core Markov mechanism is agnostic to what a "token" is, the cleanest path is:

    Write a small tokenize(text, mode) function with modes 'sentence-of-words' | 'word' | 'cluster' | 'char', where 'cluster' splits words into fixed-size or syllable-based chunks (e.g. regex like /.{1,3}/g per word, or a proper syllabifier if you want linguistically real clusters).
    Feed the resulting token array into a generic n-gram/Markov engine like the decontextualize MarkovGenerator (Python) or js-markov (JS) — both take token lists rather than assuming words or chars.
    Retraining is then just re-tokenizing your updated corpus and rebuilding (or incrementally updating, if the library supports addData/train calls, as js-markov and markov-strings do).

If you want, I can put together a small custom implementation (JS or Python) that does exactly this — one class with a setGramMode('word'|'cluster'|'char') and setOrder(n) you can toggle live, plus .train(corpus) you can call repeatedly to update it. Want me to build that?

Can you take decontextualizes MarkovGenerator and create something that does what I want in JavaScript?

    I want to train it on a corpus of text in JSON format. Be flexible here - the format may change. Maybe add some todo comments?
    The text will either be treated as sentences or broken down into characters - so maybe an algorithm to break down the corpus into a seperate data sructure of seperate characters?
    The idea will be to change an argument/turn a dial so that the output gets more and more nonsensical and fragmented over time.

For now, plan
Architected flexible corpus ingestion, dual tokenization modes, chaos blending mechanism

I pulled the actual source from decontextualize's write-up (not just the earlier search snippets), so I'm working from the real build_model/generate functions rather than guessing at their shape. That's a nice foundation because the core idea is dead simple: a Map from n-gram → list of tokens that followed it (duplicates and all, so frequency = probability), plus a random walk that reads off that map. Here's how I'd extend it into what you're describing.

1. Corpus ingestion (flexible JSON)

A normalizeCorpus(data) function that accepts several shapes and reduces them to a flat string[] of documents:

    a raw string
    an array of strings
    an array of objects with a text/content/body field
    a wrapper object like { documents: [...] }

TODO comments I'll bake in at the obvious extension points: per-document metadata (weighting some docs more heavily, tagging/filtering by source), streaming ingestion for huge corpora, non-whitespace-delimited languages. Every call to train() appends to a stored rawDocuments array rather than replacing it — that's what makes "retrain/update" cheap: new text gets tokenized and merged into the existing model instead of rebuilding from scratch.

2. Tokenization — the character breakdown structure

Shared pipeline: documents → sentences → tokens, where sentence-splitting is a naive regex (with a TODO noting it'll trip on abbreviations like "Mr." — a real sentence tokenizer is a later upgrade). From each sentence I'll derive two separate token structures, since you want both available, not a one-time either/or choice:

    wordTokens: split on whitespace (punctuation stays attached to words, matching the original's simplicity)
    charTokens: Array.from(sentence) rather than sentence.split('') — this matters because split('') breaks multi-byte Unicode (emoji, accented characters) into garbage half-characters, while Array.from splits on actual code points

Both get built into separate Markov models (word-level and char-level) every time you train, off the same corpus. That's a deliberate choice: keeping both live simultaneously (rather than picking one mode upfront) is what lets the chaos dial blend between them at generation time without retraining.

3. The chaos dial

You said "nonsensical and fragmented" — I read those as two distinct effects, so I'd implement both rather than picking one:

    Nonsensical = wrong-word injection. At each step, instead of always sampling the real next-token list for the current gram, roll against chaos: sometimes substitute a uniformly random token from the whole vocabulary instead of a statistically likely one.
    Fragmented = word breakdown. Also rolled against chaos: instead of emitting a clean predicted word, drop into the character-level model for a short burst (seeded from the last couple of real characters) and splice that in, un-spaced, so it visually corrupts/fuses with the surrounding text — literally the word-gram dissolving into letter-grams.

Underlying design choice: the word-level walk's context window keeps advancing using the real predicted word, even when the displayed output is corrupted. That keeps chaos a clean, reversible dial — turn it back to 0 mid-conversation and output immediately recovers, rather than the model having permanently wandered off into a dead zone of unseen grams. (I'll flag the alternative — letting corruption feed back into context so degradation compounds and doesn't recover — as a TODO, since it's a valid but riskier variant.)

For "over time" specifically: I'd add an optional rampRate so effective chaos increases per generated token within a single call (effectiveChaos = chaos + rampRate * tokensGenerated), so one passage can start coherent and visibly dissolve by the end — rather than chaos only being a static setting you change between runs.

4. Proposed shape (interface only, no bodies yet):

class MarkovGenerator {
  constructor({ wordOrder = 2, charOrder = 5 } = {})
  train(jsonCorpus)                 // normalize -> tokenize -> merge into both models
  generate({ length, chaos = 0, rampRate = 0, seed })
  reset()
  toJSON() / static fromJSON()      // persist/reload trained models
}

wordOrder and charOrder stay independent since char-grams usually want a higher order than word-grams to feel coherent (a single letter carries way less signal than a single word).

Does the chaos mechanism match what you pictured, or did you have a different flavor of "nonsensical" in mind — e.g. leaning harder into garbled-word fragments vs. just wrong-but-grammatical word choices? If this direction sounds right I'll go ahead and build it.

Can you say more about the core idea being dead simple? (a Map from n-gram → list of tokens that followed it (duplicates and all, so frequency = probability), plus a random walk that reads off that map)? Explain like I'm five.
Architected interactive Markov chain widget with accessible design system compliance

Picture a box of index cards, one card per word. Every time you spot a word in the text, you look at whatever word comes right after it, and drop a sticky note with that next word onto that card's pile. Same word shows up again with the same follow-up? You don't count anything — you just toss on another identical sticky note. The pile just gets thicker.

That's the entire "training" step. Now here's how you write something new with it: pick a card to start on, close your eyes, reach into its pile, and grab one sticky note at random. Whatever's written on it becomes your next word — and that word is now the card you go to next. Land on a card, grab a random note, write it down, hop to the next card. Repeat.

Here's the clever part: since a popular next-word has more copies of its sticky note sitting in the pile, a blind grab is more likely to land on it — automatically. Nobody calculates a percentage anywhere. A thicker pile just wins more often. That's "duplicates = probability," the whole trick in one sentence.

Here's a tiny 12-word story turned into cards. Hit the button a bunch of times and watch which card lights up next:

That's really the whole algorithm — build the piles, then wander through them blindly. Click "like" a bunch of times in your head: its pile has two "cats" notes and one "dogs" note, so you'll see "cats" show up roughly twice as often, with zero math involved.

Two things that connect back to what we've been planning: an "n-gram" just means a card's label can be more than one word (a card labeled "the cat" instead of just "the") — same trick, bigger label. And that chaos dial — under the hood, it's basically "sometimes reach into a different pile on purpose, instead of the right one."

Distil the original problem, and the suggested solution into a comprehensive prompt to be passed on to another LLM. Include references that you searched.
Verified sources and synthesized comprehensive project documentation

Good — confirmed: that's Allison Parrish's RWET course material, and there's a direct link to the actual markov.py source, which is worth including over just the teaching page.
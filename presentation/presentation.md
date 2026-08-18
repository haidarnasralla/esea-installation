# Tokenisation

## What is it?

**Tokenisation** is the process of chopping text into smaller pieces called **tokens**.

These tokens are the basic units that an algorithm works with. The same text can be tokenised different ways:

### Word Tokenisation

Split on spaces/whitespace.

```
Input:  "The quick brown fox"
Output: ["The", "quick", "brown", "fox"]
```

Each token is a word. The algorithm then predicts: *"given these words, what word comes next?"*

### Character Tokenisation

Split into individual characters.

```
Input:  "The quick"
Output: ["T", "h", "e", " ", "q", "u", "i", "c", "k"]
```

Each token is a single character (including spaces). The algorithm predicts: *"given these characters, what character comes next?"*

---

## Why does it matter?

The choice of tokenisation determines what the model "sees" and what it can predict:

| Tokenisation | Model sees | Predicts | Output feels |
|--------------|-----------|----------|--------------|
| Word | Whole words | Next word | Grammatical, coherent |
| Character | Individual letters | Next letter | Can invent new words, more chaotic |

Same algorithm, same corpus — but different granularity of "pieces" to work with.

---

# How a Markov Chain Works

## Training

Scan through the text and record what comes after each n-gram. Don't calculate percentages — just keep a list of observed "next tokens" (with duplicates).

Example with order 2, word mode:

```
"the cat sat on the mat"

("the", "cat") → ["sat"]          ← "sat" followed "the cat"
("cat", "sat") → ["on"]           ← "on" followed "cat sat"
("sat", "on")  → ["the"]
("on", "the")  → ["mat"]
("the", "mat") → [end]
```

If "the cat" appeared twice with different followers:

```
"the cat sat... the cat ran"

("the", "cat") → ["sat", "ran"]   ← both observed, both recorded
```

## Generation

Pick a starting n-gram, then randomly grab one item from its list of "next tokens". That becomes your output. Slide the window forward, repeat.

## Why duplicates = probability

The statistics emerge automatically: if "sat" follows "the cat" 80% of the time in the corpus, there'll be 4× as many "sat" entries in that list as "ran". A random pick naturally hits "sat" more often.

No probability calculation needed — **frequency is probability**.

---

## Definitions from the literature

> "Given a character sequence and a defined document unit, tokenization is the task of chopping it up into pieces, called tokens, perhaps at the same time throwing away certain characters, such as punctuation."
>
> — **Stanford NLP Group**, *Introduction to Information Retrieval*

> "Tokenization is the process of converting a sequence of text into individual units or tokens. These tokens are the smallest pieces of text that are meaningful for the task being performed."
>
> — **GeeksforGeeks**, *Tokenization in NLP*

> "Tokenization refers to the process of converting a sequence of text into smaller parts, known as tokens. These tokens can be as small as characters or as long as words."
>
> — **DataCamp**, *Tokenization in NLP*

---

## References

1. Stanford NLP Group — *Tokenization*
   https://nlp.stanford.edu/IR-book/html/htmledition/tokenization-1.html

2. DataCamp — *Tokenization in NLP: How It Works*
   https://www.datacamp.com/blog/what-is-tokenization

3. GeeksforGeeks — *What is Tokenization in NLP?*
   https://www.geeksforgeeks.org/nlp/tokenization-in-natural-language-processing-nlp/

4. Coursera — *Tokenization in NLP: What Is It?*
   https://www.coursera.org/articles/tokenization-nlp

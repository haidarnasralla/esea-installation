# Neural Network Chaos & Glitch Effects for Installation Art

Research into using neural networks for controlled chaos, hallucination, and degradation effects driven by user interaction.

---

## Executive Summary

**Yes, recursive training will eventually churn out nonsense** — this is a well-documented phenomenon called **"model collapse"**. The key insight is that there are multiple ways to induce glitchy, hallucinatory effects, each with different aesthetics and implementation complexity.

### Glitch Effect Spectrum (Low → High Chaos)

| Technique | Chaos Level | Browser-Feasible? | Visual/Text Output |
|-----------|-------------|-------------------|-------------------|
| High temperature sampling | Low-Medium | ✅ Yes | Increasingly random but grammatical |
| Model collapse (recursive training) | Medium-High | ⚠️ Limited | Repetitive, loses diversity, then nonsense |
| Neural Glitch (weight manipulation) | High | ✅ Yes | Semantic confusion, texture distortion |
| Adversarial perturbation | Variable | ✅ Yes | Targeted misinterpretation |

---

## 1. Model Collapse — The "Ouroboros" Effect

https://www.nature.com/articles/s41586-024-07566-y

### What Is It?

When AI models are trained on their own output recursively, they undergo **model collapse** — a degenerative process where:

1. **Early collapse**: Tails of the distribution disappear (rare/unusual outputs become impossible)
2. **Late collapse**: Output converges to repetitive, low-variance nonsense

### The Science (Nature, July 2024)

From Shumailov et al., "AI models collapse when trained on recursively generated data":

> "Indiscriminate use of model-generated content in training causes **irreversible defects** in the resulting models, in which tails of the original content distribution disappear."

Key findings:
- After ~5-9 generations of recursive training, text models produce gibberish
- The model "forgets" rare events and converges toward high-probability outputs
- Eventually collapses to repetitive phrases or single tokens

### Example of Collapse (from the paper)

**Input**: "some started before 1360 — was typically accomplished by a master mason..."

| Generation | Output |
|------------|--------|
| Gen 0 | "Revival architecture such as St. John's Cathedral in London..." |
| Gen 1 | "architecture such as St. Peter's Basilica in Rome or St. Peter's Basilica in Buenos Aires..." |
| Gen 5 | "ism, which had been translated into more than 100 languages including English, French, German, Italian, Spanish, Portuguese, Dutch, Swedish, Norwegian, Polish, Hungarian..." |
| Gen 9 | "architecture. In addition to being home to some of the world's largest populations of black-tailed jackrabbits, white-tailed jackrabbits, blue-tailed jackrabbits, red-tailed jackrabbits, yellow-..." |

### For Your Installation

**Pros**:
- Scientifically grounded
- Produces genuinely eerie "AI going insane" aesthetic
- Could visualize degradation over time as users interact

**Cons**:
- Full training is too slow for real-time browser interaction
- Would need to pre-compute generations or use very small models

**Implementation approach**:
- Pre-train multiple generations offline
- Let users "scrub" through generations like a timeline
- Or: use a tiny RNN that can train in-browser on limited text

---

## 2. Temperature & Sampling Manipulation

### How It Works

LLMs don't deterministically output text — they sample from probability distributions. You can crank up the chaos:

| Parameter | Low Value | High Value |
|-----------|-----------|------------|
| **Temperature** | Conservative, predictable | Wild, hallucinating |
| **Top-p (nucleus)** | Focused vocabulary | Broader, stranger words |
| **Top-k** | Only top choices | More unlikely tokens |

### At Extreme Settings

- **Temperature > 1.5**: Grammatical structure starts breaking down
- **Temperature > 2.0**: Word salad, neologisms, semantic drift
- **Combined with low top-p**: Chaotic but contained
- **Combined with high top-p**: Maximum entropy, pure chaos

### For Your Installation

**Pros**:
- Works with any LLM (WebLLM, Transformers.js)
- Real-time, immediate feedback
- User can "dial in" the chaos
- No training required — inference only

**Cons**:
- Less conceptually interesting than true model collapse
- Output is random but doesn't "degrade" over time

**Implementation approach**:
- Run small LLM in browser (SmolLM-135M, Phi-3-mini)
- Expose temperature as a physical dial or slider
- Map user interactions to temperature (more chaos = more interaction)

---

## 3. Neural Glitch — Mario Klingemann's Technique

### What Is It?

Artist Mario Klingemann pioneered "Neural Glitch" in 2018: **deliberately corrupting the trained weights of a GAN** to produce surreal, broken outputs.

> "I manipulate fully trained GANs by randomly altering, deleting or exchanging their trained weights. Due to the complex structure of the neural architectures, the glitches introduced this way occur on texture as well as semantic levels."

### How It Works

1. Take a fully trained model (e.g., face generator)
2. Randomly modify weight matrices:
   - Swap weights between layers
   - Delete random weights (set to 0)
   - Add noise to weights
   - Interpolate weights between different models
3. Run inference — output is "broken" in interesting ways

### Effects

- **Texture glitches**: Skin becomes geometric, hair becomes fractals
- **Semantic confusion**: Eyes appear where mouths should be
- **Coherent style**: Same corruption applied to different inputs produces consistent aesthetic

### For Your Installation (Images)

**Pros**:
- Extremely visually striking
- Real-time — just corrupt weights and run inference
- User input could map to corruption parameters
- Works in browser with TensorFlow.js

**Cons**:
- Best results with GANs (image-focused)
- Less applicable to text generation

**Implementation approach**:
- Load pre-trained StyleGAN or similar in TensorFlow.js
- Let users "corrupt" the model via sliders/interactions
- Each interaction adds noise to different layer weights

---

## 4. Feedback Loops — User Interaction → Training

### Concept

User interactions with the system become training data for the next iteration, creating a feedback loop that amplifies errors.

### Architecture Options

#### Option A: Accumulating Poison
```
User input → LLM response → User selects/rates output
                              ↓
                        Selected outputs → Fine-tune model
                              ↓
                        Degraded model → More distorted responses
```

#### Option B: Echo Chamber
```
User prompt → LLM generates → Output becomes next prompt
                 ↓                     ↓
              Display            Feed back in
                                       ↓
                              Repeat until collapse
```

#### Option C: Crowd Corruption
```
Multiple users → Collective inputs
                      ↓
               Train tiny model on all inputs
                      ↓
               Model reflects crowd's "mind"
                      ↓
               Outputs become increasingly weird
               as diverse inputs create contradictions
```

### For Your Installation

**Feasibility**: This is the most ambitious but potentially most interesting approach.

**Realistic implementation**:
1. Use **tiny model** that can train in browser (small LSTM, simple RNN)
2. Each user interaction adds to training corpus
3. Retrain periodically (every N interactions)
4. Watch the model's outputs degrade over the course of the exhibition

---

## 5. Recommended Architecture for Your Installation

### "The Collapse Machine"

A browser-based installation that demonstrates model collapse in real-time:

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Input Text  │  │ Generation  │  │ Temperature │         │
│  │   Field     │  │   Counter   │  │    Dial     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GENERATED OUTPUT                        │   │
│  │  (streams character by character like your Markov)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ TRAIN ON THIS OUTPUT ]  [ RESET TO GEN 0 ]              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    UNDER THE HOOD                           │
├─────────────────────────────────────────────────────────────┤
│  Small LSTM/RNN (TensorFlow.js)                             │
│  - Trains on user-provided + generated text                 │
│  - Each "generation" trains on previous output              │
│  - Visualize weight distributions changing                  │
│  - Show perplexity/loss increasing                          │
└─────────────────────────────────────────────────────────────┘
```

### Controls (Chaos Dials)

| Control | Effect |
|---------|--------|
| **Generation** | How many recursive training cycles (0-10) |
| **Temperature** | Sampling randomness (0.1-2.0) |
| **Corruption** | Direct weight noise injection (0-100%) |
| **Feedback Rate** | How much of output feeds back to training |

### Tech Stack

- **TensorFlow.js** for in-browser training
- **Small LSTM** (trainable in seconds on modern hardware)
- **WebWorker** for background training (keeps UI responsive)
- **Similar UI to your Markov demo** for consistency

---

## 6. Alternative: Pre-Computed Collapse Gallery

If real-time training is too slow, pre-compute the collapse:

1. Train a model through 10+ generations offline
2. Save checkpoints at each generation
3. Let users "scrub" through the generations
4. Show same prompt → different outputs at each generation
5. Visualize the statistical collapse (histograms, word frequency)

This is essentially what the Nature paper did — very compelling results.

---

## References

### Model Collapse
- Shumailov et al., "AI models collapse when trained on recursively generated data" (Nature, 2024)
  https://www.nature.com/articles/s41586-024-07566-y
- "Why language models collapse when trained on recursively generated text" (arXiv)
  https://arxiv.org/pdf/2412.14872

### Neural Glitch
- Mario Klingemann's Neural Glitch technique
  https://issues.org/klingemann-neural-glitch/
- Kate Vass Galerie on Neural Glitch
  https://www.katevassgalerie.com/blog/mistaken-identity-by-mario-klingemann

### Temperature & Sampling
- "Balancing Creativity and Coherence at High Temperature" (arXiv)
  https://arxiv.org/html/2407.01082
- "KL-Divergence Guided Temperature Sampling"
  https://arxiv.org/html/2306.01286

### Browser ML
- TensorFlow.js Training Tutorial
  https://www.tensorflow.org/js/tutorials/training/web_worker
- Teachable Machine (real-time browser training)
  https://codelabs.developers.google.com/codelabs/tensorflowjs-teachablemachine-codelab

### GAN Mode Collapse (Related)
- "An in-depth review and analysis of mode collapse in GANs" (Springer, 2025)
  https://link.springer.com/article/10.1007/s10994-025-06772-7
- GAN Lab (browser-based GAN training visualization)
  https://poloclub.github.io/ganlab/

---

## Summary: Which Produces the Glitchiest Effects?

| Approach | Glitch Aesthetic | Feasibility | Recommendation |
|----------|------------------|-------------|----------------|
| **Model Collapse** | Repetition → Gibberish | Medium | ⭐ Best for conceptual depth |
| **High Temperature** | Random but grammatical | Easy | Good baseline |
| **Neural Glitch** | Surreal, broken | Medium | ⭐ Best for visuals |
| **Weight Noise** | Subtle → Chaotic | Easy | Good addition |
| **Feedback Loop** | Amplifying distortion | Hard | Most ambitious |

**For maximum "controlled chaos"**: Combine temperature manipulation + periodic micro-training on outputs + weight noise injection. This gives you multiple chaos dimensions to play with.

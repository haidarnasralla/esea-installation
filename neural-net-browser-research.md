# Neural Network Browser Demo Research

Research into browser-based neural network demonstrations similar to the Markov chain text generator.

## Recommendation Summary

**For text generation specifically: ml5.js charRNN (LSTM)** is the best analogue to the Markov generator — same domain (text), similar interactive controls (temperature ≈ chaos dial, seed text, length).

However, there are more visually compelling options depending on what aspect of neural nets you want to demonstrate.

---

## Options Ranked by Fit with Markov Demo

### 1. ml5.js charRNN (LSTM) — Best Text Generation Parallel

- **What it does**: Character-level text generation using pre-trained LSTM
- **Why it fits**: Same domain as Markov (text), similar controls (temperature = randomness, seed text, length)
- **Interactive controls you could expose**:
  - Temperature (0.1–1.0) — like the order dial but controls randomness
  - Seed text — input prompt
  - Generation length
- **Trade-off**: Requires pre-trained models (~5-20MB download); training in-browser isn't practical
- **Implementation**: Load via CDN, use `ml5.charRNN()`, call `generate()`

```javascript
const lstm = ml5.charRNN('models/woolf/', modelLoaded);
lstm.generate({ seed: 'The forest', length: 100, temperature: 0.5 }, gotResult);
```

**Resources**:
- [ml5.js charRNN training repo](https://github.com/ml5js/training-charRNN)
- [GeeksforGeeks tutorial](https://www.geeksforgeeks.org/javascript/how-to-generate-text-with-ml5js/)
- [Paperspace training guide](https://blog.paperspace.com/training-an-lstm-and-using-the-model-in-ml5-js/)

### 2. TensorFlow Playground — Best for Understanding NN Fundamentals

- **What it does**: Train a small feedforward network on 2D classification problems
- **Why it's compelling**: Real-time training visualization, see decision boundaries form
- **Interactive controls**: Learning rate, activation functions, hidden layers, regularization
- **Trade-off**: Not text generation — it's classification/regression on toy datasets
- **URL**: http://playground.tensorflow.org/
- **Open source**: https://github.com/tensorflow/playground

### 3. GAN Lab — Best for "Wow" Factor

- **What it does**: Train GANs in real-time on 2D distributions
- **Why it's compelling**: Watch generator and discriminator compete, see manifold transformations
- **Trade-off**: Complex concept, not text-based
- **Built with**: TensorFlow.js, runs entirely in browser
- **URL**: https://poloclub.github.io/ganlab/
- **Source**: https://github.com/poloclub/ganlab

### 4. CNN Explainer — Best for Image Understanding

- **What it does**: Visualizes how CNNs transform images through layers
- **Trade-off**: Inference only (no training), image domain not text
- **URL**: https://poloclub.github.io/cnn-explainer/

### 5. Transformers.js / WebLLM — Modern but Heavy

- **What it does**: Run actual transformer models (GPT-2, Llama-3.2, etc.) in browser via WebGPU
- **Trade-off**: Large models (100MB–4GB), requires WebGPU support, more "use AI" than "understand AI"
- **Transformers.js**: https://huggingface.co/docs/transformers.js
- **WebLLM**: https://github.com/chaosprint/web-llm

---

## RNN vs Other Architectures for Demo Purposes

| Aspect | RNN/LSTM | Feedforward (TF Playground) | GAN | Transformer |
|--------|----------|----------------------------|-----|-------------|
| Trains in browser | No (too slow) | **Yes** | **Yes** | No |
| Text generation | **Yes** | No | No | Yes |
| Visual "aha" moment | Medium | **High** | **High** | Low |
| Conceptual simplicity | Medium | **Simple** | Complex | Complex |
| Model size | 5-20MB | Tiny | Tiny | 100MB+ |

**Verdict**: RNN/LSTM is the right architecture for text generation, but you'll be limited to **inference with pre-trained models** rather than training from scratch like the Markov demo does.

---

## Suggested Approaches

### Option A: LSTM Inference Demo (ml5.js)

- Ship with pre-trained models (Virginia Woolf, Shakespeare, etc.)
- User picks model + adjusts temperature + provides seed
- Shows how neural nets "hallucinate" text differently than Markov chains

### Option B: "Train Your Own" — TensorFlow Playground Style

- Different domain (2D classification), but the pedagogical value is higher
- User actually sees the network learn in real-time
- Better demonstrates what makes neural nets different from Markov chains

### Option C: Hybrid Approach

- Side-by-side comparison: Markov output vs LSTM output on same corpus
- Show how order/temperature affect both, but in fundamentally different ways

---

## Additional Resources

### Interactive Visualizations
- [TensorSpace](https://github.com/tensorspace-team/tensorspace) — 3D neural network visualization
- [ConvNet Playground](https://github.com/fastforwardlabs/convnetplayground) — CNN feature exploration
- [VisualML](https://github.com/dsgiitr/VisualML) — Collection of ML visualization demos

### Text Generation Specific
- [Karpathy's char-rnn](https://github.com/karpathy/char-rnn) — Original char-RNN implementation (Torch)
- [char-rnn-tensorflow](https://github.com/ivarprudnikov/char-rnn-tensorflow) — Web app with Node.js backend

### References
- [The Unreasonable Effectiveness of Recurrent Neural Networks](http://karpathy.github.io/2015/05/21/rnn-effectiveness/) — Andrej Karpathy's influential post

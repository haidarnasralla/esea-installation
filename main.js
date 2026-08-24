/**
 * Text Stream Installation - Canvas Prototype
 * 
 * Snippets of text appear at random positions and type out character by character,
 * scheduled via a Poisson process.
 */

// --- Configuration ---
const CONFIG = {
  // Poisson process: average snippets per second
  lambda: 0.5,
  
  // Snippet appearance
  minFontSize: 16,
  maxFontSize: 48,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: 'rgba(255, 255, 255, 0.9)',
  
  // Typewriter timing
  minCharDelay: 30,   // ms between characters
  maxCharDelay: 80,
  
  // Lifespan (after fully typed)
  holdDuration: 3,      // seconds to stay visible after typing completes
  fadeOutDuration: 2,   // seconds
  
  // Snippet extraction
  minSnippetWords: 3,
  maxSnippetWords: 12,
};

// --- State ---
let canvas, ctx;
let snippets = [];       // active text fragments on screen
let corpusSnippets = []; // pre-extracted snippets from corpus
let lastTime = 0;
let nextSpawnTime = 0;

// --- Corpus Loading ---
async function loadCorpus() {
  try {
    const response = await fetch('./corpus/corpus.txt');
    const text = await response.text();
    corpusSnippets = extractSnippets(text);
    console.log(`Loaded ${corpusSnippets.length} snippets from corpus`);
  } catch (err) {
    console.error('Failed to load corpus:', err);
    // Fallback snippets for testing
    corpusSnippets = [
      'the machine remembers everything',
      'what remains of human intent',
      'digital persistence',
      'slowly decays into noise',
      'processed by a machine',
    ];
  }
}

function extractSnippets(text) {
  // Split into sentences, then into chunks of varying length
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);
  
  const snippets = [];
  
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length <= CONFIG.maxSnippetWords) {
      snippets.push(sentence.trim());
    } else {
      // Break long sentences into chunks
      let i = 0;
      while (i < words.length) {
        const chunkSize = CONFIG.minSnippetWords + 
          Math.floor(Math.random() * (CONFIG.maxSnippetWords - CONFIG.minSnippetWords));
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.length > 0) {
          snippets.push(chunk);
        }
        i += chunkSize;
      }
    }
  }
  
  return snippets;
}

// --- Poisson Scheduling ---
function getNextPoissonDelay() {
  // Exponential distribution: -ln(U) / λ
  return -Math.log(Math.random()) / CONFIG.lambda * 1000; // ms
}

// --- Snippet Factory ---
function spawnSnippet() {
  if (corpusSnippets.length === 0) return;
  
  const text = corpusSnippets[Math.floor(Math.random() * corpusSnippets.length)];
  const fontSize = CONFIG.minFontSize + 
    Math.random() * (CONFIG.maxFontSize - CONFIG.minFontSize);
  
  // Measure text width to avoid spawning too close to right edge
  ctx.font = `${fontSize}px ${CONFIG.fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  
  // Random position (avoid edges, account for text width)
  const padding = 50;
  const maxX = Math.max(padding, canvas.width - textWidth - padding);
  const x = padding + Math.random() * (maxX - padding);
  const y = padding + Math.random() * (canvas.height - padding * 2);
  
  // Character delay for typewriter effect
  const charDelay = CONFIG.minCharDelay + 
    Math.random() * (CONFIG.maxCharDelay - CONFIG.minCharDelay);
  
  snippets.push({
    text,
    x,
    y,
    fontSize,
    charDelay,
    visibleChars: 0,
    timeSinceLastChar: 0,
    typingComplete: false,
    holdTimer: 0,
    opacity: 1,
    state: 'typing', // 'typing', 'holding', 'fading'
  });
}

// --- Rendering ---
function updateAndRender(timestamp) {
  const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
  const deltaTimeMs = deltaTime * 1000;
  lastTime = timestamp;
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Spawn new snippets via Poisson process
  if (timestamp >= nextSpawnTime) {
    spawnSnippet();
    nextSpawnTime = timestamp + getNextPoissonDelay();
  }
  
  // Update and render snippets
  for (let i = snippets.length - 1; i >= 0; i--) {
    const s = snippets[i];
    
    if (s.state === 'typing') {
      // Typewriter effect
      s.timeSinceLastChar += deltaTimeMs;
      
      while (s.timeSinceLastChar >= s.charDelay && s.visibleChars < s.text.length) {
        s.visibleChars++;
        s.timeSinceLastChar -= s.charDelay;
      }
      
      if (s.visibleChars >= s.text.length) {
        s.state = 'holding';
      }
    } else if (s.state === 'holding') {
      s.holdTimer += deltaTime;
      if (s.holdTimer >= CONFIG.holdDuration) {
        s.state = 'fading';
      }
    } else if (s.state === 'fading') {
      s.opacity -= deltaTime / CONFIG.fadeOutDuration;
      if (s.opacity <= 0) {
        snippets.splice(i, 1);
        continue;
      }
    }
    
    // Render visible portion of text
    const visibleText = s.text.slice(0, s.visibleChars);
    ctx.font = `${s.fontSize}px ${CONFIG.fontFamily}`;
    ctx.fillStyle = CONFIG.color.replace(/[\d.]+\)$/, `${s.opacity})`);
    ctx.fillText(visibleText, s.x, s.y);
  }
  
  requestAnimationFrame(updateAndRender);
}

// --- Initialization ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

async function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  await loadCorpus();
  
  // Start the render loop
  nextSpawnTime = performance.now() + getNextPoissonDelay();
  requestAnimationFrame(updateAndRender);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

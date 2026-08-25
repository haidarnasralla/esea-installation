/**
 * Text Stream Installation - Canvas Prototype
 * 
 * Snippets of text appear at random positions and type out character by character,
 * scheduled via a Poisson process.
 * 
 * Degradation cycle: verbatim → word markov → mixed → char only → final
 */

import MarkovGenerator from './processes/markov-generator.js';
import { DegradationCycle } from './processes/degradation-cycle.js';

// --- Font Pool ---
const FONTS = [
  // Monospace (machine/terminal)
  'Courier New, monospace',
  'Monaco, monospace',
  'SF Mono, monospace',
  // Sans-serif (clinical/neutral)
  'Helvetica, Arial, sans-serif',
  'SF Pro, system-ui, sans-serif',
  'Inter, sans-serif',
  'Roboto, sans-serif',
  // Serif (human/literary)
  'Georgia, serif',
  'Times New Roman, serif',
  'Palatino, serif',
];

// --- Configuration ---
const CONFIG = {
  // Poisson process: average snippets per second
  lambda: 0.5,
  
  // Snippet appearance
  minFontSize: 16,
  maxFontSize: 48,
  color: 'rgba(255, 255, 255, 0.9)',
  
  // Typewriter timing
  minCharDelay: 30,   // ms between characters
  maxCharDelay: 80,
  
  // Lifespan (after fully typed)
  holdDuration: 3,      // seconds to stay visible after typing completes
  fadeOutDuration: 2,   // seconds
  
  // Snippet length (for Markov generation)
  minSnippetWords: 6,
  maxSnippetWords: 11,
  minSnippetChars: 20,
  maxSnippetChars: 60,
};

// --- State ---
let canvas, ctx;
let snippets = [];       // active text fragments on screen
let corpusLines = [];    // raw lines from corpus (for verbatim mode)
let lastTime = 0;
let nextSpawnTime = 0;
let voices = [];         // available TTS voices

// Degradation system
const markov = new MarkovGenerator();
const cycle = new DegradationCycle();

// --- TTS Setup ---
function loadVoices() {
  const allVoices = speechSynthesis.getVoices();
  // Filter to English voices only
  voices = allVoices.filter(v => v.lang.startsWith('en'));
  console.log(`Loaded ${voices.length} English TTS voices (of ${allVoices.length} total)`);
}

// Voices load asynchronously in some browsers
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (voices.length === 0) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices[Math.floor(Math.random() * voices.length)];
  utterance.rate = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
  utterance.pitch = 0.8 + Math.random() * 0.4;
  
  speechSynthesis.speak(utterance);
}

// --- Corpus Loading ---
async function loadCorpus() {
  try {
    const response = await fetch('./corpus/corpus.txt');
    const text = await response.text();
    
    // Store raw lines for verbatim mode
    corpusLines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Train Markov generator on full corpus
    markov.train(text);
    
    console.log(`Loaded ${corpusLines.length} lines from corpus`);
  } catch (err) {
    console.error('Failed to load corpus:', err);
    // Fallback snippets for testing
    corpusLines = [
      'the machine remembers everything',
      'what remains of human intent',
      'digital persistence',
      'slowly decays into noise',
      'processed by a machine',
    ];
    markov.train(corpusLines.join('\n'));
  }
}

// --- Text Generation ---
function generateText() {
  const params = cycle.getGenerationParams();
  
  switch (params.mode) {
    case 'verbatim':
      // Return a random line from the corpus
      return corpusLines[Math.floor(Math.random() * corpusLines.length)];
    
    case 'word': {
      // Generate word-level Markov text
      const length = CONFIG.minSnippetWords + 
        Math.floor(Math.random() * (CONFIG.maxSnippetWords - CONFIG.minSnippetWords + 1));
      return markov.generate({
        length,
        mode: 'word',
        order: params.wordOrder,
      });
    }
    
    case 'char': {
      // Generate character-level Markov text
      const length = CONFIG.minSnippetChars + 
        Math.floor(Math.random() * (CONFIG.maxSnippetChars - CONFIG.minSnippetChars + 1));
      return markov.generate({
        length,
        mode: 'char',
        order: params.charOrder,
      });
    }
    
    default:
      return 'ERROR: unknown mode';
  }
}

// --- Poisson Scheduling ---
function getNextPoissonDelay(timestamp) {
  // Get LFO-modulated lambda based on current time
  const timeInSeconds = timestamp / 1000;
  const lambda = cycle.getLambda(timeInSeconds);
  
  // Exponential distribution: -ln(U) / λ
  return -Math.log(Math.random()) / lambda * 1000; // ms
}

// --- Collision Detection ---
function getSnippetBounds(snippet) {
  ctx.font = `${snippet.fontSize}px ${snippet.fontFamily}`;
  const metrics = ctx.measureText(snippet.text);
  const width = metrics.width;
  const height = snippet.fontSize * 1.2; // approximate line height
  
  return {
    x: snippet.x,
    y: snippet.y - height, // text baseline is at y, so top is above
    width,
    height,
    centerX: snippet.x + width / 2,
    centerY: snippet.y - height / 2,
  };
}

function checkOverlap(newBounds, existingSnippets, minDistance, tolerance) {
  for (const snippet of existingSnippets) {
    const existing = getSnippetBounds(snippet);
    
    // Center-to-center distance check (fast)
    const dx = newBounds.centerX - existing.centerX;
    const dy = newBounds.centerY - existing.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Effective minimum distance, reduced by tolerance
    const effectiveMinDistance = minDistance * (1 - tolerance);
    
    if (distance < effectiveMinDistance) {
      return true; // Too close
    }
    
    // Bounding box overlap check (only if tolerance < 0.5)
    if (tolerance < 0.5) {
      const padding = (1 - tolerance * 2) * 20; // 20px padding at 0 tolerance, 0 at 0.5+
      
      const overlapX = newBounds.x < existing.x + existing.width + padding &&
                       newBounds.x + newBounds.width + padding > existing.x;
      const overlapY = newBounds.y < existing.y + existing.height + padding &&
                       newBounds.y + newBounds.height + padding > existing.y;
      
      if (overlapX && overlapY) {
        return true; // Bounding boxes overlap
      }
    }
  }
  
  return false; // No overlap
}

function findValidPosition(text, fontSize, fontFamily, maxAttempts = 20) {
  const tolerance = cycle.getOverlapTolerance();
  const minDistance = cycle.getMinSpawnDistance();
  
  ctx.font = `${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize * 1.2;
  
  const padding = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const maxX = Math.max(padding, canvas.width - textWidth - padding);
    const x = padding + Math.random() * (maxX - padding);
    const y = padding + textHeight + Math.random() * (canvas.height - padding * 2 - textHeight);
    
    const newBounds = {
      x,
      y: y - textHeight,
      width: textWidth,
      height: textHeight,
      centerX: x + textWidth / 2,
      centerY: y - textHeight / 2,
    };
    
    if (!checkOverlap(newBounds, snippets, minDistance, tolerance)) {
      return { x, y, valid: true };
    }
  }
  
  // If we couldn't find a valid position:
  // - In early phases, skip this spawn
  // - In later phases (tolerance > 0.3), allow overlap anyway
  if (tolerance > 0.3) {
    const maxX = Math.max(padding, canvas.width - textWidth - padding);
    return {
      x: padding + Math.random() * (maxX - padding),
      y: padding + textHeight + Math.random() * (canvas.height - padding * 2 - textHeight),
      valid: true,
    };
  }
  
  return { x: 0, y: 0, valid: false };
}

// --- Snippet Factory ---
function spawnSnippet() {
  if (corpusLines.length === 0) return;
  
  const text = generateText();
  const fontSize = CONFIG.minFontSize + 
    Math.random() * (CONFIG.maxFontSize - CONFIG.minFontSize);
  const fontFamily = FONTS[Math.floor(Math.random() * FONTS.length)];
  
  // Find a valid position that doesn't overlap (based on current phase)
  const position = findValidPosition(text, fontSize, fontFamily);
  
  if (!position.valid) {
    // Skip this spawn - couldn't find non-overlapping position
    return;
  }
  
  const { x, y } = position;
  
  // Character delay for typewriter effect
  const charDelay = CONFIG.minCharDelay + 
    Math.random() * (CONFIG.maxCharDelay - CONFIG.minCharDelay);
  
  snippets.push({
    text,
    x,
    y,
    fontSize,
    fontFamily,
    charDelay,
    visibleChars: 0,
    timeSinceLastChar: 0,
    typingComplete: false,
    holdTimer: 0,
    opacity: 1,
    state: 'typing', // 'typing', 'holding', 'fading'
  });
  
  // Speak the snippet
  speak(text);
}

// --- UI Update ---
function updateUI() {
  const state = cycle.getState();
  const tolerance = cycle.getOverlapTolerance();
  
  document.getElementById('phase').textContent = state.phase;
  document.getElementById('description').textContent = state.description;
  document.getElementById('word-order').textContent = state.wordOrder;
  document.getElementById('char-order').textContent = state.charOrder;
  document.getElementById('char-active').textContent = state.charModeActive ? 'Yes' : 'No';
  document.getElementById('overlap-tolerance').textContent = `${Math.round(tolerance * 100)}%`;
  
  // Update glitch effect values
  document.getElementById('flicker').textContent = `${Math.round(cycle.getFlicker() * 100)}%`;
  document.getElementById('fade-flicker').textContent = `${Math.round(cycle.getFadeFlicker() * 100)}%`;
  document.getElementById('inverse-flicker').textContent = `${Math.round(cycle.getInverseFlicker() * 100)}%`;
  document.getElementById('chromatic').textContent = `${cycle.getChromaticAberration().toFixed(1)}px`;
  document.getElementById('color-shift').textContent = `${Math.round(cycle.getColorShift() * 100)}%`;
  document.getElementById('noise').textContent = `${Math.round(cycle.getNoiseOverlay() * 100)}%`;
  document.getElementById('char-dropout').textContent = `${Math.round(cycle.getCharDropout() * 100)}%`;
  document.getElementById('ghost').textContent = `${Math.round(cycle.getDuplicateGhost().probability * 100)}%`;
  document.getElementById('slice').textContent = `${Math.round(cycle.getSliceDisplacement().probability * 100)}%`;
  document.getElementById('bit-crush').textContent = `${Math.round(cycle.getBitCrush() * 100)}%`;
  
  // Disable button at final state
  const stepBtn = document.getElementById('step-btn');
  if (cycle.isFinal()) {
    stepBtn.disabled = true;
    stepBtn.textContent = 'Final State Reached';
  }
}

// Update values that change continuously (LFO-modulated)
function updateLiveUI(timestamp) {
  const timeInSeconds = timestamp / 1000;
  const lambda = cycle.getLambda(timeInSeconds);
  document.getElementById('lambda').textContent = lambda.toFixed(2);
}

// --- Step Handler ---
function handleStep() {
  cycle.step();
  updateUI();
  console.log('Stepped to:', cycle.getState());
}

// --- Glitch Effect Colors ---
const GLITCH_COLORS = [
  'rgba(255, 0, 0, 0.9)',    // red
  'rgba(0, 255, 255, 0.9)',  // cyan
  'rgba(255, 0, 255, 0.9)',  // magenta
  'rgba(0, 255, 0, 0.9)',    // green
  'rgba(255, 255, 0, 0.9)',  // yellow
];

// --- Rendering ---
function updateAndRender(timestamp) {
  const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
  const deltaTimeMs = deltaTime * 1000;
  lastTime = timestamp;
  
  // Get current visual effect values
  const flicker = cycle.getFlicker();
  const fadeFlicker = cycle.getFadeFlicker();
  const inverseFlicker = cycle.getInverseFlicker();
  const chromatic = cycle.getChromaticAberration();
  const colorShift = cycle.getColorShift();
  const noiseIntensity = cycle.getNoiseOverlay();
  const charDropout = cycle.getCharDropout();
  const ghost = cycle.getDuplicateGhost();
  const slice = cycle.getSliceDisplacement();
  const bitCrush = cycle.getBitCrush();
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Spawn new snippets via Poisson process (with LFO-modulated lambda)
  if (timestamp >= nextSpawnTime) {
    spawnSnippet();
    nextSpawnTime = timestamp + getNextPoissonDelay(timestamp);
  }
  
  // Update live UI values
  updateLiveUI(timestamp);
  
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
    
    // Apply full flicker effect (skip rendering entirely)
    if (Math.random() < flicker) {
      continue;
    }
    
    // Calculate effective opacity
    let effectiveOpacity = s.opacity;
    
    // Apply fade flicker (partial opacity drop)
    if (Math.random() < fadeFlicker) {
      effectiveOpacity *= 0.3 + Math.random() * 0.5; // 30-80% opacity
    }
    
    // Get visible text
    let visibleText = s.text.slice(0, s.visibleChars);
    
    // Apply character dropout
    if (charDropout > 0) {
      visibleText = visibleText.split('').map(char => {
        return Math.random() < charDropout ? ' ' : char;
      }).join('');
    }
    
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    
    // Check for inverse flicker
    const isInverse = Math.random() < inverseFlicker;
    
    if (isInverse) {
      // Draw white background rect, black text
      const metrics = ctx.measureText(visibleText);
      const textHeight = s.fontSize * 1.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${effectiveOpacity})`;
      ctx.fillRect(s.x - 2, s.y - textHeight + 4, metrics.width + 4, textHeight);
      ctx.fillStyle = `rgba(0, 0, 0, ${effectiveOpacity})`;
      ctx.fillText(visibleText, s.x, s.y);
    } else {
      // Determine base color
      let baseColor = CONFIG.color;
      
      // Apply color shift
      if (Math.random() < colorShift) {
        baseColor = GLITCH_COLORS[Math.floor(Math.random() * GLITCH_COLORS.length)];
      }
      
      // Apply bit crush (posterize to limited colors)
      if (Math.random() < bitCrush) {
        const grayLevel = Math.floor(Math.random() * 4) * 85; // 0, 85, 170, 255
        baseColor = `rgba(${grayLevel}, ${grayLevel}, ${grayLevel}, ${effectiveOpacity})`;
      }
      
      // Apply chromatic aberration (RGB offset copies)
      if (chromatic > 0) {
        const offset = chromatic * (0.5 + Math.random() * 0.5);
        
        // Red channel (offset left)
        ctx.fillStyle = `rgba(255, 0, 0, ${effectiveOpacity * 0.5})`;
        ctx.fillText(visibleText, s.x - offset, s.y);
        
        // Blue channel (offset right)
        ctx.fillStyle = `rgba(0, 100, 255, ${effectiveOpacity * 0.5})`;
        ctx.fillText(visibleText, s.x + offset, s.y);
      }
      
      // Apply duplicate ghost
      if (Math.random() < ghost.probability) {
        ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity * ghost.opacity})`);
        const ghostOffsetX = (Math.random() - 0.5) * ghost.offset * 2;
        const ghostOffsetY = (Math.random() - 0.5) * ghost.offset * 2;
        ctx.fillText(visibleText, s.x + ghostOffsetX, s.y + ghostOffsetY);
      }
      
      // Apply slice displacement
      if (Math.random() < slice.probability && slice.maxSlices > 0) {
        const numSlices = 1 + Math.floor(Math.random() * slice.maxSlices);
        const sliceHeight = s.fontSize / numSlices;
        
        ctx.save();
        for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
          const sliceOffset = (Math.random() - 0.5) * slice.maxOffset * 2;
          const sliceY = s.y - s.fontSize + sliceIdx * sliceHeight;
          
          ctx.beginPath();
          ctx.rect(0, sliceY, canvas.width, sliceHeight);
          ctx.clip();
          
          ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity})`);
          ctx.fillText(visibleText, s.x + sliceOffset, s.y);
          
          ctx.restore();
          ctx.save();
        }
        ctx.restore();
      } else {
        // Normal render
        ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity})`);
        ctx.fillText(visibleText, s.x, s.y);
      }
    }
  }
  
  // Apply noise overlay
  if (noiseIntensity > 0) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const noiseAmount = noiseIntensity * 50;
    
    // Sparse noise (not every pixel)
    const noiseDensity = noiseIntensity * 0.01;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < noiseDensity) {
        const noise = (Math.random() - 0.5) * noiseAmount;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
    }
    ctx.putImageData(imageData, 0, 0);
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
  
  // Setup step button
  document.getElementById('step-btn').addEventListener('click', handleStep);
  
  await loadCorpus();
  
  // Initial UI state
  updateUI();
  
  // Start the render loop
  const startTime = performance.now();
  nextSpawnTime = startTime + getNextPoissonDelay(startTime);
  requestAnimationFrame(updateAndRender);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

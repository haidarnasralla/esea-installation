/**
 * Renderer - Handles canvas rendering and glitch effects
 */

// Glitch effect colors
const GLITCH_COLORS = [
  'rgba(255, 0, 0, 0.9)',    // red
  'rgba(0, 255, 255, 0.9)',  // cyan
  'rgba(255, 0, 255, 0.9)',  // magenta
  'rgba(0, 255, 0, 0.9)',    // green
  'rgba(255, 255, 0, 0.9)',  // yellow
];

/**
 * Render a single snippet with all glitch effects applied
 */
export function renderSnippet(ctx, snippet, effects, config) {
  const {
    flicker,
    fadeFlicker,
    inverseFlicker,
    chromatic,
    colorShift,
    charDropout,
    ghost,
    slice,
    bitCrush,
  } = effects;

  // Apply full flicker effect (skip rendering entirely)
  if (Math.random() < flicker) {
    return;
  }

  // Calculate effective opacity
  let effectiveOpacity = snippet.opacity;

  // Apply fade flicker (partial opacity drop)
  if (Math.random() < fadeFlicker) {
    effectiveOpacity *= 0.3 + Math.random() * 0.5; // 30-80% opacity
  }

  // Get visible text
  let visibleText = snippet.text.slice(0, snippet.visibleChars);

  // Apply character dropout
  if (charDropout > 0) {
    visibleText = visibleText.split('').map(char => {
      return Math.random() < charDropout ? ' ' : char;
    }).join('');
  }

  ctx.font = `${snippet.fontSize}px ${snippet.fontFamily}`;

  // Check for inverse flicker
  const isInverse = Math.random() < inverseFlicker;

  if (isInverse) {
    renderInverse(ctx, snippet, visibleText, effectiveOpacity, config);
  } else {
    renderNormal(ctx, snippet, visibleText, effectiveOpacity, effects, config);
  }
}

/**
 * Render text with inverted colors (white background, black text)
 */
function renderInverse(ctx, snippet, visibleText, effectiveOpacity, config) {
  const metrics = ctx.measureText(visibleText);
  const textHeight = snippet.fontSize * config.lineHeightMultiplier;
  
  ctx.fillStyle = `rgba(255, 255, 255, ${effectiveOpacity})`;
  ctx.fillRect(snippet.x - 2, snippet.y - textHeight + 4, metrics.width + 4, textHeight);
  ctx.fillStyle = `rgba(0, 0, 0, ${effectiveOpacity})`;
  ctx.fillText(visibleText, snippet.x, snippet.y);
}

/**
 * Render text normally with glitch effects
 */
function renderNormal(ctx, snippet, visibleText, effectiveOpacity, effects, config) {
  const { chromatic, colorShift, ghost, slice, bitCrush } = effects;
  
  // Determine base color
  let baseColor = config.color;

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
    ctx.fillText(visibleText, snippet.x - offset, snippet.y);

    // Blue channel (offset right)
    ctx.fillStyle = `rgba(0, 100, 255, ${effectiveOpacity * 0.5})`;
    ctx.fillText(visibleText, snippet.x + offset, snippet.y);
  }

  // Apply duplicate ghost
  if (Math.random() < ghost.probability) {
    ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity * ghost.opacity})`);
    const ghostOffsetX = (Math.random() - 0.5) * ghost.offset * 2;
    const ghostOffsetY = (Math.random() - 0.5) * ghost.offset * 2;
    ctx.fillText(visibleText, snippet.x + ghostOffsetX, snippet.y + ghostOffsetY);
  }

  // Apply slice displacement
  if (Math.random() < slice.probability && slice.maxSlices > 0) {
    renderSliced(ctx, snippet, visibleText, effectiveOpacity, baseColor, slice, config);
  } else {
    // Normal render
    ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity})`);
    ctx.fillText(visibleText, snippet.x, snippet.y);
  }
}

/**
 * Render text with slice displacement effect
 */
function renderSliced(ctx, snippet, visibleText, effectiveOpacity, baseColor, slice, config) {
  const numSlices = 1 + Math.floor(Math.random() * slice.maxSlices);
  const sliceHeight = snippet.fontSize / numSlices;

  ctx.save();
  for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
    const sliceOffset = (Math.random() - 0.5) * slice.maxOffset * 2;
    const sliceY = snippet.y - snippet.fontSize + sliceIdx * sliceHeight;

    ctx.beginPath();
    ctx.rect(0, sliceY, ctx.canvas.width, sliceHeight);
    ctx.clip();

    ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, `${effectiveOpacity})`);
    ctx.fillText(visibleText, snippet.x + sliceOffset, snippet.y);

    ctx.restore();
    ctx.save();
  }
  ctx.restore();
}

/**
 * Render a snippet that is flickering out (dying)
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} snippet - The snippet object
 * @param {number} progress - 0 (just started) to 1 (about to disappear)
 * @param {object} flickerParams - { intensity, characterScatter, jitter }
 * @param {object} effects - Standard visual effects
 * @param {object} config - CONFIG object
 */
export function renderFlickerOut(ctx, snippet, progress, flickerParams, effects, config) {
  const { intensity, characterScatter, jitter } = flickerParams;
  
  // Base visibility probability decreases as progress increases
  // Starts at 100%, ends near 0%, with increasing flicker frequency
  const baseVisibility = 1 - progress;
  
  // Flicker frequency increases with progress and intensity
  // Creates staccato effect that accelerates toward the end
  const flickerSpeed = 5 + progress * 20 * intensity; // Hz equivalent
  const flickerPhase = (performance.now() / 1000) * flickerSpeed;
  const flickerWave = Math.sin(flickerPhase * Math.PI * 2);
  
  // Combine base visibility with flicker wave
  // As progress increases, the "on" windows get shorter
  const flickerThreshold = baseVisibility * (0.5 + 0.5 * intensity);
  const isVisible = flickerWave > (1 - flickerThreshold * 2);
  
  // Random dropout chance increases with progress
  const randomDropout = Math.random() > baseVisibility * (1 - intensity * 0.5);
  
  if (!isVisible || randomDropout) {
    // Maybe render a ghost/residue flash occasionally
    if (progress > 0.3 && Math.random() < intensity * 0.1) {
      renderGhostFlash(ctx, snippet, config);
    }
    return;
  }
  
  // Calculate jitter offset
  const jitterAmount = jitter * progress * progress; // Accelerates
  const jitterX = (Math.random() - 0.5) * jitterAmount * 2;
  const jitterY = (Math.random() - 0.5) * jitterAmount * 2;
  
  // Apply position jitter
  const jitteredSnippet = {
    ...snippet,
    x: snippet.x + jitterX,
    y: snippet.y + jitterY,
  };
  
  // Character scatter: individual characters may disappear
  if (characterScatter > 0) {
    renderScatteredText(ctx, jitteredSnippet, progress, characterScatter, effects, config);
  } else {
    // Render normally with reduced opacity
    const fadedSnippet = {
      ...jitteredSnippet,
      opacity: snippet.opacity * baseVisibility,
    };
    renderSnippet(ctx, fadedSnippet, effects, config);
  }
}

/**
 * Render a brief ghost flash (residue of dying text)
 */
function renderGhostFlash(ctx, snippet, config) {
  ctx.save();
  ctx.font = `${snippet.fontSize}px ${snippet.fontFamily}`;
  ctx.globalAlpha = 0.15 + Math.random() * 0.1;
  
  // Slight offset
  const offsetX = (Math.random() - 0.5) * 8;
  const offsetY = (Math.random() - 0.5) * 8;
  
  // Random color: white, cyan, or original
  const colors = [
    'rgba(255, 255, 255, 1)',
    'rgba(0, 255, 255, 1)',
    config.color,
  ];
  ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
  
  ctx.fillText(
    snippet.text.slice(0, snippet.visibleChars),
    snippet.x + offsetX,
    snippet.y + offsetY
  );
  ctx.restore();
}

/**
 * Render text with individual characters disappearing at different rates
 */
function renderScatteredText(ctx, snippet, progress, scatterIntensity, effects, config) {
  ctx.save();
  ctx.font = `${snippet.fontSize}px ${snippet.fontFamily}`;
  
  const visibleText = snippet.text.slice(0, snippet.visibleChars);
  let currentX = snippet.x;
  
  // Base opacity decreases with progress
  const baseOpacity = snippet.opacity * (1 - progress);
  
  for (let i = 0; i < visibleText.length; i++) {
    const char = visibleText[i];
    
    // Each character has its own "death time" based on scatter intensity
    // Some characters die early, some hold on longer
    const charSeed = (i * 7919) % 1000 / 1000; // Pseudo-random per character
    const charDeathTime = charSeed * scatterIntensity + (1 - scatterIntensity);
    
    // Character is visible if progress hasn't reached its death time
    // Plus some random flicker near death
    const charProgress = progress / charDeathTime;
    const charVisible = charProgress < 1 && (Math.random() > charProgress * scatterIntensity);
    
    if (charVisible && char !== ' ') {
      // Individual character jitter
      const charJitter = progress * scatterIntensity * 3;
      const charOffsetX = (Math.random() - 0.5) * charJitter;
      const charOffsetY = (Math.random() - 0.5) * charJitter;
      
      // Opacity varies per character
      const charOpacity = baseOpacity * (1 - charProgress * 0.5);
      
      // Occasional color glitch on individual characters
      if (Math.random() < effects.colorShift) {
        ctx.fillStyle = GLITCH_COLORS[Math.floor(Math.random() * GLITCH_COLORS.length)];
      } else {
        ctx.fillStyle = config.color.replace(/[\d.]+\)$/, `${charOpacity})`);
      }
      
      ctx.fillText(char, currentX + charOffsetX, snippet.y + charOffsetY);
    }
    
    // Advance X position (even for invisible chars to maintain spacing)
    currentX += ctx.measureText(char).width;
  }
  
  ctx.restore();
}

/**
 * Apply noise overlay using pre-generated textures
 */
export function applyNoiseOverlay(ctx, canvas, noiseTextures, noiseIndex, intensity) {
  if (intensity <= 0 || noiseTextures.length === 0) {
    return noiseIndex;
  }

  const newIndex = (noiseIndex + 1) % noiseTextures.length;
  const noiseCanvas = noiseTextures[newIndex];

  ctx.save();
  ctx.globalAlpha = intensity * 0.5;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(noiseCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  return newIndex;
}

/**
 * Generate pre-computed noise textures
 */
export function generateNoiseTextures(width, height, count = 5) {
  const textures = [];
  const scaledWidth = Math.ceil(width / 4); // quarter resolution
  const scaledHeight = Math.ceil(height / 4);

  for (let n = 0; n < count; n++) {
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = scaledWidth;
    noiseCanvas.height = scaledHeight;
    const noiseCtx = noiseCanvas.getContext('2d');

    const imageData = noiseCtx.createImageData(scaledWidth, scaledHeight);
    const data = imageData.data;

    // Sparse noise pattern
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < 0.03) { // 3% of pixels have noise
        const noise = Math.floor((Math.random() - 0.5) * 100);
        data[i] = 128 + noise;     // R
        data[i + 1] = 128 + noise; // G
        data[i + 2] = 128 + noise; // B
        data[i + 3] = 255;         // A
      } else {
        data[i + 3] = 0; // transparent
      }
    }

    noiseCtx.putImageData(imageData, 0, 0);
    textures.push(noiseCanvas);
  }

  console.log(`Generated ${count} noise textures at ${scaledWidth}x${scaledHeight}`);
  return textures;
}

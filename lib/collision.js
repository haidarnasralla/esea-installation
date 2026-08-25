/**
 * Collision detection and position finding for text snippets
 */

/**
 * Get bounding box for a snippet
 */
export function getSnippetBounds(ctx, snippet, lineHeightMultiplier) {
  ctx.font = `${snippet.fontSize}px ${snippet.fontFamily}`;
  const metrics = ctx.measureText(snippet.text);
  const width = metrics.width;
  const height = snippet.fontSize * lineHeightMultiplier;

  return {
    x: snippet.x,
    y: snippet.y - height, // text baseline is at y, so top is above
    width,
    height,
    centerX: snippet.x + width / 2,
    centerY: snippet.y - height / 2,
  };
}

/**
 * Check if a new bounding box overlaps with existing snippets
 */
export function checkOverlap(newBounds, existingSnippets, ctx, minDistance, tolerance, lineHeightMultiplier) {
  for (const snippet of existingSnippets) {
    // Use cached bounds if available (avoids expensive measureText calls)
    const existing = snippet.cachedBounds || getSnippetBounds(ctx, snippet, lineHeightMultiplier);

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

/**
 * Find a valid position for a new snippet that doesn't overlap existing ones
 */
export function findValidPosition(ctx, canvas, text, fontSize, fontFamily, snippets, cycle, config, maxAttempts = 20) {
  const tolerance = cycle.getOverlapTolerance();
  const minDistance = cycle.getMinSpawnDistance();
  const lineHeightMultiplier = config.lineHeightMultiplier;

  ctx.font = `${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize * lineHeightMultiplier;

  const padding = config.edgePadding;

  // Calculate safe bounds (text must stay fully inside)
  const minX = padding;
  const maxX = canvas.width - textWidth - padding;
  const minY = textHeight + padding; // baseline is at y, so need room above
  const maxY = canvas.height - padding;

  // If text is too wide or tall for canvas, allow edge placement
  const safeMaxX = Math.max(minX, maxX);
  const safeMaxY = Math.max(minY, maxY);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = minX + Math.random() * (safeMaxX - minX);
    const y = minY + Math.random() * (safeMaxY - minY);

    const newBounds = {
      x,
      y: y - textHeight,
      width: textWidth,
      height: textHeight,
      centerX: x + textWidth / 2,
      centerY: y - textHeight / 2,
    };

    if (!checkOverlap(newBounds, snippets, ctx, minDistance, tolerance, lineHeightMultiplier)) {
      return { x, y, valid: true };
    }
  }

  // If we couldn't find a valid position:
  // - In early phases, skip this spawn
  // - In later phases (tolerance > 0.3), allow overlap anyway
  if (tolerance > 0.3) {
    return {
      x: minX + Math.random() * (safeMaxX - minX),
      y: minY + Math.random() * (safeMaxY - minY),
      valid: true,
    };
  }

  return { x: 0, y: 0, valid: false };
}

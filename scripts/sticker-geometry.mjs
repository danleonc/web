// Raster component analysis for exporting individual stickers from reviewed sheets.
// Drawing/style repairs happen in the image tool; this isolates the exported silhouette.
export function alphaComponents(data, width, height) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] < 128) continue;
    const id = components.length + 1;
    let read = 0,
      write = 1,
      left = width,
      top = height,
      right = -1,
      bottom = -1;
    queue[0] = start;
    labels[start] = id;
    while (read < write) {
      const pixel = queue[read++],
        x = pixel % width,
        y = Math.floor(pixel / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      const neighbors = [
        x ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        y ? pixel - width : -1,
        y + 1 < height ? pixel + width : -1,
      ];
      for (const next of neighbors)
        if (next >= 0 && !labels[next] && data[next * 4 + 3] >= 128) {
          labels[next] = id;
          queue[write++] = next;
        }
    }
    components.push({ id, area: write, left, top, right, bottom });
  }
  return { labels, components: components.sort((a, b) => b.area - a.area) };
}

export function isolateSticker(data, width, height, name) {
  const { labels, components } = alphaComponents(data, width, height);
  const main = components[0];
  const touchesEdge = (c) =>
    c.left < 3 || c.top < 3 || c.right >= width - 3 || c.bottom >= height - 3;
  if (!main || main.area < width * height * 0.1)
    throw Error(`${name}: missing or undersized character.`);
  if (touchesEdge(main))
    throw Error(
      `${name}: the character touches a tile edge; repair the sheet instead of clipping it.`,
    );
  const keep = new Set([main.id]);
  for (const c of components.slice(1)) {
    if (c.area < 64 || touchesEdge(c)) continue;
    const gapX = Math.max(0, main.left - c.right, c.left - main.right);
    const gapY = Math.max(0, main.top - c.bottom, c.top - main.bottom);
    if (c.area < main.area * 0.15 && Math.hypot(gapX, gapY) <= 20)
      keep.add(c.id);
    else
      throw Error(
        `${name}: ambiguous detached element (${c.area}px at ${c.left},${c.top}); review the sheet.`,
      );
  }
  // Two pixels of the source's antialiased contour around the selected solid silhouette.
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < labels.length; p++)
    if (keep.has(labels[p])) {
      const x = p % width,
        y = Math.floor(p / width);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height)
            mask[ny * width + nx] = 1;
        }
    }
  const pixels = Buffer.alloc(data.length);
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let p = 0; p < mask.length; p++)
    if (mask[p] && data[p * 4 + 3] > 0) {
      data.copy(pixels, p * 4, p * 4, p * 4 + 4);
      const x = p % width,
        y = Math.floor(p / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return {
    pixels,
    bounds: { left, top, width: right - left + 1, height: bottom - top + 1 },
  };
}

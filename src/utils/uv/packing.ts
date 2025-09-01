import type { Mesh, Vector2 } from '@/types/geometry';
import type { Island, SmartUVOptions } from './types';
import { fitUVs01, islandArea3D } from './common';

function rotateIsland90(mesh: Mesh, island: Island) {
  let cx = 0, cy = 0, n = 0;
  for (const vid of island.verts) { const v = mesh.vertices.find(vv => vv.id === vid)!; cx += v.uv.x; cy += v.uv.y; n++; }
  if (!n) return; cx /= n; cy /= n;
  for (const vid of island.verts) {
    const v = mesh.vertices.find(vv => vv.id === vid)!;
    const x = v.uv.x - cx, y = v.uv.y - cy;
    v.uv = { x: cx - y, y: cy + x };
  }
}

export function packShelfLayout(mesh: Mesh, islands: Island[], padding = 0.02) {
  type BBox = { island: Island; min: Vector2; max: Vector2; size: Vector2 };
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const bbox: BBox[] = islands.map(is => {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) {
      const uv = vById.get(vid)!.uv;
      if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y;
      if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y;
    }
    return { island: is, min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } };
  });
  if (!bbox.length) return;

  const canPack = (s: number, bboxes: BBox[]) => {
    const sorted = [...bboxes].sort((a, b) => b.size.y * s - a.size.y * s);
    let y = padding, rowH = 0, rowX = padding;
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      const w = b.size.x * s, h = b.size.y * s;
      if (rowX + w > 1 - padding) {
        y += rowH + padding;
        if (y + h > 1 - padding) return false;
        rowX = padding; rowH = h;
      } else {
        if (h > rowH) rowH = h;
      }
      rowX += w + padding;
    }
    y += rowH + padding;
    return y <= 1;
  };

  let low = 0, high = 100;
  for (let it = 0; it < 50; it++) { const mid = (low + high) / 2; if (canPack(mid, bbox)) low = mid; else high = mid; }
  const scale = low;
  bbox.sort((a, b) => b.size.y * scale - a.size.y * scale);
  let y = padding, rowH = 0, rowX = padding;
  for (let i = 0; i < bbox.length; i++) {
    const b = bbox[i];
    const w = b.size.x * scale, h = b.size.y * scale;
    if (rowX + w > 1 - padding) { y += rowH + padding; rowX = padding; rowH = h; }
    const dx = rowX - b.min.x * scale; const dy = y - b.min.y * scale;
    for (const vid of b.island.verts) {
      const v = vById.get(vid)!;
      v.uv = { x: v.uv.x * scale + dx, y: v.uv.y * scale + dy };
    }
    rowX += w + padding; if (h > rowH) rowH = h;
  }
}

export function packIslands01(mesh: Mesh, islands: Island[], padding = 0.02) {
  for (const is of islands) fitUVs01(mesh, is.verts);
  packShelfLayout(mesh, islands, padding);
}

export function packIslandsSmart(mesh: Mesh, islands: Island[], opts: SmartUVOptions) {
  for (const is of islands) fitUVs01(mesh, is.verts);

  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  for (const is of islands) {
    // compute bbox inline for perf
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) { const uv = vById.get(vid)!.uv; if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y; if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y; }
    const before = { min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } };
    if (opts.rotationMethod === 'axis-aligned') {
      rotateIsland90(mesh, is);
      // recompute bbox
      minU = Infinity; minV = Infinity; maxU = -Infinity; maxV = -Infinity;
      for (const vid of is.verts) { const uv = vById.get(vid)!.uv; if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y; if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y; }
      const after = { min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } };
      if (!(after.size.y < before.size.y)) { rotateIsland90(mesh, is); rotateIsland90(mesh, is); rotateIsland90(mesh, is); }
    } else if (opts.rotationMethod === 'axis-aligned-vertical') {
      if (before.size.x > before.size.y) rotateIsland90(mesh, is);
    } else if (opts.rotationMethod === 'axis-aligned-horizontal') {
      if (before.size.y > before.size.x) rotateIsland90(mesh, is);
    }
  }

  const areas = islands.map(is => islandArea3D(mesh, is));
  const maxA = Math.max(1e-6, ...areas);
  const pow = Math.max(0, Math.min(1, opts.areaWeight));
  const weights = areas.map(a => Math.pow(a / maxA, pow));
  for (let i = 0; i < islands.length; i++) {
    const is = islands[i]; const w = weights[i] || 1;
    if (Math.abs(w - 1) < 1e-6) continue;
    // compute bbox inline
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) { const uv = vById.get(vid)!.uv; if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y; if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y; }
    for (const vid of is.verts) {
      const v = vById.get(vid)!;
      v.uv = { x: minU + (v.uv.x - minU) * w, y: minV + (v.uv.y - minV) * w };
    }
  }

  type BBox = { island: Island; min: Vector2; max: Vector2; size: Vector2 };
  const bbox: BBox[] = islands.map(is => {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) { const uv = vById.get(vid)!.uv; if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y; if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y; }
    return { island: is, min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } };
  });
  bbox.sort((a, b) => b.size.y - a.size.y);

  const basePad = Math.max(0, opts.islandMargin || 0);
  const padForScale = (s: number) => (opts.marginMethod === 'scaled' ? basePad * s : basePad);

  const canPack = (s: number) => {
    const padding = padForScale(s);
    let y = padding, rowH = 0, rowX = padding;
    for (let i = 0; i < bbox.length; i++) {
      const b = bbox[i];
      const w = b.size.x * s, h = b.size.y * s;
      if (w <= 0 || h <= 0) continue;
      if (rowX + w > 1 - padding) {
        y += rowH + padding; if (y + h > 1 - padding) return false; rowX = padding; rowH = h;
      } else {
        if (h > rowH) rowH = h;
      }
      rowX += w + padding;
    }
    y += rowH + padding;
    return y <= 1;
  };

  let scale = 1;
  if (opts.scaleToBounds) {
    let low = 0, high = 100; for (let it = 0; it < 50; it++) { const mid = (low + high) / 2; if (canPack(mid)) low = mid; else high = mid; } scale = low;
  } else if (!canPack(1)) {
    let low = 0, high = 1; for (let it = 0; it < 40; it++) { const mid = (low + high) / 2; if (canPack(mid)) low = mid; else high = mid; } scale = low;
  }

  const padding = padForScale(scale);
  let y = padding, rowH = 0, rowX = padding;
  for (let i = 0; i < bbox.length; i++) {
    const b = bbox[i];
    const w = b.size.x * scale, h = b.size.y * scale;
    if (w <= 0 || h <= 0) continue;
    if (rowX + w > 1 - padding) { y += rowH + padding; rowX = padding; rowH = h; }
    const dx = rowX - b.min.x * scale; const dy = y - b.min.y * scale;
    for (const vid of b.island.verts) {
      const v = vById.get(vid)!;
      v.uv = { x: v.uv.x * scale + dx, y: v.uv.y * scale + dy };
    }
    rowX += w + padding; if (h > rowH) rowH = h;
  }
}

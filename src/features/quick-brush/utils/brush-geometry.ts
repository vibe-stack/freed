/**
 * Geometry builders for Quick Brush shapes that don't exist in src/utils/geometry.ts.
 * Returns { vertices, faces } matching the BuiltGeometry interface.
 */
import { createVertex, createFace, vec3, vec2 } from '@/utils/geometry';
import type { BuiltGeometry } from '@/utils/geometry';

// ---------- Wedge / Slope (triangular prism) ----------
// Origin at bottom-center. Sloped from back-bottom to front-top.
//
//   top-front edge
//   /|
//  / |  height
// /  |
// ----  depth
// width
export function buildWedgeGeometry(width: number, height: number, depth: number): BuiltGeometry {
  const hw = width / 2;
  const hd = depth / 2;

  // 6 vertices: bottom quad (4) + top front edge (2)
  // Bottom face
  const bfl = createVertex(vec3(-hw, 0, -hd), vec3(0, -1, 0), vec2(0, 0));
  const bfr = createVertex(vec3(hw, 0, -hd), vec3(0, -1, 0), vec2(1, 0));
  const bbl = createVertex(vec3(-hw, 0, hd), vec3(0, -1, 0), vec2(0, 1));
  const bbr = createVertex(vec3(hw, 0, hd), vec3(0, -1, 0), vec2(1, 1));
  // Top front edge (same X as bottom-front, elevated)
  const tfl = createVertex(vec3(-hw, height, -hd), vec3(0, 0, -1), vec2(0, 1));
  const tfr = createVertex(vec3(hw, height, -hd), vec3(0, 0, -1), vec2(1, 1));

  const vertices = [bfl, bfr, bbl, bbr, tfl, tfr];

  const faces = [
    // Bottom face (ccw from below)
    createFace([bfl.id, bbl.id, bbr.id, bfr.id]),
    // Front face (vertical wall)
    createFace([bfl.id, bfr.id, tfr.id, tfl.id]),
    // Slope (top face — the ramp surface)
    createFace([tfl.id, tfr.id, bbr.id, bbl.id]),
    // Left triangle
    createFace([bfl.id, tfl.id, bbl.id]),
    // Right triangle
    createFace([bfr.id, bbr.id, tfr.id]),
  ];

  return { vertices, faces };
}

// ---------- Stairs ----------
// Generates `steps` equal-height steps stacked along the depth axis.
// Origin at bottom-front-center.
export function buildStairsGeometry(width: number, height: number, depth: number, steps: number): BuiltGeometry {
  const clampedSteps = Math.max(2, Math.min(16, steps));
  const hw = width / 2;
  const stepH = height / clampedSteps;
  const stepD = depth / clampedSteps;

  const vertices: ReturnType<typeof createVertex>[] = [];
  const faces: ReturnType<typeof createFace>[] = [];

  for (let i = 0; i < clampedSteps; i++) {
    const x0 = -hw;
    const x1 = hw;
    const y0 = i * stepH;
    const y1 = (i + 1) * stepH;
    const z0 = -(i + 1) * stepD;  // front of this step
    const z1 = -i * stepD;         // back of previous step / front-top of this step

    // Each step is a box: front face (riser) + top face (tread)
    // We need 4 corners per step for riser, 4 for tread
    // To keep it simple, emit a box for each step
    const v = [
      // Bottom-front-left, bottom-front-right, bottom-back-left, bottom-back-right
      createVertex(vec3(x0, y0, z0)),
      createVertex(vec3(x1, y0, z0)),
      createVertex(vec3(x0, y0, z1)),
      createVertex(vec3(x1, y0, z1)),
      // Top-front-left, top-front-right, top-back-left, top-back-right
      createVertex(vec3(x0, y1, z0)),
      createVertex(vec3(x1, y1, z0)),
      createVertex(vec3(x0, y1, z1)),
      createVertex(vec3(x1, y1, z1)),
    ];
    vertices.push(...v);

    const [bfl, bfr, bbl, bbr, tfl, tfr, tbl, tbr] = v;
    // Bottom
    faces.push(createFace([bfl.id, bbl.id, bbr.id, bfr.id]));
    // Top (tread)
    faces.push(createFace([tfl.id, tfr.id, tbr.id, tbl.id]));
    // Front (riser)
    faces.push(createFace([bfl.id, bfr.id, tfr.id, tfl.id]));
    // Back
    faces.push(createFace([bbl.id, tbl.id, tbr.id, bbr.id]));
    // Left
    faces.push(createFace([bfl.id, tfl.id, tbl.id, bbl.id]));
    // Right
    faces.push(createFace([bfr.id, bbr.id, tbr.id, tfr.id]));
  }

  return { vertices, faces };
}

// ---------- Door Frame ----------
// Two pillars + lintel. The opening is left open.
// Origin at bottom-center.
export function buildDoorGeometry(
  width: number,
  height: number,
  depth: number,
  wallThickness: number = 0.15
): BuiltGeometry {
  const hw = width / 2;
  const t = Math.min(wallThickness, width * 0.3);
  const lintelH = Math.max(height * 0.08, 0.1);
  const openingH = height - lintelH;
  const openingHW = hw - t;

  const vertices: ReturnType<typeof createVertex>[] = [];
  const faces: ReturnType<typeof createFace>[] = [];

  function addBox(
    x0: number, x1: number,
    y0: number, y1: number,
    z0: number, z1: number
  ) {
    const v = [
      createVertex(vec3(x0, y0, z0)), // bfl 0
      createVertex(vec3(x1, y0, z0)), // bfr 1
      createVertex(vec3(x0, y0, z1)), // bbl 2
      createVertex(vec3(x1, y0, z1)), // bbr 3
      createVertex(vec3(x0, y1, z0)), // tfl 4
      createVertex(vec3(x1, y1, z0)), // tfr 5
      createVertex(vec3(x0, y1, z1)), // tbl 6
      createVertex(vec3(x1, y1, z1)), // tbr 7
    ];
    vertices.push(...v);
    const [bfl, bfr, bbl, bbr, tfl, tfr, tbl, tbr] = v;
    faces.push(createFace([bfl.id, bbl.id, bbr.id, bfr.id])); // bottom
    faces.push(createFace([tfl.id, tfr.id, tbr.id, tbl.id])); // top
    faces.push(createFace([bfl.id, bfr.id, tfr.id, tfl.id])); // front
    faces.push(createFace([bbl.id, tbl.id, tbr.id, bbr.id])); // back
    faces.push(createFace([bfl.id, tfl.id, tbl.id, bbl.id])); // left
    faces.push(createFace([bfr.id, bbr.id, tbr.id, tfr.id])); // right
  }

  const hd = depth / 2;

  // Left pillar
  addBox(-hw, -openingHW, 0, height, -hd, hd);
  // Right pillar
  addBox(openingHW, hw, 0, height, -hd, hd);
  // Lintel (horizontal top bar)
  addBox(-openingHW, openingHW, openingH, height, -hd, hd);

  return { vertices, faces };
}

// ---------- Arch ----------
// Two pillars + semicircular arch top.
// Origin at bottom-center.
export function buildArchGeometry(
  width: number,
  height: number,
  depth: number,
  segments: number = 8
): BuiltGeometry {
  const hw = width / 2;
  const t = Math.min(width * 0.15, 0.25);
  const pillarH = height * 0.5;
  const archRadius = (width / 2) - t;
  const archCenterY = pillarH;
  const hd = depth / 2;

  const vertices: ReturnType<typeof createVertex>[] = [];
  const faces: ReturnType<typeof createFace>[] = [];

  function addBox(
    x0: number, x1: number,
    y0: number, y1: number,
    z0: number, z1: number
  ) {
    const v = [
      createVertex(vec3(x0, y0, z0)),
      createVertex(vec3(x1, y0, z0)),
      createVertex(vec3(x0, y0, z1)),
      createVertex(vec3(x1, y0, z1)),
      createVertex(vec3(x0, y1, z0)),
      createVertex(vec3(x1, y1, z0)),
      createVertex(vec3(x0, y1, z1)),
      createVertex(vec3(x1, y1, z1)),
    ];
    vertices.push(...v);
    const [bfl, bfr, bbl, bbr, tfl, tfr, tbl, tbr] = v;
    faces.push(createFace([bfl.id, bbl.id, bbr.id, bfr.id]));
    faces.push(createFace([tfl.id, tfr.id, tbr.id, tbl.id]));
    faces.push(createFace([bfl.id, bfr.id, tfr.id, tfl.id]));
    faces.push(createFace([bbl.id, tbl.id, tbr.id, bbr.id]));
    faces.push(createFace([bfl.id, tfl.id, tbl.id, bbl.id]));
    faces.push(createFace([bfr.id, bbr.id, tbr.id, tfr.id]));
  }

  // Left pillar
  addBox(-hw, -archRadius, 0, pillarH, -hd, hd);
  // Right pillar
  addBox(archRadius, hw, 0, pillarH, -hd, hd);

  // Arch segments: wedge-shaped pieces forming the semicircle
  const clampedSeg = Math.max(4, Math.min(16, segments));
  for (let i = 0; i < clampedSeg; i++) {
    const a0 = Math.PI * (i / clampedSeg);
    const a1 = Math.PI * ((i + 1) / clampedSeg);

    // Inner radius points
    const ix0 = -Math.cos(a0) * archRadius;
    const iy0 = Math.sin(a0) * archRadius + archCenterY;
    const ix1 = -Math.cos(a1) * archRadius;
    const iy1 = Math.sin(a1) * archRadius + archCenterY;

    // Outer radius points
    const ox0 = -Math.cos(a0) * (archRadius + t);
    const oy0 = Math.sin(a0) * (archRadius + t) + archCenterY;
    const ox1 = -Math.cos(a1) * (archRadius + t);
    const oy1 = Math.sin(a1) * (archRadius + t) + archCenterY;

    // Front face (z = -hd)
    const fi0 = createVertex(vec3(ix0, iy0, -hd));
    const fi1 = createVertex(vec3(ix1, iy1, -hd));
    const fo0 = createVertex(vec3(ox0, oy0, -hd));
    const fo1 = createVertex(vec3(ox1, oy1, -hd));
    // Back face (z = hd)
    const bi0 = createVertex(vec3(ix0, iy0, hd));
    const bi1 = createVertex(vec3(ix1, iy1, hd));
    const bo0 = createVertex(vec3(ox0, oy0, hd));
    const bo1 = createVertex(vec3(ox1, oy1, hd));

    vertices.push(fi0, fi1, fo0, fo1, bi0, bi1, bo0, bo1);

    // Front face
    faces.push(createFace([fo0.id, fo1.id, fi1.id, fi0.id]));
    // Back face
    faces.push(createFace([bi0.id, bi1.id, bo1.id, bo0.id]));
    // Outer surface
    faces.push(createFace([fo0.id, bo0.id, bo1.id, fo1.id]));
    // Inner surface (opening)
    faces.push(createFace([fi0.id, fi1.id, bi1.id, bi0.id]));
    // Side caps
    faces.push(createFace([fo0.id, fi0.id, bi0.id, bo0.id]));
    faces.push(createFace([fi1.id, fo1.id, bo1.id, bi1.id]));
  }

  return { vertices, faces };
}

import { Vector3, Vector2, Vertex, Edge, Face, Mesh } from '../types/geometry';
import { nanoid } from 'nanoid';

// Vector utilities
export const vec3 = (x: number = 0, y: number = 0, z: number = 0): Vector3 => ({ x, y, z });
export const vec2 = (x: number = 0, y: number = 0): Vector2 => ({ x, y });

export const addVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const subtractVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const multiplyVec3 = (a: Vector3, scalar: number): Vector3 => ({
  x: a.x * scalar,
  y: a.y * scalar,
  z: a.z * scalar,
});

export const dotVec3 = (a: Vector3, b: Vector3): number => {
  return a.x * b.x + a.y * b.y + a.z * b.z;
};

export const crossVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const normalizeVec3 = (v: Vector3): Vector3 => {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return multiplyVec3(v, 1 / length);
};

export const lengthVec3 = (v: Vector3): number => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

// Geometry creation utilities
export const createVertex = (
  position: Vector3,
  normal: Vector3 = vec3(0, 1, 0),
  uv: Vector2 = vec2(0, 0)
): Vertex => ({
  id: nanoid(),
  position,
  normal,
  uv,
  selected: false,
});

export const createEdge = (vertexId1: string, vertexId2: string): Edge => ({
  id: nanoid(),
  vertexIds: [vertexId1, vertexId2],
  faceIds: [],
  selected: false,
});

export const createFace = (vertexIds: string[]): Face => {
  if (vertexIds.length < 3) {
    throw new Error('Face must have at least 3 vertices');
  }
  
  return {
    id: nanoid(),
    vertexIds,
    normal: vec3(0, 1, 0), // Will be calculated later
    selected: false,
  };
};

// Geometry computation utilities
export const calculateFaceNormal = (face: Face, vertices: Vertex[]): Vector3 => {
  if (face.vertexIds.length < 3) return vec3(0, 1, 0);
  
  const vertexMap = new Map(vertices.map(v => [v.id, v]));
  const v0 = vertexMap.get(face.vertexIds[0]);
  const v1 = vertexMap.get(face.vertexIds[1]);
  const v2 = vertexMap.get(face.vertexIds[2]);
  
  if (!v0 || !v1 || !v2) return vec3(0, 1, 0);
  
  const edge1 = subtractVec3(v1.position, v0.position);
  const edge2 = subtractVec3(v2.position, v0.position);
  
  return normalizeVec3(crossVec3(edge1, edge2));
};

export const calculateVertexNormals = (mesh: Mesh): Vertex[] => {
  // Create a map of vertex normals (accumulated from adjacent faces)
  const vertexNormals = new Map<string, Vector3>();
  
  // Initialize all vertex normals to zero
  mesh.vertices.forEach(vertex => {
    vertexNormals.set(vertex.id, vec3(0, 0, 0));
  });
  
  // Accumulate normals from all faces
  mesh.faces.forEach(face => {
    const faceNormal = calculateFaceNormal(face, mesh.vertices);
    
    face.vertexIds.forEach(vertexId => {
      const currentNormal = vertexNormals.get(vertexId) || vec3(0, 0, 0);
      vertexNormals.set(vertexId, addVec3(currentNormal, faceNormal));
    });
  });
  
  // Normalize and return updated vertices
  return mesh.vertices.map(vertex => ({
    ...vertex,
    normal: normalizeVec3(vertexNormals.get(vertex.id) || vec3(0, 1, 0)),
  }));
};

// Primitive creation functions
export const createCubeMesh = (size: number = 1): Mesh => {
  const half = size / 2;
  
  // Create vertices
  const vertices: Vertex[] = [
    // Front face
    createVertex(vec3(-half, -half,  half), vec3(0, 0, 1), vec2(0, 0)), // 0
    createVertex(vec3( half, -half,  half), vec3(0, 0, 1), vec2(1, 0)), // 1
    createVertex(vec3( half,  half,  half), vec3(0, 0, 1), vec2(1, 1)), // 2
    createVertex(vec3(-half,  half,  half), vec3(0, 0, 1), vec2(0, 1)), // 3
    
    // Back face
    createVertex(vec3(-half, -half, -half), vec3(0, 0, -1), vec2(1, 0)), // 4
    createVertex(vec3(-half,  half, -half), vec3(0, 0, -1), vec2(1, 1)), // 5
    createVertex(vec3( half,  half, -half), vec3(0, 0, -1), vec2(0, 1)), // 6
    createVertex(vec3( half, -half, -half), vec3(0, 0, -1), vec2(0, 0)), // 7
  ];
  
  // Create faces (quads)
  const faces: Face[] = [
    createFace([vertices[0].id, vertices[1].id, vertices[2].id, vertices[3].id]), // Front
    createFace([vertices[4].id, vertices[5].id, vertices[6].id, vertices[7].id]), // Back
    createFace([vertices[3].id, vertices[2].id, vertices[6].id, vertices[5].id]), // Top
    createFace([vertices[0].id, vertices[4].id, vertices[7].id, vertices[1].id]), // Bottom
    createFace([vertices[0].id, vertices[3].id, vertices[5].id, vertices[4].id]), // Left
    createFace([vertices[1].id, vertices[7].id, vertices[6].id, vertices[2].id]), // Right
  ];
  
  // Create edges
  const edges: Edge[] = [];
  const edgeMap = new Map<string, Edge>();
  
  faces.forEach(face => {
    for (let i = 0; i < face.vertexIds.length; i++) {
      const v1 = face.vertexIds[i];
      const v2 = face.vertexIds[(i + 1) % face.vertexIds.length];
      const edgeKey = [v1, v2].sort().join('-');
      
      if (!edgeMap.has(edgeKey)) {
        const edge = createEdge(v1, v2);
        edge.faceIds.push(face.id);
        edges.push(edge);
        edgeMap.set(edgeKey, edge);
      } else {
        edgeMap.get(edgeKey)!.faceIds.push(face.id);
      }
    }
  });
  
  const mesh: Mesh = {
    id: nanoid(),
    name: 'Cube',
    vertices,
    edges,
    faces,
    transform: {
      position: vec3(0, 0, 0),
      rotation: vec3(0, 0, 0),
      scale: vec3(1, 1, 1),
    },
    visible: true,
    locked: false,
  };
  
  // Calculate proper vertex normals
  mesh.vertices = calculateVertexNormals(mesh);
  
  return mesh;
};

// Conversion utilities for Three.js integration
export const convertQuadToTriangles = (vertexIds: string[]): string[][] => {
  if (vertexIds.length === 3) {
    return [vertexIds];
  } else if (vertexIds.length === 4) {
    // Convert quad to two triangles
    return [
      [vertexIds[0], vertexIds[1], vertexIds[2]],
      [vertexIds[0], vertexIds[2], vertexIds[3]],
    ];
  } else {
    // For n-gons, fan triangulation from first vertex
    const triangles: string[][] = [];
    for (let i = 1; i < vertexIds.length - 1; i++) {
      triangles.push([vertexIds[0], vertexIds[i], vertexIds[i + 1]]);
    }
    return triangles;
  }
};

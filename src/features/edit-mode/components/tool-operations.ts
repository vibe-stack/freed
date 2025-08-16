import { Vector3, Matrix4, Euler, Camera } from 'three';
import { Vertex } from '../../../types/geometry';
import { AxisLock } from '../../../stores/tool-store';

// Calculate centroid of selected elements
export function calculateCentroid(vertices: Vertex[]): Vector3 {
  if (vertices.length === 0) return new Vector3();
  
  const sum = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.position.x,
      y: acc.y + vertex.position.y,
      z: acc.z + vertex.position.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  
  return new Vector3(
    sum.x / vertices.length,
    sum.y / vertices.length,
    sum.z / vertices.length
  );
}

// Apply move operation to vertices
export function applyMoveOperation(
  vertices: Vertex[],
  delta: Vector3,
  axisLock: AxisLock
): Vertex[] {
  const constrainedDelta = new Vector3(
    axisLock === 'x' || axisLock === 'none' ? delta.x : 0,
    axisLock === 'y' || axisLock === 'none' ? delta.y : 0,
    axisLock === 'z' || axisLock === 'none' ? delta.z : 0
  );
  
  if (axisLock !== 'none') {
    // When axis is locked, only move along that axis
    constrainedDelta.set(
      axisLock === 'x' ? delta.x : 0,
      axisLock === 'y' ? delta.y : 0,
      axisLock === 'z' ? delta.z : 0
    );
  }
  
  return vertices.map(vertex => ({
    ...vertex,
    position: {
      x: vertex.position.x + constrainedDelta.x,
      y: vertex.position.y + constrainedDelta.y,
      z: vertex.position.z + constrainedDelta.z,
    }
  }));
}

// Apply scale operation to vertices
export function applyScaleOperation(
  vertices: Vertex[],
  scaleFactor: number,
  axisLock: AxisLock,
  center: Vector3
): Vertex[] {
  const scaleVector = new Vector3(1, 1, 1);
  
  if (axisLock === 'none') {
    scaleVector.setScalar(scaleFactor);
  } else {
    // Scale only along the locked axis
    scaleVector.set(
      axisLock === 'x' ? scaleFactor : 1,
      axisLock === 'y' ? scaleFactor : 1,
      axisLock === 'z' ? scaleFactor : 1
    );
  }
  
  return vertices.map(vertex => {
    const offset = new Vector3(
      vertex.position.x - center.x,
      vertex.position.y - center.y,
      vertex.position.z - center.z
    );
    
    offset.multiply(scaleVector);
    
    return {
      ...vertex,
      position: {
        x: center.x + offset.x,
        y: center.y + offset.y,
        z: center.z + offset.z,
      }
    };
  });
}

// Apply rotation operation to vertices
export function applyRotateOperation(
  vertices: Vertex[],
  rotationAngle: number,
  axisLock: AxisLock,
  center: Vector3
): Vertex[] {
  const rotation = new Euler(
    axisLock === 'x' ? rotationAngle : 0,
    axisLock === 'y' ? rotationAngle : 0,
    axisLock === 'z' ? rotationAngle : 0
  );
  
  const rotationMatrix = new Matrix4().makeRotationFromEuler(rotation);
  const translationToOrigin = new Matrix4().makeTranslation(-center.x, -center.y, -center.z);
  const translationBack = new Matrix4().makeTranslation(center.x, center.y, center.z);
  
  const transformMatrix = new Matrix4()
    .multiply(translationBack)
    .multiply(rotationMatrix)
    .multiply(translationToOrigin);
  
  return vertices.map(vertex => {
    const position = new Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
    position.applyMatrix4(transformMatrix);
    
    return {
      ...vertex,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      }
    };
  });
}

// Convert mouse movement to world space delta
export function mouseToWorldDelta(
  movementX: number,
  movementY: number,
  camera: Camera,
  distance: number,
  sensitivity: number = 0.005
): Vector3 {
  // Convert screen movement to world space
  const factor = distance * sensitivity;
  
  // Get camera's right and up vectors
  const cameraMatrix = camera.matrixWorld;
  const right = new Vector3().setFromMatrixColumn(cameraMatrix, 0);
  const up = new Vector3().setFromMatrixColumn(cameraMatrix, 1);
  
  // Calculate world space delta
  const delta = new Vector3();
  delta.addScaledVector(right, movementX * factor);
  delta.addScaledVector(up, -movementY * factor); // Negative because screen Y is inverted
  
  return delta;
}

export function snapValue(value: number, step: number): number {
  const safeStep = Math.max(1e-6, Math.abs(step));
  return Math.round(value / safeStep) * safeStep;
}

export function snapScaleValue(value: number, gridSize: number): number {
  const scaleStep = Math.max(0.01, Math.abs(gridSize) * 0.1);
  return Math.max(0.01, snapValue(value, scaleStep));
}

export function snapRotationRadians(value: number, gridSize: number): number {
  const degreesStep = Math.max(1, Math.abs(gridSize) * 15);
  const radiansStep = (degreesStep * Math.PI) / 180;
  return snapValue(value, radiansStep);
}

import * as TSL from 'three/tsl';

export const debugResolvers = {
  // Debug height visualization - now tries to use actual vertex shader position
  debugHeight: () => {
    // In the vertex shader, we want the original vertex position before transforms
    // This should be the actual geometry vertex data
    const pos = (TSL as any).positionGeometry ?? 
                (TSL as any).attribute?.('position') ?? 
                (TSL as any).positionLocal ?? 
                (TSL as any).position ?? null;
    
    if (!pos) return TSL.vec3(1, 0, 1); // magenta fallback
    
    // Extract Y component using various methods
    let y;
    try {
      // Method 1: Direct property access
      y = (pos as any).y;
    } catch {
      try {
        // Method 2: Swizzle/getMember
        y = (pos as any).getMember?.('y');
      } catch {
        try {
          // Method 3: Array-style access
          y = (pos as any)[1];
        } catch {
          // Method 4: Component names
          y = (pos as any).g ?? pos;
        }
      }
    }
    
    if (!y) y = pos; // fallback to whole position
    
    // Normalize for visualization - adjust range as needed
    const normalized = TSL.saturate(TSL.mul(TSL.add(y, TSL.float(1)), TSL.float(0.5)));
    return TSL.vec3(normalized, normalized, normalized);
  },
  
  // Try to get the raw geometry Y coordinate before any transforms
  debugWorldY: () => {
    const pos = (TSL as any).positionWorld ?? 
                (TSL as any).worldPosition ?? 
                (TSL as any).vWorldPosition ?? 
                (TSL as any).modelViewPosition ?? null;
    if (!pos) return TSL.float(-999);
    
    return (pos as any).y ?? 
           (pos as any).getMember?.('y') ?? 
           (pos as any)[1] ?? 
           pos;
  },
  
  debugLocalY: () => {
    const pos = (TSL as any).positionGeometry ?? 
                (TSL as any).attribute?.('position') ?? 
                (TSL as any).positionLocal ?? 
                (TSL as any).position ?? null;
    if (!pos) return TSL.float(-999);
    
    return (pos as any).y ?? 
           (pos as any).getMember?.('y') ?? 
           (pos as any)[1] ?? 
           pos;
  },
  
  // Direct vertex position access
  vertexPosition: () => {
    // Try to get the most direct access to vertex geometry
    const attr = (TSL as any).attribute?.('position');
    if (attr) return attr;
    
    // Alternative attribute access patterns
    const geomPos = (TSL as any).positionGeometry ?? 
                    (TSL as any).geometryPosition ?? null;
    if (geomPos) return geomPos;
    
    // Fallback to local position
    return (TSL as any).positionLocal ?? 
           (TSL as any).position ?? 
           TSL.vec3(0, 0, 0);
  },
  
  vertexY: () => {
    // Most direct access to vertex Y coordinate
    const attr = (TSL as any).attribute?.('position');
    if (attr) {
      const y = (attr as any).y ?? (attr as any).getMember?.('y') ?? (attr as any)[1];
      if (y !== undefined) return y;
    }
    
    // Fallback to geometry position
    const pos = (TSL as any).positionGeometry ?? 
                (TSL as any).positionLocal ?? null;
    if (pos) {
      return (pos as any).y ?? 
             (pos as any).getMember?.('y') ?? 
             (pos as any)[1] ?? 
             TSL.float(-999);
    }
    
    return TSL.float(-999);
  },
  
  // Test all axes - shows X as red, Y as green, Z as blue
  // This will help identify which axis corresponds to height in your coordinate system
  testAllAxes: () => {
    const pos = (TSL as any).attribute?.('position') ?? 
                (TSL as any).positionLocal ?? 
                (TSL as any).positionWorld ?? 
                (TSL as any).position ?? null;
                
    if (!pos) return TSL.vec3(1, 0, 1); // magenta fallback
    
    // Extract X, Y, Z components and normalize them for color visualization
    let x, y, z;
    
    try {
      x = (pos as any).x ?? (pos as any).getMember?.('x') ?? (pos as any)[0] ?? (pos as any).r;
      y = (pos as any).y ?? (pos as any).getMember?.('y') ?? (pos as any)[1] ?? (pos as any).g;
      z = (pos as any).z ?? (pos as any).getMember?.('z') ?? (pos as any)[2] ?? (pos as any).b;
    } catch {
      // If component access fails, use the position as-is
      x = pos;
      y = pos;
      z = pos;
    }
    
    // Normalize each component to 0-1 range for color visualization
    // Adjust the range as needed for your mesh bounds
    const normalizeComponent = (comp: any) => {
      return TSL.saturate(TSL.mul(TSL.add(comp, TSL.float(2)), TSL.float(0.25)));
    };
    
    return TSL.vec3(
      normalizeComponent(x), // Red channel = X axis
      normalizeComponent(y), // Green channel = Y axis  
      normalizeComponent(z)  // Blue channel = Z axis
    );
  },
} as const;
import { useEffect, useRef } from 'react';

export function usePointerLock(gl: any, condition: boolean) {
  const pointerLocked = useRef(false);

  // Track pointer lock state
  useEffect(() => {
    const onLockChange = () => {
      pointerLocked.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gl]);

  // Manage pointer lock
  useEffect(() => {
    if (condition) {
      // Request pointer lock for infinite movement
      if (!pointerLocked.current && document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock();
      }
    } else {
      // Release pointer lock
      if (pointerLocked.current) {
        document.exitPointerLock();
        pointerLocked.current = false;
      }
    }

    return () => {
      if (pointerLocked.current) {
        document.exitPointerLock();
        pointerLocked.current = false;
      }
    };
  }, [condition, gl]);

  return pointerLocked;
}
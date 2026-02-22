import { useToolStore } from '@/stores/tool-store';

export function createWheelHandler() {
  return (e: WheelEvent) => {
    const toolStore = useToolStore.getState();
    
    if (!toolStore.isActive || toolStore.tool !== 'fillet') return;
    
    e.preventDefault();
    try { e.stopPropagation(); } catch {}
    try { (e as any).stopImmediatePropagation?.(); } catch {}
    const delta = Math.sign(e.deltaY);
    
    // Store divisions in tool localData
    const data = toolStore.localData as any;
    const prev = (data?.divisions ?? 1) as number;
    const next = Math.max(1, prev + (delta > 0 ? 1 : -1));
    
    toolStore.setLocalData({ ...(data || {}), divisions: next });
    console.log(`Fillet divisions: ${next}`); // Debug log to verify wheel works
  };
}
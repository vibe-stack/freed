import { create } from 'zustand';

type ShaderTimeState = {
  animTime: number; // seconds, driven by animation playhead
};

type ShaderTimeActions = {
  setAnimTime: (t: number) => void;
};

export const useShaderTimeStore = create<ShaderTimeState & ShaderTimeActions>()((set) => ({
  animTime: 0,
  setAnimTime: (t: number) => set({ animTime: t }),
}));

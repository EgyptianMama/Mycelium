import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIState {
  isModelLoaded: boolean;
  downloadProgress: number;
  downloadText: string;
  chatHistory: ChatMessage[];
  activeProvider: 'webllm' | 'ollama' | 'none';
  setLoaded: (loaded: boolean) => void;
  setProgress: (progress: number, text: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setProvider: (provider: 'webllm' | 'ollama' | 'none') => void;
}

export const useAIStore = create<AIState>((set) => ({
  isModelLoaded: false,
  downloadProgress: 0,
  downloadText: '',
  chatHistory: [],
  activeProvider: 'none',
  setLoaded: (loaded) => set({ isModelLoaded: loaded }),
  setProgress: (downloadProgress, downloadText) => set({ downloadProgress, downloadText }),
  addMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  setProvider: (provider) => set({ activeProvider: provider }),
}));

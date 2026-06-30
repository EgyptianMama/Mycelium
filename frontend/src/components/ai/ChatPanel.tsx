import { useState } from 'react';
import { useAIStore } from '../../store/aiStore';
import { aiEngine } from '../../core/ai/AIEngine';

export const ChatPanel = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { chatHistory, addMessage, isModelLoaded } = useAIStore();

  const handleSend = async () => {
    if (!input.trim() || !isModelLoaded) return;

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: input };
    addMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const response = await aiEngine.generateResponse(userMsg.content, 'You are Mycelium.');
      addMessage({ id: Date.now().toString(), role: 'assistant', content: response });
    } catch (e) {
      addMessage({ id: Date.now().toString(), role: 'system', content: 'Error connecting to AI Engine.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: 'var(--border-width) solid var(--border-color)', backgroundColor: 'var(--surface-main)', color: 'var(--text-on-surface)' }}>
      <div style={{ padding: '1rem', borderBottom: 'var(--border-width) solid var(--border-color)', fontWeight: 'bold', backgroundColor: 'var(--accent-color)', color: 'var(--text-on-bg)' }}>MYCELIUM AGENT</div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {chatHistory.map((msg) => (
          <div key={msg.id} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '0.2rem', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              {msg.role.toUpperCase()}
            </div>
            <div style={{ 
              padding: '0.8rem', 
              backgroundColor: msg.role === 'user' ? 'var(--accent-color)' : 'var(--surface-light)',
              color: msg.role === 'user' ? 'var(--text-on-bg)' : 'var(--text-on-surface)',
              border: msg.role === 'user' ? 'none' : 'var(--border-width) solid var(--border-color)',
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.9rem'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ opacity: 0.5 }}>Mycelium is typing...</div>}
      </div>

      <div style={{ padding: '1rem', borderTop: 'var(--border-width) solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isModelLoaded ? "Ask Mycelium..." : "AI Engine booting..."}
          disabled={!isModelLoaded || loading}
          style={{ flex: 1, padding: '0.8rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-on-bg)', border: 'var(--border-width) solid var(--border-color)', fontFamily: "'Space Mono', monospace" }}
        />
        <button 
          onClick={handleSend}
          disabled={!isModelLoaded || loading}
          className="brutalist-button"
          style={{ padding: '0 1rem' }}
        >
          SEND
        </button>
      </div>
    </div>
  );
};

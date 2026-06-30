import { useState, useEffect } from 'react';
import { aiEngine } from '../../core/ai/AIEngine';
import { ELI5_SYSTEM_PROMPT } from '../../core/ai/prompts/systemPrompts';
import WindowCard from '../WindowCard';

export const CodeExplainer = ({ selectedNode }: { selectedNode: any }) => {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setExplanation('');
  }, [selectedNode]);

  const handleExplain = async () => {
    if (!selectedNode) return;
    setLoading(true);
    setExplanation('');
    try {
      const prompt = `Explain the following code entity: ${selectedNode.id} (${selectedNode.type})`;
      const stream = aiEngine.streamResponse(prompt, ELI5_SYSTEM_PROMPT);
      for await (const chunk of stream) {
        setExplanation((prev) => prev + chunk);
      }
    } catch (e) {
      setExplanation('Error generating explanation.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedNode) return null;

  return (
    <WindowCard title="CODE_EXPLAINER" light>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <div>
          <button 
            className="brutalist-button" 
            onClick={handleExplain}
            disabled={loading}
            style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
          >
            {loading ? 'ANALYZING...' : 'ELI5 EXPLAIN'}
          </button>
        </div>
        
        {explanation && (
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '1rem', 
            backgroundColor: 'var(--bg-color)', 
            border: 'var(--border-width) solid var(--border-color)',
            fontFamily: "'Space Mono', monospace",
            fontSize: '0.9rem',
            color: 'var(--text-on-bg)',
            whiteSpace: 'pre-wrap'
          }}>
            {explanation}
          </div>
        )}
      </div>
    </WindowCard>
  );
};

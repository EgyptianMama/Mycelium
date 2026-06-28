import React, { useState } from 'react';
import WindowCard from '../components/WindowCard';
import { GithubFetcher } from '../core/ingestion/GithubFetcher';
import { ingestionEngine } from '../core/ingestion/IngestionEngine.ts?v=3';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';

const Dashboard = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'FETCHING' | 'PARSING (WEB WORKER)' | 'COMPLETE' | 'ERROR'>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<any>(null);

  // Interactivity states
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const fgRef = React.useRef<any>();

  const updateHighlight = () => {
    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const handleNodeHover = (node: any) => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node);
      node.neighbors?.forEach((neighbor: any) => highlightNodes.add(neighbor));
      node.links?.forEach((link: any) => highlightLinks.add(link));
    }

    setHoverNode(node || null);
    updateHighlight();
  };

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    
    const distance = 80;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

    if (fgRef.current) {
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
        node, 
        2000  
      );
    }
  };

  const getNodeColor = (node: any) => {
    if (highlightNodes.size > 0 && !highlightNodes.has(node)) {
      return 'rgba(255,255,255,0.05)';
    }
    const isHovered = node === hoverNode;
    const path = node.id || '';
    if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.jsx')) return isHovered ? '#ffffff' : '#00ffff';
    if (path.endsWith('.css') || path.endsWith('.scss')) return isHovered ? '#ffffff' : '#ff00ff';
    if (path.endsWith('.json') || path.endsWith('.md')) return isHovered ? '#ffffff' : '#aaaaaa';
    return isHovered ? '#ffffff' : '#ff9900';
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleIngest = async () => {
    if (!repoUrl) return;
    setLogs([]);
    setStatus('FETCHING');
    setGraphData(null);
    
    try {
      addLog(`> Parsing URL: ${repoUrl}`);
      const fetcher = new GithubFetcher();
      
      const { owner, repo } = fetcher.parseUrl(repoUrl);
      
      addLog(`> Fetching default branch for ${owner}/${repo}...`);
      const branch = await fetcher.getDefaultBranch(owner, repo);
      
      addLog(`> Fetching file tree for branch: ${branch}...`);
      const filesToFetch = await fetcher.fetchTree(owner, repo, branch);
      
      addLog(`> Found ${filesToFetch.length} processable files.`);
      const filesToParse = await fetcher.fetchFiles(owner, repo, filesToFetch, branch);
      
      setStatus('PARSING (WEB WORKER)');
      addLog('> Sending files to WebAssembly parsing engine...');
      
      const graph = await ingestionEngine.parseRepository(filesToParse);
      
      // Cross-link nodes
      graph.links.forEach((link: any) => {
        const a = graph.nodes.find((n: any) => n.id === link.source);
        const b = graph.nodes.find((n: any) => n.id === link.target);
        if (a && b) {
          !a.neighbors && (a.neighbors = []);
          !b.neighbors && (b.neighbors = []);
          a.neighbors.push(b);
          b.neighbors.push(a);

          !a.links && (a.links = []);
          !b.links && (b.links = []);
          a.links.push(link);
          b.links.push(link);
        }
      });
      
      setGraphData(graph);
      setStatus('COMPLETE');
      addLog(`> Ingestion complete! Graph contains ${graph.nodes.length} nodes and ${graph.links.length} edges.`);
      
    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      addLog(`> ERROR: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontFamily: "'Space Mono', monospace", 
        fontSize: '2.5rem', 
        marginBottom: '2rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>
        <span style={{ 
          border: 'var(--border-width) solid var(--text-color)',
          padding: '0.5rem 1rem',
          marginRight: '1rem',
          boxShadow: '4px 4px 0 var(--text-color)'
        }}>MYCELIUM</span>
        <span style={{ opacity: 0.5 }}>01</span>
      </h1>

      {status === 'COMPLETE' && graphData ? (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
          {/* Left Column: Graph */}
          <div style={{ height: '70vh', border: 'var(--border-width) solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <ForceGraph3D
              ref={fgRef}
              graphData={graphData}
              nodeLabel={(node: any) => node.id}
              nodeColor={getNodeColor}
              nodeVal={(node: any) => Math.min(Math.max((node.properties?.astNodeCount || 0) / 100, 1), 10)}
              nodeRelSize={6}
              linkColor={(link: any) => highlightLinks.has(link) ? '#4af626' : 'rgba(255,255,255,0.25)'}
              linkWidth={(link: any) => highlightLinks.has(link) ? 2 : 0.5}
              linkDirectionalParticles={(link: any) => highlightLinks.has(link) ? 4 : 0}
              linkDirectionalParticleWidth={4}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              backgroundColor="#0a0a0a"
              nodeThreeObject={(node: any) => {
                const sprite = new SpriteText(node.id.split('/').pop());
                sprite.color = getNodeColor(node);
                sprite.textHeight = 3;
                return sprite;
              }}
              nodeThreeObjectExtend={true}
            />
          </div>

          {/* Right Column: Metadata */}
          <div>
            <WindowCard title="NODE_METADATA" light>
              {selectedNode ? (
                <div style={{ wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {selectedNode.id.split('/').pop()}
                  </h3>
                  
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>PATH</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem' }}>{selectedNode.id}</div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>PROPERTIES</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontFamily: "'Space Mono', monospace" }}>
                      <div>AST Nodes:</div>
                      <div style={{ textAlign: 'right', color: '#4af626' }}>{selectedNode.properties?.astNodeCount || 0}</div>
                      <div>Connections:</div>
                      <div style={{ textAlign: 'right', color: '#4af626' }}>{selectedNode.neighbors?.length || 0}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0' }}>
                  Select a node to view its metadata.
                </div>
              )}
            </WindowCard>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Left Column: Actions */}
          <WindowCard title="UPLOAD_NEW_REPO">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>GITHUB_REPOSITORY_URL</label>
                <input 
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: 'var(--border-width) solid var(--border-color)',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-on-bg)',
                    fontFamily: "'Space Mono', monospace"
                  }}
                />
              </div>

              <button 
                className="brutalist-button" 
                onClick={handleIngest}
                disabled={status === 'FETCHING' || status === 'PARSING (WEB WORKER)'}
                style={{
                  backgroundColor: status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'var(--accent-primary)' : 'var(--accent-primary)',
                  color: 'white',
                  cursor: status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'wait' : 'pointer'
                }}
              >
                {status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'WORKING...' : 'BEGIN INGESTION'}
              </button>

              {(status !== 'IDLE' || logs.length > 0) && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#1a1a1a',
                  color: '#4af626',
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '0.8rem',
                  border: 'var(--border-width) solid var(--border-color)',
                  minHeight: '150px'
                }}>
                  <div style={{ color: status === 'ERROR' ? '#ff3333' : '#ff9900', marginBottom: '0.5rem' }}>
                    STATUS: {status}
                  </div>
                  {logs.map((log, i) => (
                    <div key={i} style={{ color: log.startsWith('> ERROR') ? '#ff3333' : '#4af626' }}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </WindowCard>

          {/* Right Column: History */}
          <WindowCard title="PREVIOUS_ANALYSIS" light>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {[1, 2, 3].map((item) => (
                <div key={item} style={{
                  border: 'var(--border-width) solid var(--border-color)',
                  padding: '1rem',
                  backgroundColor: 'var(--surface-main)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontWeight: 'bold' }}>project-nexus-{item}</h4>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>XP +{item * 120}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '1rem' }}>
                    React • TypeScript • Tailwind
                  </p>
                  <button className="brutalist-button secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                    RESUME_ANALYSIS
                  </button>
                </div>
              ))}
            </div>
          </WindowCard>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

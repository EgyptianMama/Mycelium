import React, { useState } from 'react';
import WindowCard from '../components/WindowCard';
import { GithubFetcher } from '../core/ingestion/GithubFetcher';
import { ingestionEngine } from '../core/ingestion/IngestionEngine';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { aiEngine } from '../core/ai/AIEngine';
import { useAIStore } from '../store/aiStore';
import { ChatPanel } from '../components/ai/ChatPanel';
import { CodeExplainer } from '../components/ai/CodeExplainer';

const Dashboard = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'FETCHING' | 'PARSING (WEB WORKER)' | 'COMPLETE' | 'ERROR'>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [graphStats, setGraphStats] = useState<any>(null);

  const { isModelLoaded, downloadProgress, downloadText, activeProvider } = useAIStore();

  React.useEffect(() => {
    aiEngine.initialize();
  }, []);

  // Interactivity states
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const fgRef = React.useRef<any>(null);

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
    if (node.type === 'file') return isHovered ? '#ffffff' : '#00ffff';
    if (node.type === 'function') return isHovered ? '#ffffff' : '#4af626';
    if (node.type === 'class') return isHovered ? '#ffffff' : '#ff9900';
    return isHovered ? '#ffffff' : '#aaaaaa';
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleIngest = async () => {
    if (!repoUrl) return;
    setLogs([]);
    setStatus('FETCHING');
    setGraphData(null);
    setGraphStats(null);
    
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
      
      const graphService = await ingestionEngine.parseRepository(filesToParse);
      const forceData = graphService.getForceGraphData();
      
      // Cross-link nodes for hover effects
      forceData.links.forEach((link: any) => {
        const a: any = forceData.nodes.find((n: any) => n.id === link.source);
        const b: any = forceData.nodes.find((n: any) => n.id === link.target);
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
      
      setGraphData(forceData);
      const stats = graphService.getStats();
      setGraphStats(stats);
      setStatus('COMPLETE');
      addLog(`> Ingestion complete! ${stats.nodes} nodes (${stats.files} files, ${stats.functions} functions, ${stats.classes} classes) and ${stats.edges} edges.`);
      
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
        <div style={{ display: 'flex', gap: '2rem', height: '80vh' }}>
          {/* Left Column: Chat */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <ChatPanel />
          </div>

          {/* Middle Column: Graph */}
          <div style={{ flex: '2', display: 'flex', flexDirection: 'column' }}>
            {graphStats && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--surface-main)',
                border: 'var(--border-width) solid var(--border-color)',
                color: 'var(--text-on-surface)',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: "'Space Mono', monospace",
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                <span>Nodes: {graphStats.nodes}</span>
                <span style={{ color: '#00aaaa' }}>Files: {graphStats.files}</span>
                <span style={{ color: '#22aa00' }}>Functions: {graphStats.functions}</span>
                <span style={{ color: '#cc6600' }}>Classes: {graphStats.classes}</span>
                <span>Edges: {graphStats.edges}</span>
              </div>
            )}
            <div style={{ flex: 1, border: 'var(--border-width) solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel={(node: any) => node.label || node.id}
                nodeColor={getNodeColor}
                nodeVal={(node: any) => {
                  if (node.type === 'file') return Math.min(Math.max((node.astNodeCount || 0) / 100, 1), 10);
                  if (node.type === 'function' || node.type === 'class') {
                    const lines = Math.max((node.endLine || 0) - (node.startLine || 0), 1);
                    return Math.min(Math.max(lines / 10, 1), 5);
                  }
                  return 1;
                }}
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
                  // PERFORMANCE OPTIMIZATION:
                  // Rendering thousands of SpriteTexts crashes the browser due to WebGL texture limits.
                  // Only render text for files or actively hovered nodes.
                  if (node.type === 'file' || highlightNodes.has(node)) {
                    const sprite = new SpriteText(node.label || node.id.split('/').pop());
                    sprite.color = getNodeColor(node);
                    sprite.textHeight = node.type === 'file' ? 4 : 2.5;
                    (sprite as any).position.y = node.type === 'file' ? 12 : 6;
                    return sprite;
                  }
                  return null;
                }}
                nodeThreeObjectExtend={true}
              />
            </div>
          </div>

          {/* Right Column: Metadata & AI */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: '300px' }}>
            <WindowCard title="NODE_METADATA" light>
              {selectedNode ? (
                <div style={{ wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'var(--accent-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {selectedNode.label || selectedNode.id.split('/').pop()}
                  </h3>
                  
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>TYPE</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', color: getNodeColor(selectedNode), fontWeight: 'bold' }}>
                      {(selectedNode.type || 'UNKNOWN').toUpperCase()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>PATH</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem' }}>{selectedNode.path || selectedNode.id}</div>
                  </div>
                  
                  {selectedNode.type === 'function' && (
                    <>
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>PARAMS</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem' }}>
                          {selectedNode.params?.length > 0 ? selectedNode.params.join(', ') : 'none'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>LINES</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem' }}>
                          {selectedNode.startLine} - {selectedNode.endLine} ({Math.max((selectedNode.endLine || 0) - (selectedNode.startLine || 0), 1)} lines)
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>FLAGS</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', display: 'flex', gap: '0.5rem' }}>
                          {selectedNode.isExported && <span className="badge">EXPORTED</span>}
                          {selectedNode.isAsync && <span className="badge">ASYNC</span>}
                          {!selectedNode.isExported && !selectedNode.isAsync && <span style={{ opacity: 0.5 }}>none</span>}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'class' && (
                    <>
                      {selectedNode.superClass && (
                        <div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>EXTENDS</div>
                          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem' }}>
                            {selectedNode.superClass}
                          </div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>METHODS ({selectedNode.methods?.length || 0})</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {selectedNode.methods?.map((m: any, i: number) => (
                            <div key={i} style={{ marginBottom: '0.2rem' }}>
                              - {m.name}({m.params?.join(', ')})
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.2rem' }}>CONNECTIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontFamily: "'Space Mono', monospace" }}>
                      <div>Neighbors:</div>
                      <div style={{ textAlign: 'right', color: '#4af626' }}>{selectedNode.neighbors?.length || 0}</div>
                      {selectedNode.type === 'file' && (
                        <>
                          <div>AST Nodes:</div>
                          <div style={{ textAlign: 'right', color: '#4af626' }}>{selectedNode.astNodeCount || 0}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0' }}>
                  Select a node to view its metadata.
                </div>
              )}
            </WindowCard>

            <CodeExplainer selectedNode={selectedNode} />
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
                  backgroundColor: status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'var(--accent-color)' : 'var(--accent-color)',
                  color: 'white',
                  cursor: status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'wait' : 'pointer'
                }}
              >
                {status === 'FETCHING' || status === 'PARSING (WEB WORKER)' ? 'WORKING...' : 'BEGIN INGESTION'}
              </button>

              <div style={{ marginTop: '1rem', padding: '1rem', border: 'var(--border-width) solid var(--border-color)', backgroundColor: 'var(--surface-main)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>AI ENGINE STATUS</h3>
                <div style={{ fontSize: '0.8rem', fontFamily: "'Space Mono', monospace" }}>
                  Provider: <span style={{ color: 'var(--accent-color)' }}>{activeProvider.toUpperCase()}</span>
                  <br />
                  Status: {isModelLoaded ? <span style={{ color: '#4af626' }}>READY</span> : <span style={{ color: '#ff9900' }}>LOADING...</span>}
                  {!isModelLoaded && activeProvider === 'webllm' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ height: '4px', backgroundColor: 'var(--bg-color)', width: '100%', marginBottom: '0.2rem' }}>
                        <div style={{ height: '100%', backgroundColor: 'var(--accent-color)', width: `${downloadProgress * 100}%` }} />
                      </div>
                      <div style={{ opacity: 0.7, fontSize: '0.7rem' }}>{downloadText}</div>
                    </div>
                  )}
                </div>
              </div>

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

import React from 'react';
import WindowCard from '../components/WindowCard';

const Dashboard = () => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', marginTop: '1rem' }}>
        <h1 className="text-outline" style={{ display: 'inline-block' }}>
          REPO_VAULT 01
        </h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

        {/* Left Column: Upload */}
        <WindowCard title="UPLOAD_NEW_REPO">
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>TARGET_DIRECTORY</h3>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Drag and drop a local repository folder to begin offline ingestion. Code never leaves your machine.
            </p>

            <div style={{
              border: '2px dashed var(--border-color)',
              padding: '3rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-color)',
              marginBottom: '1.5rem',
              cursor: 'pointer'
            }}>
              <span className="badge" style={{ marginBottom: '1rem' }}>WAITING_FOR_INPUT</span>
              <p style={{ fontWeight: 'bold' }}>[ DRAG FOLDER HERE ]</p>
            </div>

            <button className="brutalist-button">
              SELECT_FOLDER
            </button>
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
    </div>
  );
};

export default Dashboard;
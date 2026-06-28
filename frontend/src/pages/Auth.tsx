import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WindowCard from '../components/WindowCard';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth success
    navigate('/dashboard');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <h1 className="text-outline" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        REPOLENS
      </h1>
      
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <WindowCard title={isLogin ? 'SYSTEM LOGIN' : 'CREATE AGENT'}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>AGENT_NAME</label>
                <input type="text" className="brutalist-input" placeholder="Enter username..." required />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ACCESS_CODE</label>
              <input type="email" className="brutalist-input" placeholder="Enter email..." required />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>SECURITY_KEY</label>
              <input type="password" className="brutalist-input" placeholder="Enter password..." required />
            </div>

            <button type="submit" className="brutalist-button" style={{ marginTop: '1rem' }}>
              {isLogin ? 'INITIALIZE LOGIN' : 'REGISTER AGENT'}
            </button>
            
            <button 
              type="button" 
              className="brutalist-button secondary" 
              style={{ marginTop: '0.5rem' }}
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'NEED AN ACCOUNT?' : 'ALREADY REGISTERED?'}
            </button>

          </form>
        </WindowCard>
      </div>
    </div>
  );
};

export default Auth;

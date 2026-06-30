import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import StarBackground from './components/StarBackground';

function App() {
  return (
    <Router>
      <StarBackground />
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', padding: '2rem' }}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/auth" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

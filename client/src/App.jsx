import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home'
import Login from './components/Login'
import Signup from './components/Signup'
import LoginSuccess from './components/LoginSuccess';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './components/Land';
import Documentation from './components/Documntation';

function App() {
  
  return(<>
   <BrowserRouter>
      <Routes>
        <Route path="/main" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login/success" element={<LoginSuccess />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/doct" element={<Documentation />} />

      </Routes>
    </BrowserRouter>
  </>)
}

export default App;

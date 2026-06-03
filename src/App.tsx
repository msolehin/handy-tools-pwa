import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ICScanner from './pages/ICScanner';
import ParkingLocator from './pages/ParkingLocator';
import DecisionMaker from './pages/DecisionMaker';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ic-scanner" element={<ICScanner />} />
          <Route path="parking" element={<ParkingLocator />} />
          <Route path="decision-maker" element={<DecisionMaker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

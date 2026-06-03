import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ICScanner from './pages/ICScanner';
import ParkingLocator from './pages/ParkingLocator';
import DecisionMaker from './pages/DecisionMaker';
import PaceCalculator from './pages/PaceCalculator';
import AffordabilityCalculator from './pages/AffordabilityCalculator';
import ExpenseSplitter from './pages/ExpenseSplitter';
import Countdown from './pages/Countdown';
import LoanCalculator from './pages/LoanCalculator';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ic-scanner" element={<ICScanner />} />
          <Route path="parking" element={<ParkingLocator />} />
          <Route path="decision-maker" element={<DecisionMaker />} />
          <Route path="pace-calculator" element={<PaceCalculator />} />
          <Route path="affordability" element={<AffordabilityCalculator />} />
          <Route path="expense-splitter" element={<ExpenseSplitter />} />
          <Route path="countdown" element={<Countdown />} />
          <Route path="loan-calculator" element={<LoanCalculator />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

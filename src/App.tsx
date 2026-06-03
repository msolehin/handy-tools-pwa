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
import FinancialCalculators from './pages/FinancialCalculators';
import DocumentExpiry from './pages/DocumentExpiry';
import VehicleTracker from './pages/VehicleTracker';
import TripBudget from './pages/TripBudget';
import BMICalculator from './pages/BMICalculator';
import GroceryBudget from './pages/GroceryBudget';
import PackingChecklist from './pages/PackingChecklist';
import FuelCalculator from './pages/FuelCalculator';

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
          <Route path="financial-calculators" element={<FinancialCalculators />} />
          <Route path="document-expiry" element={<DocumentExpiry />} />
          <Route path="vehicle-tracker" element={<VehicleTracker />} />
          <Route path="trip-budget" element={<TripBudget />} />
          <Route path="bmi-calculator" element={<BMICalculator />} />
          <Route path="grocery-budget" element={<GroceryBudget />} />
          <Route path="packing-checklist" element={<PackingChecklist />} />
          <Route path="fuel-calculator" element={<FuelCalculator />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

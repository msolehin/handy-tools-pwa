import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import ScrollToTop from './components/ScrollToTop';
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
import UnitConverter from './pages/UnitConverter';
import CurrencyConverter from './pages/CurrencyConverter';
import Randomizer from './pages/Randomizer';
import SubscriptionTracker from './pages/SubscriptionTracker';
import WaterTracker from './pages/WaterTracker';
import PaycheckCountdown from './pages/PaycheckCountdown';
import EmergencyCard from './pages/EmergencyCard';
import CarpoolSplitter from './pages/CarpoolSplitter';
import ChecklistTemplate from './pages/ChecklistTemplate';
import DebtTracker from './pages/DebtTracker';
import GroupSplitBill from './pages/GroupSplitBill';
import RestaurantSplitter from './pages/RestaurantSplitter';
import SpeedTest from './pages/SpeedTest';
import Speedometer from './pages/Speedometer';
import DuitRayaManager from './pages/DuitRayaManager';
import HabitTracker from './pages/HabitTracker';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
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
          <Route path="unit-converter" element={<UnitConverter />} />
          <Route path="currency-converter" element={<CurrencyConverter />} />
          <Route path="randomizer" element={<Randomizer />} />
          <Route path="subscription-tracker" element={<SubscriptionTracker />} />
          <Route path="water-tracker" element={<WaterTracker />} />
          <Route path="paycheck-countdown" element={<PaycheckCountdown />} />
          <Route path="emergency-card" element={<EmergencyCard />} />
          <Route path="carpool-splitter" element={<CarpoolSplitter />} />
          <Route path="checklists" element={<ChecklistTemplate />} />
          <Route path="debt-tracker" element={<DebtTracker />} />
          <Route path="group-split-bill" element={<GroupSplitBill />} />
          <Route path="restaurant-splitter" element={<RestaurantSplitter />} />
          <Route path="speed-test" element={<SpeedTest />} />
          <Route path="speedometer" element={<Speedometer />} />
          <Route path="duit-raya" element={<DuitRayaManager />} />
          <Route path="habit-tracker" element={<HabitTracker />} />
        </Route>
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;

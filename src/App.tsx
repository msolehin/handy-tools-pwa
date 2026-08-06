import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import Landing from './components/landing/Landing';
import ICScanner from './pages/ICScanner';
import ParkingLocator from './pages/ParkingLocator';
import DecisionMaker from './pages/DecisionMaker';
import PaceCalculator from './pages/PaceCalculator';
import Countdown from './pages/Countdown';
import DocumentExpiry from './pages/DocumentExpiry';
import GroceryBudget from './pages/GroceryBudget';
import Randomizer from './pages/Randomizer';
import CommitmentTracker from './pages/CommitmentTracker';
import WaterTracker from './pages/WaterTracker';
import DebtTracker from './pages/DebtTracker';
import RestaurantSplitter from './pages/RestaurantSplitter';
import DuitRayaManager from './pages/DuitRayaManager';
import HabitTracker from './pages/HabitTracker';
import ExpenseManager from './pages/ExpenseManager';
import TravelHistory from './pages/TravelHistory';
import AssetWarrantyTracker from './pages/AssetWarrantyTracker';
import BookTracker from './pages/BookTracker';
import Birthdays from './pages/Birthdays';
import Tenancy from './pages/Tenancy';
import ImportantNumbers from './pages/ImportantNumbers';
import VehicleServices from './pages/VehicleServices';
import HomeServices from './pages/HomeServices';
import PDFEditor from './pages/PDFEditor';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Marketing page, deliberately outside the app shell. */}
        <Route path="/" element={<Landing />} />

        {/* Pathless layout route: contributes no URL segment, so every tool keeps the
            exact path it has always had while Home moves to /app. */}
        <Route element={<Layout />}>
          <Route path="/app" element={<Home />} />
          <Route path="/ic-scanner" element={<ICScanner />} />
          <Route path="/parking" element={<ParkingLocator />} />
          <Route path="/decision-maker" element={<DecisionMaker />} />
          <Route path="/pace-calculator" element={<PaceCalculator />} />
          <Route path="/countdown" element={<Countdown />} />
          <Route path="/document-expiry" element={<DocumentExpiry />} />
          <Route path="/grocery-budget" element={<GroceryBudget />} />
          <Route path="/randomizer" element={<Randomizer />} />
          <Route path="/commitments" element={<CommitmentTracker />} />
          <Route path="/water-tracker" element={<WaterTracker />} />
          <Route path="/debt-tracker" element={<DebtTracker />} />
          <Route path="/restaurant-splitter" element={<RestaurantSplitter />} />
          <Route path="/duit-raya" element={<DuitRayaManager />} />
          <Route path="/habit-tracker" element={<HabitTracker />} />
          <Route path="/expense-manager" element={<ExpenseManager />} />
          <Route path="/travel-history" element={<TravelHistory />} />
          <Route path="/asset-warranty" element={<AssetWarrantyTracker />} />
          <Route path="/book-tracker" element={<BookTracker />} />
          <Route path="/birthdays" element={<Birthdays />} />
          <Route path="/tenancy" element={<Tenancy />} />
          <Route path="/important-numbers" element={<ImportantNumbers />} />
          <Route path="/vehicle-services" element={<VehicleServices />} />
          <Route path="/home-services" element={<HomeServices />} />
          <Route path="/pdf-editor" element={<PDFEditor />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

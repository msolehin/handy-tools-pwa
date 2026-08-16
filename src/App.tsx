import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import Landing from './components/landing/Landing';

/**
 * One chunk per tool, fetched when its route is first opened.
 *
 * Statically imported, the whole catalog was a single 2.1 MB bundle: everyone downloaded pdf-lib,
 * react-pdf, cropperjs, leaflet and the world atlas before the home screen could paint, however few
 * of those tools they ever used. It also overran the 2 MiB service-worker precache ceiling, so the
 * one file the app most needs offline was the one file workbox refused to cache.
 *
 * Home stays eager — it is the first screen, and Layout reads DEFAULT_TOOLS from it anyway.
 * Suspense lives around Layout's <Outlet>, so the shell holds still while a tool arrives.
 */
const ICScanner = lazy(() => import('./pages/ICScanner'));
const ParkingLocator = lazy(() => import('./pages/ParkingLocator'));
const DecisionMaker = lazy(() => import('./pages/DecisionMaker'));
const PaceCalculator = lazy(() => import('./pages/PaceCalculator'));
const Countdown = lazy(() => import('./pages/Countdown'));
const DocumentExpiry = lazy(() => import('./pages/DocumentExpiry'));
const GroceryBudget = lazy(() => import('./pages/GroceryBudget'));
const Randomizer = lazy(() => import('./pages/Randomizer'));
const CommitmentTracker = lazy(() => import('./pages/CommitmentTracker'));
const WaterTracker = lazy(() => import('./pages/WaterTracker'));
const DebtTracker = lazy(() => import('./pages/DebtTracker'));
const RestaurantSplitter = lazy(() => import('./pages/RestaurantSplitter'));
const DuitRayaManager = lazy(() => import('./pages/DuitRayaManager'));
const HabitTracker = lazy(() => import('./pages/HabitTracker'));
const ExpenseManager = lazy(() => import('./pages/ExpenseManager'));
const TravelHistory = lazy(() => import('./pages/TravelHistory'));
const AssetWarrantyTracker = lazy(() => import('./pages/AssetWarrantyTracker'));
const BookTracker = lazy(() => import('./pages/BookTracker'));
const Tenancy = lazy(() => import('./pages/Tenancy'));
const ImportantNumbers = lazy(() => import('./pages/ImportantNumbers'));
const Garage = lazy(() => import('./pages/garage'));
const HomeServices = lazy(() => import('./pages/HomeServices'));
const PDFEditor = lazy(() => import('./pages/PDFEditor'));

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
          <Route path="/tenancy" element={<Tenancy />} />
          <Route path="/important-numbers" element={<ImportantNumbers />} />
          <Route path="/vehicle-services" element={<Garage />} />
          <Route path="/home-services" element={<HomeServices />} />
          <Route path="/pdf-editor" element={<PDFEditor />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

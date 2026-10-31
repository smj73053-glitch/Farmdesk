import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WeatherPage } from '@/pages/WeatherPage';
import { CropIntelligencePage } from '@/pages/CropIntelligencePage';
import { MarketPage } from '@/pages/MarketPage';
import { FarmManagementPage } from '@/pages/FarmManagementPage';
import { CropLifecyclePage } from '@/pages/CropLifecyclePage';
import { CropDetailPage } from '@/pages/CropDetailPage';
import { SoilPage } from '@/pages/SoilPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { IncomePage } from '@/pages/IncomePage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SchemesPage } from '@/pages/SchemesPage';
import { KnowledgePage } from '@/pages/KnowledgePage';
import { KnowledgeArticlePage } from '@/pages/KnowledgeArticlePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage, ProtectedRoute, ScrollToTop } from '@/components/layout/ProtectedRoute';

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/crop-intelligence" element={<CropIntelligencePage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/farms" element={<FarmManagementPage />} />
            <Route path="/farms/:farmId" element={<FarmManagementPage />} />
            <Route path="/crops" element={<CropLifecyclePage />} />
            <Route path="/crops/:cropId" element={<CropDetailPage />} />
            <Route path="/soil" element={<SoilPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/ai" element={<AiAssistantPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/schemes" element={<SchemesPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/knowledge/:slug" element={<KnowledgeArticlePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import BackToTopButton from "./components/BackToTopButton";
import GlobalLoader from "./components/ui/GlobalLoader";
import DebugErrorBoundary from "./components/DebugErrorBoundary";

// Lazy Loaded Routes
const Practice = React.lazy(() => import("./pages/Practice"));
const Index = React.lazy(() => import("./pages/Index"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const PracticeHub = React.lazy(() => import("./pages/PracticeHub"));
const VoicePractice = React.lazy(() => import("./pages/VoicePractice"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Leaderboard = React.lazy(() => import("./pages/Leaderboard"));
const CommunicationLanding = React.lazy(() => import("./pages/communication/CommunicationLanding"));
const ReadingPractice = React.lazy(() => import("./pages/communication/ReadingPractice"));
const SpeakingPractice = React.lazy(() => import("./pages/communication/SpeakingPractice"));
const WritingPractice = React.lazy(() => import("./pages/communication/WritingPractice"));
const ListeningPractice = React.lazy(() => import("./pages/communication/ListeningPractice"));
const VerbalPracticeLanding = React.lazy(() => import("./pages/VerbalPracticeLanding"));
const VerbalGame = React.lazy(() => import("./pages/VerbalGame"));
const AdaptiveCoach = React.lazy(() => import("./pages/AdaptiveCoach"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = React.lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = React.lazy(() => import("./pages/CookiePolicy"));

const queryClient = new QueryClient();

const App = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BackToTopButton />
          <BrowserRouter>
            <DebugErrorBoundary>
              <Suspense fallback={<GlobalLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/practice" element={<Practice />} />
                  </Route>

                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/voice-practice" element={<VoicePractice />} />
                  <Route
                    path="/voice-practice/communication"
                    element={<CommunicationLanding />}
                  />
                  <Route
                    path="/voice-practice/communication/reading"
                    element={<ReadingPractice />}
                  />
                  <Route
                    path="/voice-practice/communication/speaking"
                    element={<SpeakingPractice />}
                  />
                  <Route
                    path="/voice-practice/communication/writing"
                    element={<WritingPractice />}
                  />
                  <Route
                    path="/voice-practice/communication/listening"
                    element={<ListeningPractice />}
                  />
                  <Route path="/voice-practice/:module" element={<PracticeHub />} />
                  <Route
                    path="/verbal-practice"
                    element={<VerbalPracticeLanding />}
                  />
                  <Route
                    path="/verbal-practice/:categoryId"
                    element={<VerbalGame />}
                  />
                  <Route path="/adaptive-coach" element={<AdaptiveCoach />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/cookie-policy" element={<CookiePolicy />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </DebugErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import CreateLeague from "@/pages/CreateLeague";
import JoinLeague from "@/pages/JoinLeague";
import LeagueDetail from "@/pages/LeagueDetail";
import LeagueDashboard from "@/pages/LeagueDashboard";
import MatchDetail from "@/pages/MatchDetail";
import CreateMatch from "@/pages/CreateMatch";
import LineupPage from "@/pages/LineupPage";
import TierListPage from "@/pages/TierListPage";
import Results from "@/pages/Results";
import NotFound from "@/pages/not-found";
import "./lib/i18n";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Navbar />
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/create-league">
        <ProtectedRoute>
          <Navbar />
          <CreateLeague />
        </ProtectedRoute>
      </Route>
      
      <Route path="/join-league">
        <ProtectedRoute>
          <Navbar />
          <JoinLeague />
        </ProtectedRoute>
      </Route>
      
      <Route path="/league/:id">
        <ProtectedRoute>
          <Navbar />
          <LeagueDetail />
        </ProtectedRoute>
      </Route>
      
      {/* v0.2 - New Match System Routes */}
      <Route path="/leagues/:id/dashboard">
        <ProtectedRoute>
          <Navbar />
          <LeagueDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/leagues/:id/create-match">
        <ProtectedRoute>
          <Navbar />
          <CreateMatch />
        </ProtectedRoute>
      </Route>
      
      <Route path="/matches/:id">
        <ProtectedRoute>
          <Navbar />
          <MatchDetail />
        </ProtectedRoute>
      </Route>
      
      <Route path="/matches/:matchId/lineup">
        <ProtectedRoute>
          <Navbar />
          <LineupPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/tierlist/:id">
        <ProtectedRoute>
          <Navbar />
          <TierListPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/results/:id">
        <ProtectedRoute>
          <Navbar />
          <Results />
        </ProtectedRoute>
      </Route>
      
      <Route path="/">
        <ProtectedRoute>
          <Navbar />
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-primary text-text-primary">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

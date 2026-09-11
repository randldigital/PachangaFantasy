import React from 'react';
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
import VerifyEmail from "@/pages/VerifyEmail";
import Overview from "@/pages/Overview";
import LeagueHub from "@/pages/LeagueHub";
import ClubHub from "@/pages/ClubHub";
import Billing from "@/pages/Billing";
import NotFound from "@/pages/not-found";
import "./lib/i18n";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify" component={VerifyEmail} />
      
      {/* Protected Routes */}
      <Route path="/overview">
        <ProtectedRoute>
          <Navbar />
          <Overview />
        </ProtectedRoute>
      </Route>
      
      <Route path="/leagues">
        <ProtectedRoute>
          <Navbar />
          <Overview />
        </ProtectedRoute>
      </Route>
      
      <Route path="/league/:id">
        <ProtectedRoute>
          <Navbar />
          <LeagueHub />
        </ProtectedRoute>
      </Route>
      
      <Route path="/club/:id">
        <ProtectedRoute>
          <Navbar />
          <ClubHub />
        </ProtectedRoute>
      </Route>

      <Route path="/billing">
        <ProtectedRoute>
          <Navbar />
          <Billing />
        </ProtectedRoute>
      </Route>

      <Route path="/plans">
        <ProtectedRoute>
          <Navbar />
          <Billing />
        </ProtectedRoute>
      </Route>
      
      <Route path="/">
        <ProtectedRoute>
          <Navbar />
          <Overview />
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
          <div className="min-h-screen bg-primary text-text-primary pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

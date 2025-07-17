import React from "react";
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { League } from '@shared/schema';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: _, isLoading, error } = useQuery<League[]>({
    queryKey: ['/api/leagues'],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: 1,
    enabled: !!user, // Only fetch when user is authenticated
  });

  console.log('Dashboard render:', { 
    user: !!user, 
    isLoading, 
    error: error?.message,
    hasToken: !!localStorage.getItem('token')
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <p className="text-red-400">Error loading dashboard: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text-primary mb-2">{t('dashboard.title')}</h1>
            <p className="text-text-secondary">{t('dashboard.subtitle')}</p>
          </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/create-league">
            <Card className="bg-gradient-to-br from-accent-blue/10 to-accent-purple/10 border border-accent-blue/20 rounded-2xl hover:border-accent-blue/40 transition-all duration-300 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-accent-blue/20 rounded-xl flex items-center justify-center group-hover:bg-accent-blue/30 transition-colors">
                    <Plus className="w-6 h-6 text-accent-blue" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{t('dashboard.createNew')}</h3>
                    <p className="text-text-secondary">{t('dashboard.createNewDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/join-league">
            <Card className="bg-gradient-to-br from-accent-green/10 to-accent-blue/10 border border-accent-green/20 rounded-2xl hover:border-accent-green/40 transition-all duration-300 cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-accent-green/20 rounded-xl flex items-center justify-center group-hover:bg-accent-green/30 transition-colors">
                    <Key className="w-6 h-6 text-accent-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{t('dashboard.joinWithCode')}</h3>
                    <p className="text-text-secondary">{t('dashboard.joinWithCodeDesc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* My Leagues */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-6">{t('dashboard.myLeagues')}</h2>
          <Card className="bg-secondary/30 border border-gray-600/50 rounded-2xl">
            <CardContent className="p-12 text-center">
              <p className="text-text-secondary">No leagues found. Join or create a league to get started!</p>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}

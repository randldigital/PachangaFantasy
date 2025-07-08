import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  console.log('ProtectedRoute render:', { user, loading, hasToken: !!localStorage.getItem('token') });

  useEffect(() => {
    if (!loading && !user) {
      console.log('No user, redirecting to login');
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-text-secondary">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <p className="text-text-secondary">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}

import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  return (
    <nav className="bg-secondary/90 backdrop-blur-sm border-b border-accent-blue/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/dashboard">
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-accent-blue to-accent-green bg-clip-text text-transparent">
                {t('app.title')}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/dashboard">
              <span className={`text-text-secondary hover:text-accent-blue transition-colors cursor-pointer ${location === '/dashboard' ? 'text-accent-blue' : ''}`}>
                {t('nav.myLeagues')}
              </span>
            </Link>
            <Link href="/create-league">
              <span className={`text-text-secondary hover:text-accent-blue transition-colors cursor-pointer ${location === '/create-league' ? 'text-accent-blue' : ''}`}>
                {t('nav.createLeague')}
              </span>
            </Link>
            
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-accent-green rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">{user.username}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-text-secondary hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

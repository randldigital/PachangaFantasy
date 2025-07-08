import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@shared/schema';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      // Small delay to ensure auth state is properly updated
      setTimeout(() => {
        setLocation('/dashboard');
      }, 100);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Invalid credentials',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 bg-primary">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="max-w-md w-full space-y-8 animate-fadeIn px-4">
        {/* Logo Header */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-accent-blue via-accent-purple to-accent-green rounded-2xl flex items-center justify-center mb-6 animate-float">
            <span className="text-white font-bold text-3xl">P</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent-blue to-accent-green bg-clip-text text-transparent">
            {t('app.title')}
          </h1>
          <p className="text-text-secondary mt-2">{t('app.subtitle')}</p>
        </div>

        {/* Auth Form */}
        <Card className="bg-secondary/50 backdrop-blur-sm border border-gray-700/50">
          <CardContent className="pt-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Input */}
              <div className="relative">
                <Label htmlFor="email" className="text-text-secondary">
                  {t('auth.email')}
                </Label>
                <Input
                  {...form.register('email')}
                  type="email"
                  className="mt-1 bg-transparent border-b-2 border-gray-600 rounded-none focus:border-accent-blue focus:ring-0 transition-all duration-300"
                  placeholder={t('auth.email')}
                />
                {form.formState.errors.email && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>

              {/* Password Input */}
              <div className="relative">
                <Label htmlFor="password" className="text-text-secondary">
                  {t('auth.password')}
                </Label>
                <Input
                  {...form.register('password')}
                  type="password"
                  className="mt-1 bg-transparent border-b-2 border-gray-600 rounded-none focus:border-accent-blue focus:ring-0 transition-all duration-300"
                  placeholder={t('auth.password')}
                />
                {form.formState.errors.password && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg hover:shadow-accent-blue/25 transform hover:scale-105 transition-all duration-300 focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-primary"
              >
                {isLoading ? t('common.loading') : t('auth.loginButton')}
              </Button>

              <div className="text-center">
                <Link href="/register">
                  <span className="text-accent-blue hover:text-accent-green transition-colors text-sm cursor-pointer">
                    {t('auth.noAccount')}
                  </span>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

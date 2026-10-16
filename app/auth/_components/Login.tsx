'use client';

import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Mail, Lock, Eye as EyeIcon, EyeOff, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';

interface LoginProps {
  onSwitchToSignup: () => void;
}

export default function Login({ onSwitchToSignup }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const { login } = useAuth();
  const { t } = useLanguage();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email address').required('Required'),
      password: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      setServerError(null);
      try {
        await login(values);
        toast.success('Logged in successfully!');
      } catch (error: unknown) {
        setServerError(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
      }
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center lg:text-left space-y-2">
        <CardTitle className="text-3xl lg:text-4xl font-bold font-clash-display">
          {t('Welcome back')}
        </CardTitle>
        <CardDescription>
          Please enter your details to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={formik.handleSubmit} className="space-y-5">
          {serverError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {serverError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('Email')}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <Input
                  type="email"
                  {...formik.getFieldProps('email')}
                  className="pl-10 h-10"
                  aria-invalid={!!(formik.touched.email && formik.errors.email)}
                  placeholder="Enter your email"
                />
              </div>
              {formik.touched.email && formik.errors.email ? (
                <div className="text-destructive text-xs mt-1">{formik.errors.email}</div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('Password')}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...formik.getFieldProps('password')}
                  className="pl-10 pr-12 h-10"
                  aria-invalid={!!(formik.touched.password && formik.errors.password)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {formik.touched.password && formik.errors.password ? (
                <div className="text-destructive text-xs mt-1">{formik.errors.password}</div>
              ) : null}
            </div>


          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-input text-primary focus:ring-ring focus:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2"
              />
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formik.isSubmitting ? 'Signing in...' : t('Sign in')}
          </button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t('Sign up')}
          </button>
        </div>
      </CardFooter>
    </Card>
  );
}

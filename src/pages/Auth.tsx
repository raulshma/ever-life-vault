import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Mail, Lock, User, AlertCircle, KeyRound, QrCode } from 'lucide-react';
import { supabase, SUPABASE_NO_REMEMBER_FLAG_KEY } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkUser();
    // Listen for password recovery event when visiting from email link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Mark non-remembered sessions so the AuthProvider can keep the session in sessionStorage
        try {
          if (!rememberMe) {
            sessionStorage.setItem(SUPABASE_NO_REMEMBER_FLAG_KEY, '1');
          } else {
            sessionStorage.removeItem(SUPABASE_NO_REMEMBER_FLAG_KEY);
          }
        } catch {}

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // If MFA is required by the server, start the challenge flow
          const code = (error as any)?.code || '';
          const lowerMsg = (error.message || '').toLowerCase();
          if (code === 'mfa_required' || lowerMsg.includes('mfa') || lowerMsg.includes('2fa')) {
            const started = await startMfaFlow();
            if (started) return;
          }
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials.');
          } else {
            setError(error.message);
          }
          return;
        }

        // Check AAL to see if the user needs to complete MFA
        try {
          const aal = await (supabase.auth as any)?.mfa?.getAuthenticatorAssuranceLevel?.();
          const currentLevel = aal?.data?.currentLevel || aal?.currentLevel;
          const nextLevel = aal?.data?.nextLevel || aal?.nextLevel;
          if (currentLevel === 'aal1' && nextLevel === 'aal2') {
            const started = await startMfaFlow();
            if (started) return;
          }
        } catch {}

        toast({
          title: 'Welcome back!',
          description: 'You have been successfully logged in.',
        });
        navigate('/');
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: displayName || 'User'
            }
          }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            setError('This email is already registered. Please sign in instead.');
          } else {
            setError(error.message);
          }
          return;
        }

        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account.',
        });
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startMfaFlow = async (): Promise<boolean> => {
    try {
      const mfaApi = (supabase.auth as any)?.mfa;
      if (!mfaApi?.listFactors || !mfaApi?.challenge) {
        setError('MFA is not available in this environment.');
        return false;
      }
      const factors = await mfaApi.listFactors();
      if (factors?.error) {
        setError(factors.error.message);
        return false;
      }
      const totpFactor = factors?.data?.totp?.[0];
      if (!totpFactor?.id) {
        setError('No TOTP factor enrolled for this account.');
        return false;
      }
      const factorId = totpFactor.id as string;
      const challenge = await mfaApi.challenge({ factorId });
      if (challenge?.error) {
        setError(challenge.error.message);
        return false;
      }
      const challengeId = challenge?.data?.id as string;
      setMfaFactorId(factorId);
      setMfaChallengeId(challengeId);
      setIsMfaRequired(true);
      toast({ title: '2FA required', description: 'Enter your authenticator code.' });
      return true;
    } catch (err) {
      setError('Failed to start MFA verification.');
      return false;
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setLoading(true);
    setError('');
    try {
      // Verify TOTP using the mfa factor + challenge id
      const mfaApi = (supabase.auth as any)?.mfa;
      if (!mfaApi?.verify) {
        setError('MFA verify is not available in this environment.');
        return;
      }
      const { error } = await mfaApi.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: otp,
      });
      if (error) {
        setError(error.message || 'Invalid code.');
        return;
      }
      setIsMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      setOtp('');
      toast({ title: 'Signed in', description: '2FA verification successful.' });
      navigate('/');
    } catch (err) {
      setError('Failed to verify the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectUrl = `${window.location.origin}/auth`; // back to auth to finish reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        setError(error.message);
        return;
      }
      toast({ title: 'Password reset email sent', description: 'Check your inbox for the reset link.' });
    } catch (err) {
      setError('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setError(error.message);
        return;
      }
      setIsResettingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      navigate('/');
    } catch (err) {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-foreground/20"></div>
      <Card className="relative w-full max-w-md bg-card/95 backdrop-blur-sm shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl mx-auto">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              {isLogin 
                ? 'Sign in to access your Life OS dashboard' 
                : 'Get started with your personal Life OS'
              }
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {!isMfaRequired && !isResettingPassword ? (
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-primary"
                />
                <span>Remember me</span>
              </label>
              {isLogin && (
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto"
                  onClick={handleForgotPassword}
                  disabled={!email || loading}
                >
                  Forgot password?
                </Button>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
          ) : isMfaRequired ? (
            <form onSubmit={handleOtpVerify} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp">Authenticator Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsMfaRequired(false);
                  setMfaFactorId(null);
                  setMfaChallengeId(null);
                  setOtp('');
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <Button
                variant="link"
                className="ml-1 p-0 h-auto font-semibold"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
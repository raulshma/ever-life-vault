import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { validateMasterPassword } from '@/lib/crypto';

interface MasterPasswordSetupProps {
  onSetup: (password: string) => Promise<boolean>;
  loading?: boolean;
}

export function MasterPasswordSetup({ onSetup, loading = false }: MasterPasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const validation = validateMasterPassword(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = validation.isValid && passwordsMatch && password.length > 0;

  // Calculate password strength score
  const getPasswordStrength = () => {
    let score = 0;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[a-z]/.test(password)) score += 20;
    if (/\d/.test(password)) score += 15;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score += 15;
    return Math.min(score, 100);
  };

  const passwordStrength = getPasswordStrength();
  const getStrengthColor = () => {
    if (passwordStrength < 40) return 'bg-[hsl(var(--destructive))]';
    if (passwordStrength < 70) return 'bg-[hsl(var(--warning))]';
    return 'bg-[hsl(var(--success))]';
  };

  const getStrengthText = () => {
    if (passwordStrength < 40) return 'Weak';
    if (passwordStrength < 70) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    
    await onSetup(password);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-[hsl(var(--info)/0.15)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-[hsl(var(--accent))]" />
          </div>
          <CardTitle className="text-2xl">Create Master Password</CardTitle>
          <p className="text-muted-foreground">
            Set up a strong master password to secure your vault with end-to-end encryption
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Master Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Password Strength</span>
                    <span className={`font-medium ${
                      passwordStrength < 40 ? 'text-[hsl(var(--destructive))]' :
                      passwordStrength < 70 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <Progress 
                    value={passwordStrength} 
                    className="h-2"
                  />
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your master password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className="flex items-center space-x-2 text-sm">
                  {passwordsMatch ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                      <span className="text-[hsl(var(--success))]">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />
                      <span className="text-[hsl(var(--destructive))]">Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Password Requirements */}
            {password && !validation.isValid && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Password requirements:</p>
                    <ul className="text-sm space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <XCircle className="w-3 h-3 text-[hsl(var(--destructive))]" />
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Security Information */}
            <Alert>
              <Lock className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Security Features:</p>
                  <ul className="text-sm space-y-1">
                    <li>• AES-256-GCM encryption</li>
                    <li>• PBKDF2 with 100,000 iterations</li>
                    <li>• Zero-knowledge architecture</li>
                    <li>• Auto-lock after 15 minutes</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Creating Vault...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Create Secure Vault
                </>
              )}
            </Button>
          </form>

          {/* Warning */}
            <Alert className="mt-4 border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.12)]">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
              <AlertDescription className="text-[hsl(var(--warning-foreground))]">
              <strong>Important:</strong> Your master password cannot be recovered. 
              Make sure to remember it or store it in a safe place.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
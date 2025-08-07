import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Key,
  AlertTriangle
} from 'lucide-react';

interface VaultUnlockProps {
  onUnlock: (password: string) => Promise<boolean>;
  loading?: boolean;
  error?: string;
}

export function VaultUnlock({ onUnlock, loading = false, error }: VaultUnlockProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    
    const success = await onUnlock(password);
    if (!success) {
      setAttempts(prev => prev + 1);
      setPassword(''); // Clear password on failed attempt
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Unlock Vault</CardTitle>
          <p className="text-muted-foreground">
            Enter your master password to access your encrypted vault
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
                  autoFocus
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
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Failed Attempts Warning */}
            {attempts > 2 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Multiple failed attempts detected. Make sure you're entering the correct master password.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!password.trim() || loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Unlock Vault
                </>
              )}
            </Button>
          </form>

          {/* Security Information */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Your vault is secured with:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• End-to-end encryption</li>
                  <li>• Zero-knowledge architecture</li>
                  <li>• Auto-lock after inactivity</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Forgot your master password? Unfortunately, it cannot be recovered due to our zero-knowledge security model.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
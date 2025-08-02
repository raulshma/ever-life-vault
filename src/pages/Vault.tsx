import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy,
  Plus,
  AlertTriangle
} from 'lucide-react';

export default function Vault() {
  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-hero text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <Shield className="w-8 h-8 mr-3" />
                Secure Vault
              </h1>
              <p className="text-white/90">End-to-end encrypted credential storage</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Lock className="w-3 h-3 mr-1" />
                Encrypted
              </Badge>
              <Button variant="hero" className="bg-white/20 hover:bg-white/30">
                <Plus className="w-4 h-4 mr-2" />
                Add Credential
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Security Notice */}
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">
                  End-to-End Encryption Active
                </h3>
                <p className="text-amber-700 text-sm">
                  All data in your vault is encrypted on your device before being stored. 
                  Even we cannot access your sensitive information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vault Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Login Credentials */}
          <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Key className="w-5 h-5 mr-2 text-blue-600" />
                Login Credentials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">gmail.com</div>
                      <div className="text-xs text-muted-foreground">john.doe@gmail.com</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">github.com</div>
                      <div className="text-xs text-muted-foreground">johndoe_dev</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">banking.example.com</div>
                      <div className="text-xs text-muted-foreground">johndoe123</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button variant="ghost" className="w-full mt-4 text-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Login
              </Button>
            </CardContent>
          </Card>

          {/* Secure Notes */}
          <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Lock className="w-5 h-5 mr-2 text-green-600" />
                Secure Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">WiFi Passwords</div>
                      <div className="text-xs text-muted-foreground">Home and office networks</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Recovery Codes</div>
                      <div className="text-xs text-muted-foreground">2FA backup codes</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Server Access</div>
                      <div className="text-xs text-muted-foreground">SSH keys and credentials</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button variant="ghost" className="w-full mt-4 text-green-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Secure Note
              </Button>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Key className="w-5 h-5 mr-2 text-purple-600" />
                API Keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">OpenAI API</div>
                      <div className="text-xs text-muted-foreground">GPT-4 access</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <EyeOff className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Stripe API</div>
                      <div className="text-xs text-muted-foreground">Payment processing</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <EyeOff className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">AWS Access Key</div>
                      <div className="text-xs text-muted-foreground">Cloud services</div>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <EyeOff className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button variant="ghost" className="w-full mt-4 text-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                Add API Key
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Security Features */}
        <Card className="mt-8 bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">End-to-End Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  Data encrypted on your device before transmission
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Key className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Password Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Generate strong, unique passwords automatically
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Zero Knowledge</h3>
                <p className="text-sm text-muted-foreground">
                  We can't see your data, even if we wanted to
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
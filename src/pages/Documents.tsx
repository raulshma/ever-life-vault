import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Calendar, 
  AlertCircle,
  Folder,
  Search,
  Plus
} from 'lucide-react';

export default function Documents() {
  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-primary text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <FileText className="w-8 h-8 mr-3" />
                Document Hub
              </h1>
              <p className="text-white/90">Securely manage your important personal documents</p>
            </div>
            <Button variant="hero" className="bg-white/20 hover:bg-white/30">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[
            { name: 'Academic', count: 12, icon: '🎓' },
            { name: 'Career', count: 8, icon: '💼' },
            { name: 'Finance', count: 24, icon: '💰' },
            { name: 'Health', count: 15, icon: '🏥' },
            { name: 'Legal', count: 6, icon: '⚖️' },
            { name: 'Receipts', count: 45, icon: '🧾' }
          ].map((category) => (
            <Card key={category.name} className="hover:shadow-card transition-all duration-200 cursor-pointer bg-gradient-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-2">{category.icon}</div>
                <div className="font-medium text-sm">{category.name}</div>
                <div className="text-xs text-muted-foreground">{category.count} docs</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Documents */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Documents</span>
                  <Button variant="ghost" size="sm">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Insurance Policy - Auto', category: 'Legal', date: '2024-01-15', expiry: '2024-12-31' },
                    { name: 'Bank Statement - January', category: 'Finance', date: '2024-01-31' },
                    { name: 'Medical Records - Dr. Smith', category: 'Health', date: '2024-01-20' },
                    { name: 'Warranty - Laptop Purchase', category: 'Receipts', date: '2024-01-10', expiry: '2027-01-10' }
                  ].map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.category} • {doc.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {doc.expiry && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Calendar className="w-3 h-3 mr-1" />
                            Expires {doc.expiry}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Expiring Soon */}
            <Card className="bg-gradient-card shadow-card border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center text-amber-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="font-medium text-sm text-amber-800">Car Insurance</div>
                    <div className="text-xs text-amber-600">Expires in 23 days</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="font-medium text-sm text-amber-800">Passport</div>
                    <div className="text-xs text-amber-600">Expires in 3 months</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Folder className="w-4 h-4 mr-2" />
                  Create Category
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Set Reminder
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
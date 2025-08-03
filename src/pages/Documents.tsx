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
  Plus,
  Loader2
} from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';

export default function Documents() {
  const { documents, loading, getDocumentsByCategory, getExpiringDocuments } = useDocuments();

  const categories = [
    { name: 'Academic', icon: '🎓' },
    { name: 'Career', icon: '💼' },
    { name: 'Finance', icon: '💰' },
    { name: 'Health', icon: '🏥' },
    { name: 'Legal', icon: '⚖️' },
    { name: 'Receipts', icon: '🧾' }
  ];

  const getCategoryCount = (categoryName: string) => {
    return getDocumentsByCategory(categoryName).length;
  };

  const expiringDocs = getExpiringDocuments();
  const recentDocs = documents.slice(0, 4);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

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
          {categories.map((category) => (
            <Card key={category.name} className="hover:shadow-card transition-all duration-200 cursor-pointer bg-gradient-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-2">{category.icon}</div>
                <div className="font-medium text-sm">{category.name}</div>
                <div className="text-xs text-muted-foreground">{getCategoryCount(category.name)} docs</div>
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
                  {recentDocs.length > 0 ? recentDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.category} • {new Date(doc.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {doc.expiry_date && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Calendar className="w-3 h-3 mr-1" />
                            Expires {new Date(doc.expiry_date).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No documents yet</p>
                      <p className="text-sm">Upload your first document to get started</p>
                    </div>
                  )}
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
                  {expiringDocs.length > 0 ? expiringDocs.map((doc) => {
                    const expiryDate = new Date(doc.expiry_date!);
                    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={doc.id} className="p-3 bg-amber-50 rounded-lg">
                        <div className="font-medium text-sm text-amber-800">{doc.name}</div>
                        <div className="text-xs text-amber-600">
                          Expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No documents expiring soon</p>
                    </div>
                  )}
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
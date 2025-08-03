import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package2, 
  MapPin, 
  QrCode, 
  Search,
  Plus,
  Package,
  Home,
  Car,
  Loader2
} from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';

export default function Inventory() {
  const { items, locations, loading, getItemsByLocation, getTotalValue, getItemsWithQR } = useInventory();

  const totalItems = items.length;
  const totalLocations = locations.length;
  const qrItems = getItemsWithQR().length;
  const totalValue = getTotalValue();

  const recentItems = items.slice(0, 6);

  const getLocationIcon = (iconName: string) => {
    switch(iconName.toLowerCase()) {
      case 'home': return Home;
      case 'car': return Car;
      case 'package': return Package;
      default: return Home;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading inventory...</p>
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
                <Package2 className="w-8 h-8 mr-3" />
                Inventory Tracker
              </h1>
              <p className="text-white/90">Track physical items and their locations</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" className="bg-white/10 hover:bg-white/20">
                <QrCode className="w-4 h-4 mr-2" />
                Scan QR
              </Button>
              <Button variant="hero" className="bg-white/20 hover:bg-white/30">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{totalItems}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{totalLocations}</div>
              <div className="text-sm text-muted-foreground">Locations</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <QrCode className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{qrItems}</div>
              <div className="text-sm text-muted-foreground">QR Labeled</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="text-lg">💰</div>
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Locations */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {locations.length > 0 ? locations.map((location) => {
                    const Icon = getLocationIcon(location.icon);
                    const itemCount = getItemsByLocation(location.id).length;
                    return (
                      <div key={location.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{location.name}</span>
                        </div>
                        <Badge variant="secondary">{itemCount}</Badge>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No locations yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items */}
          <div className="lg:col-span-3">
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Items</span>
                  <Button variant="ghost" size="sm">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentItems.length > 0 ? recentItems.map((item) => {
                    const location = locations.find(loc => loc.id === item.location_id);
                    return (
                      <div key={item.id} className="p-4 bg-white rounded-lg border hover:shadow-card transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                              📦
                            </div>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-muted-foreground">{item.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              {item.value ? `$${item.value.toLocaleString()}` : 'N/A'}
                            </div>
                            {item.has_qr_code && (
                              <Badge variant="secondary" className="mt-1">
                                <QrCode className="w-3 h-3 mr-1" />
                                QR
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3 mr-1" />
                            {location?.name || 'No location'}
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 text-xs">
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No items yet</p>
                      <p className="text-sm">Add your first item to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
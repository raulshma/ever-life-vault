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
  Car
} from 'lucide-react';

export default function Inventory() {
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
              <div className="text-2xl font-bold">234</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">12</div>
              <div className="text-sm text-muted-foreground">Locations</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <QrCode className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">45</div>
              <div className="text-sm text-muted-foreground">QR Labeled</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="text-lg">💰</div>
              <div className="text-2xl font-bold">$12.5K</div>
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
                  {[
                    { name: 'Living Room', icon: Home, count: 24 },
                    { name: 'Garage', icon: Car, count: 45 },
                    { name: 'Office', icon: Package, count: 18 },
                    { name: 'Kitchen', icon: Home, count: 32 },
                    { name: 'Bedroom', icon: Home, count: 28 }
                  ].map((location) => {
                    const Icon = location.icon;
                    return (
                      <div key={location.name} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{location.name}</span>
                        </div>
                        <Badge variant="secondary">{location.count}</Badge>
                      </div>
                    );
                  })}
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
                  {[
                    {
                      name: 'MacBook Pro 16"',
                      location: 'Office',
                      value: '$2,499',
                      category: 'Electronics',
                      hasQR: true,
                      image: '💻'
                    },
                    {
                      name: 'Camping Tent',
                      location: 'Garage',
                      value: '$189',
                      category: 'Outdoor',
                      hasQR: false,
                      image: '⛺'
                    },
                    {
                      name: 'Kitchen Aid Mixer',
                      location: 'Kitchen',
                      value: '$349',
                      category: 'Appliances',
                      hasQR: true,
                      image: '🍴'
                    },
                    {
                      name: 'Tool Set',
                      location: 'Garage',
                      value: '$125',
                      category: 'Tools',
                      hasQR: false,
                      image: '🔧'
                    },
                    {
                      name: 'Designer Jacket',
                      location: 'Bedroom',
                      value: '$299',
                      category: 'Clothing',
                      hasQR: false,
                      image: '🧥'
                    },
                    {
                      name: 'Bluetooth Speaker',
                      location: 'Living Room',
                      value: '$79',
                      category: 'Electronics',
                      hasQR: true,
                      image: '🔊'
                    }
                  ].map((item, index) => (
                    <div key={index} className="p-4 bg-white rounded-lg border hover:shadow-card transition-shadow cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                            {item.image}
                          </div>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">{item.category}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">{item.value}</div>
                          {item.hasQR && (
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
                          {item.location}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
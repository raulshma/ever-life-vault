import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Package2, 
  MapPin, 
  QrCode, 
  Search,
  Plus,
  Package,
  Home,
  Car,
  Loader2,
  Eye,
  Edit3,
  Filter,
  Building,
  Warehouse
} from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { InventoryDialog } from '@/components/InventoryDialog';
import { LocationDialog } from '@/components/LocationDialog';
import { QRScanner } from '@/components/QRScanner';

export default function Inventory() {
  const { items, locations, loading, getItemsByLocation, getTotalValue, getItemsWithQR } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedLocationData, setSelectedLocationData] = useState<any>(null);
  const [itemDialogMode, setItemDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [locationDialogMode, setLocationDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const totalItems = items.length;
  const totalLocations = locations.length;
  const qrItems = getItemsWithQR().length;
  const totalValue = getTotalValue();

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = !selectedLocation || item.location_id === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  const recentItems = selectedLocation 
    ? filteredItems.slice(0, 12)
    : filteredItems.slice(0, 6);

  const handleOpenAddItemDialog = () => {
    setSelectedItem(null);
    setItemDialogMode('add');
    setItemDialogOpen(true);
  };

  const handleViewItem = (item: any) => {
    setSelectedItem(item);
    setItemDialogMode('view');
    setItemDialogOpen(true);
  };

  const handleEditItem = (item: any) => {
    setSelectedItem(item);
    setItemDialogMode('edit');
    setItemDialogOpen(true);
  };

  const handleOpenAddLocationDialog = () => {
    setSelectedLocationData(null);
    setLocationDialogMode('add');
    setLocationDialogOpen(true);
  };

  const handleViewLocation = (location: any) => {
    setSelectedLocationData(location);
    setLocationDialogMode('view');
    setLocationDialogOpen(true);
  };

  const handleEditLocation = (location: any) => {
    setSelectedLocationData(location);
    setLocationDialogMode('edit');
    setLocationDialogOpen(true);
  };

  const handleLocationFilter = (locationId: string) => {
    setSelectedLocation(selectedLocation === locationId ? null : locationId);
  };

  const handleQRItemFound = (item: unknown) => {
    setSelectedItem(item);
    setItemDialogMode('view');
    setItemDialogOpen(true);
  };

  const getLocationIcon = (iconName: string) => {
    switch(iconName.toLowerCase()) {
      case 'home': return Home;
      case 'car': return Car;
      case 'package': return Package;
      case 'building': return Building;
      case 'warehouse': return Warehouse;
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
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-gradient-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center">
                <Package2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 flex-shrink-0" />
                <span className="truncate">Inventory Tracker</span>
              </h1>
              <p className="text-white/90 text-xs sm:text-sm">Track physical items and their locations</p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button 
                variant="ghost" 
                className="bg-white/10 hover:bg-white/20 hidden sm:flex"
                onClick={() => setQrScannerOpen(true)}
              >
                <QrCode className="w-4 h-4 mr-2" />
                Scan QR
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="bg-white/10 hover:bg-white/20 sm:hidden"
                onClick={() => setQrScannerOpen(true)}
                aria-label="Scan QR"
              >
                <QrCode className="w-5 h-5" />
              </Button>
              <Button 
                variant="hero" 
                className="bg-white/20 hover:bg-white/30 hidden sm:flex"
                onClick={handleOpenAddItemDialog}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
              <Button 
                variant="hero" 
                size="icon"
                className="bg-white/20 hover:bg-white/30 sm:hidden"
                onClick={handleOpenAddItemDialog}
                aria-label="Add Item"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex sm:inline-flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedLocation(null)}
              className={selectedLocation ? "bg-muted" : ""}
            >
              <Filter className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{selectedLocation ? 'Location Filter' : 'All Locations'}</span>
              <span className="sm:hidden">{selectedLocation ? 'Filtered' : 'All'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4 sm:p-6 text-center">
              <Package className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600 mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl font-bold">{totalItems}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4 sm:p-6 text-center">
              <MapPin className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl font-bold">{totalLocations}</div>
              <div className="text-sm text-muted-foreground">Locations</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4 sm:p-6 text-center">
              <QrCode className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600 mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl font-bold">{qrItems}</div>
              <div className="text-sm text-muted-foreground">QR Labeled</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-lg sm:text-xl">💰</div>
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Locations */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Locations
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenAddLocationDialog}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5 sm:space-y-3">
                  {locations.length > 0 ? locations.map((location) => {
                    const Icon = getLocationIcon(location.icon);
                    const itemCount = getItemsByLocation(location.id).length;
                    const isSelected = selectedLocation === location.id;
                    return (
                      <div 
                        key={location.id} 
                        className={`flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow cursor-pointer ${
                          isSelected ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleLocationFilter(location.id)}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm block truncate">{location.name}</span>
                            {location.description && (
                              <span className="text-xs text-muted-foreground block truncate">{location.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{itemCount}</Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewLocation(location);
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditLocation(location);
                              }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
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
                  <span>{selectedLocation ? 'Filtered Items' : 'Recent Items'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenAddItemDialog}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* On small screens, list view; on md+, 2-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {recentItems.length > 0 ? recentItems.map((item) => {
                    const location = locations.find(loc => loc.id === item.location_id);
                    return (
                      <div key={item.id} className="p-3 sm:p-4 bg-white rounded-lg border hover:shadow-card transition-shadow">
                        <div className="flex items-start gap-3 sm:gap-4">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-lg shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                              📦
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{item.name}</div>
                                <div className="text-xs sm:text-sm text-muted-foreground">{item.category}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold text-emerald-600 text-sm sm:text-base">
                                  {item.value ? `$${item.value.toLocaleString()}` : 'N/A'}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1 justify-end">
                                  {item.has_qr_code && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <QrCode className="w-3 h-3 mr-1" />
                                      QR
                                    </Badge>
                                  )}
                                  {item.is_lent && (
                                    <Badge variant="outline" className="text-[10px] text-orange-600">
                                      Lent
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3 mr-1" />
                                {location?.name || 'No location'}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 sm:h-6 text-xs"
                                  onClick={() => handleViewItem(item)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 sm:h-6 text-xs"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="md:col-span-2 text-center py-8 text-muted-foreground">
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

      <InventoryDialog
        item={selectedItem}
        mode={itemDialogMode}
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
      />

      <LocationDialog
        location={selectedLocationData}
        mode={locationDialogMode}
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
      />

      <QRScanner
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onItemFound={handleQRItemFound}
      />
    </div>
  );
}
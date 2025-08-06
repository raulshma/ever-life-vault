import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/hooks/useInventory';
import { QrReader } from 'react-qr-reader';
import { QrCode, X, Camera } from 'lucide-react';

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemFound?: (item: any) => void;
}

export function QRScanner({ open, onOpenChange, onItemFound }: QRScannerProps) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { items } = useInventory();
  const { toast } = useToast();

  const handleScan = (result: any, error: any) => {
    if (error) {
      setError(error.message);
      return;
    }

    if (result) {
      const scannedData = result.text;
      
      // Find item by QR code data
      const foundItem = items.find(item => 
        item.has_qr_code && item.qr_code_data === scannedData
      );

      if (foundItem) {
        toast({
          title: "Item Found!",
          description: `Found: ${foundItem.name}`,
        });
        onItemFound?.(foundItem);
        onOpenChange(false);
      } else {
        toast({
          title: "Item Not Found",
          description: "No item found with this QR code",
          variant: "destructive",
        });
      }
      
      setScanning(false);
    }
  };

  const handleClose = () => {
    setScanning(false);
    setError(null);
    onOpenChange(false);
  };

  const handleRetry = () => {
    setError(null);
    setScanning(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {scanning && !error && (
            <div className="aspect-square bg-black rounded-lg overflow-hidden">
              <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                className="w-full h-full"
              />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Camera Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRetry} variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {!scanning && !error && (
            <div className="text-center py-8">
              <QrCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Scan Complete</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Check the results above
              </p>
              <Button onClick={handleRetry} variant="outline">
                <QrCode className="w-4 h-4 mr-2" />
                Scan Another
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Position the QR code within the camera view. Make sure your browser has camera permissions enabled.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
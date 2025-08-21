import React from "react";
import { TerminalManager } from "@/features/infrastructure/components/TerminalManager";
import { ResponsiveLayout, ResponsiveText } from "@/features/infrastructure/components/ResponsiveLayout";
import { InfrastructureErrorBoundary } from "@/features/infrastructure/components/ErrorBoundary";

const InfrastructureTerminals: React.FC = () => {
  return (
    <InfrastructureErrorBoundary>
      <ResponsiveLayout>
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <ResponsiveText variant="h1">SSH Terminals</ResponsiveText>
              <ResponsiveText variant="body" className="text-muted-foreground">
                Manage SSH connections to your servers and infrastructure.
              </ResponsiveText>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <TerminalManager />
        </div>
      </ResponsiveLayout>
    </InfrastructureErrorBoundary>
  );
};

export default InfrastructureTerminals;

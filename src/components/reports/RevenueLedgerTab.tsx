import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { InvoiceBuilderTab } from '@/components/invoices/InvoiceBuilderTab';
import { SavedInvoicesTab } from '@/components/invoices/SavedInvoicesTab';
import { StorageGenerationSection } from './StorageGenerationSection';

type SubTab = 'builder' | 'saved' | 'storage';

export function RevenueLedgerTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get('subtab') as SubTab | null;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>(
    subtabParam && ['builder', 'saved', 'storage'].includes(subtabParam)
      ? subtabParam
      : 'builder'
  );

  // Sync with URL param
  useEffect(() => {
    if (subtabParam && ['builder', 'saved', 'storage'].includes(subtabParam)) {
      setActiveSubTab(subtabParam as SubTab);
    }
  }, [subtabParam]);

  const handleTabChange = (value: string) => {
    setActiveSubTab(value as SubTab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('subtab', value);
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MaterialIcon name="receipt_long" size="lg" />
          Revenue Ledger
        </h1>
        <p className="text-muted-foreground">
          Create invoices, manage saved invoices, and generate storage charges
        </p>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <MaterialIcon name="add_circle" size="sm" />
            Invoice Builder
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <MaterialIcon name="folder" size="sm" />
            Saved Invoices
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2">
            <MaterialIcon name="warehouse" size="sm" />
            Storage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-6">
          <InvoiceBuilderTab />
        </TabsContent>

        <TabsContent value="saved" className="mt-6">
          <SavedInvoicesTab />
        </TabsContent>

        <TabsContent value="storage" className="mt-6">
          <StorageGenerationSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTenantTemplates, TemplateResult } from '@/hooks/useTenantTemplates';

export function TenantTemplatesTab() {
  const { loading, applyCoreDefaults, applyFullStarter } = useTenantTemplates();
  const [confirmDialog, setConfirmDialog] = useState<'core' | 'full' | null>(null);
  const [resultData, setResultData] = useState<TemplateResult | null>(null);

  const handleApplyCoreDefaults = async () => {
    setConfirmDialog(null);
    const result = await applyCoreDefaults();
    if (result) {
      setResultData(result);
    }
  };

  const handleApplyFullStarter = async () => {
    setConfirmDialog(null);
    const result = await applyFullStarter();
    if (result) {
      setResultData(result);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <MaterialIcon name="content_copy" size="md" />
          Tenant Templates
        </h3>
        <p className="text-sm text-muted-foreground">
          Apply default configurations to set up categories, task types, and pricing
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <MaterialIcon name="info" className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Safe to Run Multiple Times</p>
              <p className="mt-1">
                These templates only add missing records. They will never overwrite, modify, or delete
                your existing customizations. Run them anytime to fill in gaps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Core Defaults Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="category" className="text-primary" />
                  Core Defaults
                </CardTitle>
                <CardDescription className="mt-1">
                  Essential categories and task types
                </CardDescription>
              </div>
              <Badge variant="secondary">Recommended</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>8 service categories (Receiving, Inspection, Assembly, etc.)</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>6 system task types (Inspection, Receiving, Will Call, etc.)</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>6 size classes (XS, S, M, L, XL, XXL)</span>
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              Does NOT include price list entries. Use Full Starter for that.
            </div>

            <Button
              onClick={() => setConfirmDialog('core')}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                  Apply Core Defaults
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Full Starter Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="rocket_launch" className="text-primary" />
                  Full Starter
                </CardTitle>
                <CardDescription className="mt-1">
                  Complete setup with price list
                </CardDescription>
              </div>
              <Badge>Complete</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>Everything in Core Defaults</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>70+ starter price list entries</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>Class-based pricing (by size)</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>Storage, receiving, inspection, delivery rates</span>
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              Adds service_events entries with default rates. Customize in Pricing tab after.
            </div>

            <Button
              onClick={() => setConfirmDialog('full')}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <MaterialIcon name="rocket_launch" size="sm" className="mr-2" />
                  Apply Full Starter
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Result Summary */}
      {resultData && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-200">
              <MaterialIcon name="check_circle" className="text-green-600" />
              Last Apply Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Categories</div>
                <div className="font-medium">
                  {resultData.categories_added > 0 ? (
                    <span className="text-green-600">+{resultData.categories_added}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <span className="text-muted-foreground"> / {resultData.total_categories}</span>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Task Types</div>
                <div className="font-medium">
                  {resultData.task_types_added > 0 ? (
                    <span className="text-green-600">+{resultData.task_types_added}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <span className="text-muted-foreground"> / {resultData.total_task_types}</span>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Classes</div>
                <div className="font-medium">
                  {resultData.classes_added > 0 ? (
                    <span className="text-green-600">+{resultData.classes_added}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <span className="text-muted-foreground"> / {resultData.total_classes}</span>
                </div>
              </div>
              {resultData.services_added !== undefined && (
                <div>
                  <div className="text-muted-foreground">Price List</div>
                  <div className="font-medium">
                    {resultData.services_added > 0 ? (
                      <span className="text-green-600">+{resultData.services_added}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                    <span className="text-muted-foreground"> / {resultData.total_services}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog !== null} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply {confirmDialog === 'core' ? 'Core Defaults' : 'Full Starter'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === 'core' ? (
                <>
                  This will add any missing service categories, task types, and size classes.
                  Existing records will not be modified.
                </>
              ) : (
                <>
                  This will add core defaults plus the starter price list with default rates.
                  Existing records will not be modified. You can customize rates in the Pricing tab afterward.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog === 'core' ? handleApplyCoreDefaults : handleApplyFullStarter}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

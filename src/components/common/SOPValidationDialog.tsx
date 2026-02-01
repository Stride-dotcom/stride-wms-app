import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';

export interface SOPBlocker {
  code: string;
  message: string;
  severity?: 'blocking' | 'warning';
}

interface SOPValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockers: SOPBlocker[];
  title?: string;
  description?: string;
}

export function SOPValidationDialog({
  open,
  onOpenChange,
  blockers,
  title = "Can't Complete Yet",
  description = 'Fix the items below, then try again.',
}: SOPValidationDialogProps) {
  const blockingItems = blockers.filter(b => b.severity === 'blocking' || !b.severity);
  const warningItems = blockers.filter(b => b.severity === 'warning');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <MaterialIcon name="error" size="md" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {blockingItems.length > 0 && (
            <div className="space-y-2">
              {blockingItems.map((blocker, index) => (
                <div
                  key={`blocking-${index}`}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    'bg-destructive/10 border-destructive/30'
                  )}
                >
                  <MaterialIcon
                    name="block"
                    size="sm"
                    className="text-destructive mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      {blocker.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {blocker.code}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {warningItems.length > 0 && (
            <div className="space-y-2">
              {blockingItems.length > 0 && (
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">
                  Warnings
                </p>
              )}
              {warningItems.map((blocker, index) => (
                <div
                  key={`warning-${index}`}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    'bg-yellow-500/10 border-yellow-500/30'
                  )}
                >
                  <MaterialIcon
                    name="warning"
                    size="sm"
                    className="text-yellow-500 mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      {blocker.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {blocker.code}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

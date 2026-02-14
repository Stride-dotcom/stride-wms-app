import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useShipmentExceptions } from '@/hooks/useShipmentExceptions';

interface ShipmentExceptionBadgeProps {
  shipmentId: string;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function ShipmentExceptionBadge({
  shipmentId,
  count,
  onClick,
  className,
}: ShipmentExceptionBadgeProps) {
  const { openCount } = useShipmentExceptions(count === undefined ? shipmentId : undefined);
  const value = count ?? openCount;

  if (value <= 0) return null;

  if (onClick) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('h-6 px-2 text-xs gap-1 text-amber-700 border-amber-300', className)}
        onClick={onClick}
      >
        <MaterialIcon name="warning" size="sm" />
        {value}
      </Button>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('h-6 px-2 text-xs gap-1 text-amber-700 border-amber-300', className)}
    >
      <MaterialIcon name="warning" size="sm" />
      {value}
    </Badge>
  );
}

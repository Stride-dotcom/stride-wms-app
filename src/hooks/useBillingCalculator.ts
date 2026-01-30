/**
 * useBillingCalculator Hook
 *
 * Fetches services from Price List and calculates billing charges
 * based on context (shipment, task, delivery) and items.
 *
 * Uses pattern matching to find services - no hardcoded service codes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getBillingConfig,
  resolveContextKey,
  BillingCalculatorContextConfig,
  ContextData,
} from '@/lib/billing/calculatorConfig';
import {
  BillingItem,
  RateOverride,
  CustomCharge,
  BillingCalculation,
  BillingLineItem,
  ServiceEvent,
  BillingClass,
} from '@/lib/billing/calculatorTypes';

interface UseBillingCalculatorParams {
  contextType: 'shipment' | 'task' | 'delivery';
  contextData: ContextData;
  items: BillingItem[];
  rateOverrides?: RateOverride[];
  customCharges?: CustomCharge[];
  showTax?: boolean;
  taxRate?: number;
}

interface UseBillingCalculatorResult {
  calculation: BillingCalculation;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Find a service that matches any of the given patterns
 */
function findMatchingServices(
  services: ServiceEvent[],
  patterns: RegExp[]
): ServiceEvent[] {
  return services.filter((service) =>
    patterns.some(
      (pattern) =>
        pattern.test(service.service_name) ||
        pattern.test(service.service_code || '')
    )
  );
}

/**
 * Find the rate for a specific class code
 */
function findRateForClass(
  matchingServices: ServiceEvent[],
  classCode: string | null,
  overrides: RateOverride[]
): { rate: number; service: ServiceEvent | null; isOverride: boolean } {
  // 1. Check for override
  const override = overrides.find(
    (o) => o.class_code === classCode || (o.class_code === null && classCode === null)
  );
  if (override) {
    const service = matchingServices.find((s) => s.class_code === classCode) ||
                    matchingServices.find((s) => s.class_code === null) ||
                    matchingServices[0] || null;
    return { rate: override.rate, service, isOverride: true };
  }

  // 2. Try class-specific rate
  if (classCode) {
    const classService = matchingServices.find((s) => s.class_code === classCode);
    if (classService) {
      return { rate: classService.rate, service: classService, isOverride: false };
    }
  }

  // 3. Fall back to default rate (no class)
  const defaultService = matchingServices.find((s) => s.class_code === null);
  if (defaultService) {
    return { rate: defaultService.rate, service: defaultService, isOverride: false };
  }

  // 4. No rate found - return 0
  return { rate: 0, service: null, isOverride: false };
}

/**
 * Calculate billing charges
 */
function calculateBilling(
  config: BillingCalculatorContextConfig | null,
  contextKey: string | null,
  services: ServiceEvent[],
  classes: BillingClass[],
  items: BillingItem[],
  contextData: ContextData,
  overrides: RateOverride[],
  customCharges: CustomCharge[],
  showTax: boolean,
  taxRate: number
): BillingCalculation {
  // No config means unknown context
  if (!config || !contextKey) {
    return {
      lineItems: [],
      customCharges,
      subtotal: 0,
      customChargesTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      preTaxTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      taxRate: showTax ? taxRate : 0,
      taxAmount: 0,
      grandTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      context: contextKey,
      serviceFound: false,
      hasRateErrors: false,
      error: 'Unknown billing context',
    };
  }

  // Find matching services using pattern matching
  const matchingServices = findMatchingServices(services, config.service_patterns);

  if (matchingServices.length === 0) {
    return {
      lineItems: [],
      customCharges,
      subtotal: 0,
      customChargesTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      preTaxTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      taxRate: showTax ? taxRate : 0,
      taxAmount: 0,
      grandTotal: customCharges.reduce((sum, c) => sum + c.amount, 0),
      context: contextKey,
      serviceFound: false,
      hasRateErrors: false,
      error: `No service found matching patterns for ${config.label}`,
    };
  }

  // Build class code to name mapping
  const classMap = new Map(classes.map((c) => [c.code, c.name]));

  // For Assembly/Repair with selected service, use that specific service
  if (config.use_selected_service && contextData.selected_service_id) {
    const selectedService = services.find((s) => s.id === contextData.selected_service_id);
    if (selectedService) {
      const quantity =
        config.quantity_source === 'hours'
          ? contextData.hours || 1
          : contextData.quantity || 1;

      const { rate, isOverride } = findRateForClass(
        [selectedService],
        null,
        overrides
      );

      const lineItem: BillingLineItem = {
        service_id: selectedService.id,
        service_name: selectedService.service_name,
        service_code: selectedService.service_code,
        class_code: null,
        class_name: null,
        quantity,
        rate,
        total: quantity * rate,
        is_override: isOverride,
      };

      const subtotal = lineItem.total;
      const customChargesTotal = customCharges.reduce((sum, c) => sum + c.amount, 0);
      const preTaxTotal = subtotal + customChargesTotal;
      const taxAmount = showTax ? preTaxTotal * (taxRate / 100) : 0;

      return {
        lineItems: [lineItem],
        customCharges,
        subtotal,
        customChargesTotal,
        preTaxTotal,
        taxRate: showTax ? taxRate : 0,
        taxAmount,
        grandTotal: preTaxTotal + taxAmount,
        context: contextKey,
        serviceFound: true,
        hasRateErrors: rate === 0,
      };
    }
  }

  // Group items by class for calculation
  const itemsByClass = new Map<string | null, number>();
  for (const item of items) {
    const classCode = item.class_code;
    const currentQty = itemsByClass.get(classCode) || 0;
    itemsByClass.set(classCode, currentQty + item.quantity);
  }

  // Calculate line items for each class
  const lineItems: BillingLineItem[] = [];
  let hasRateErrors = false;

  for (const [classCode, quantity] of itemsByClass) {
    if (quantity <= 0) continue;

    const { rate, service, isOverride } = findRateForClass(
      matchingServices,
      classCode,
      overrides
    );

    if (rate === 0) {
      hasRateErrors = true;
    }

    if (service) {
      lineItems.push({
        service_id: service.id,
        service_name: service.service_name,
        service_code: service.service_code,
        class_code: classCode,
        class_name: classCode ? classMap.get(classCode) || classCode : null,
        quantity,
        rate,
        total: quantity * rate,
        is_override: isOverride,
      });
    }
  }

  // Sort line items by class (XS, S, M, L, XL, XXL, null)
  const classOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  lineItems.sort((a, b) => {
    const aIdx = a.class_code ? classOrder.indexOf(a.class_code) : 999;
    const bIdx = b.class_code ? classOrder.indexOf(b.class_code) : 999;
    return aIdx - bIdx;
  });

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const customChargesTotal = customCharges.reduce((sum, c) => sum + c.amount, 0);
  const preTaxTotal = subtotal + customChargesTotal;
  const taxAmount = showTax ? preTaxTotal * (taxRate / 100) : 0;

  return {
    lineItems,
    customCharges,
    subtotal,
    customChargesTotal,
    preTaxTotal,
    taxRate: showTax ? taxRate : 0,
    taxAmount,
    grandTotal: preTaxTotal + taxAmount,
    context: contextKey,
    serviceFound: matchingServices.length > 0,
    hasRateErrors,
  };
}

/**
 * Hook for billing calculation
 */
export function useBillingCalculator({
  contextType,
  contextData,
  items,
  rateOverrides = [],
  customCharges = [],
  showTax = false,
  taxRate = 0,
}: UseBillingCalculatorParams): UseBillingCalculatorResult {
  const { profile } = useAuth();
  const [services, setServices] = useState<ServiceEvent[]>([]);
  const [classes, setClasses] = useState<BillingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve context to config
  const contextKey = useMemo(
    () => resolveContextKey(contextType, contextData),
    [contextType, contextData]
  );

  const config = useMemo(
    () => getBillingConfig(contextType, contextData),
    [contextType, contextData]
  );

  // Fetch services and classes
  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch services filtered by billing triggers if we have config
      let servicesQuery = supabase
        .from('service_events')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true);

      if (config?.billing_triggers && config.billing_triggers.length > 0) {
        servicesQuery = servicesQuery.in('billing_trigger', config.billing_triggers);
      }

      const [servicesResult, classesResult] = await Promise.all([
        servicesQuery,
        supabase
          .from('classes')
          .select('id, code, name')
          .eq('tenant_id', profile.tenant_id),
      ]);

      if (servicesResult.error) throw servicesResult.error;
      if (classesResult.error) throw classesResult.error;

      setServices((servicesResult.data as ServiceEvent[]) || []);
      setClasses((classesResult.data as BillingClass[]) || []);
    } catch (e: any) {
      console.error('Error fetching billing data:', e);
      setError(e.message || 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, config?.billing_triggers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate billing whenever inputs change
  const calculation = useMemo(() => {
    return calculateBilling(
      config,
      contextKey,
      services,
      classes,
      items,
      contextData,
      rateOverrides,
      customCharges,
      showTax,
      taxRate
    );
  }, [
    config,
    contextKey,
    services,
    classes,
    items,
    contextData,
    rateOverrides,
    customCharges,
    showTax,
    taxRate,
  ]);

  return {
    calculation,
    loading,
    error,
    refetch: fetchData,
  };
}

export default useBillingCalculator;

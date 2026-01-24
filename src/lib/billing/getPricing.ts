import { supabase } from '@/integrations/supabase/client';

export interface ServicePricing {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  rate: number;
  timeMinutes: number;
  pullPrepMinutes: number;
  source: 'rate_card' | 'default' | 'fallback';
  isTaxable: boolean;
}

interface ServiceRateLookup {
  serviceCode: string;
  classId?: string | null;
  accountId?: string | null;
}

/**
 * Get pricing for a service based on account rate card, default rate card, or fallback
 */
export async function getServicePricing(
  tenantId: string,
  params: ServiceRateLookup
): Promise<ServicePricing | null> {
  try {
    // 1. Get the service by code
    const { data: service, error: serviceError } = await supabase
      .from('billable_services')
      .select('id, name, code, is_taxable')
      .eq('tenant_id', tenantId)
      .eq('code', params.serviceCode)
      .eq('is_active', true)
      .single();

    if (serviceError || !service) {
      console.warn(`Service not found: ${params.serviceCode}`);
      return null;
    }

    let rate = 0;
    const timeMinutes = 0;
    const pullPrepMinutes = 0;
    let source: 'rate_card' | 'default' | 'fallback' = 'fallback';

    // 2. Try account's rate card first
    if (params.accountId) {
      const { data: account } = await supabase
        .from('accounts')
        .select('rate_card_id')
        .eq('id', params.accountId)
        .single();

      if (account?.rate_card_id) {
        // Try class-specific rate first
        if (params.classId) {
          const { data: classRate } = await supabase
            .from('service_rates')
            .select('rate')
            .eq('rate_card_id', account.rate_card_id)
            .eq('service_id', service.id)
            .eq('class_id', params.classId)
            .eq('is_active', true)
            .maybeSingle();

          if (classRate) {
            rate = classRate.rate;
            source = 'rate_card';
          }
        }

        // If no class-specific rate, try general service rate
        if (source === 'fallback') {
          const { data: serviceRate } = await supabase
            .from('service_rates')
            .select('rate')
            .eq('rate_card_id', account.rate_card_id)
            .eq('service_id', service.id)
            .is('class_id', null)
            .eq('is_active', true)
            .maybeSingle();

          if (serviceRate) {
            rate = serviceRate.rate;
            source = 'rate_card';
          }
        }

        // Apply account rate adjustment if exists
        if (source === 'rate_card') {
          const { data: adjustment } = await (supabase
            .from('account_rate_adjustments') as any)
            .select('percent_adjust')
            .eq('account_id', params.accountId)
            .single();

          if (adjustment?.percent_adjust) {
            rate = rate * (1 + adjustment.percent_adjust);
          }
        }
      }
    }

    // 3. Fall back to default rate card
    if (source === 'fallback') {
      const { data: defaultCard } = await supabase
        .from('rate_cards')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .is('deleted_at', null)
        .single();

      if (defaultCard) {
        // Try class-specific rate first
        if (params.classId) {
          const { data: classRate } = await supabase
            .from('service_rates')
            .select('rate')
            .eq('rate_card_id', defaultCard.id)
            .eq('service_id', service.id)
            .eq('class_id', params.classId)
            .eq('is_active', true)
            .maybeSingle();

          if (classRate) {
            rate = classRate.rate;
            source = 'default';
          }
        }

        // If no class-specific rate, try general service rate
        if (source === 'fallback') {
          const { data: serviceRate } = await supabase
            .from('service_rates')
            .select('rate')
            .eq('rate_card_id', defaultCard.id)
            .eq('service_id', service.id)
            .is('class_id', null)
            .eq('is_active', true)
            .maybeSingle();

          if (serviceRate) {
            rate = serviceRate.rate;
            source = 'default';
          }
        }
      }
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceCode: service.code,
      rate,
      timeMinutes,
      pullPrepMinutes,
      source,
      isTaxable: service.is_taxable ?? true,
    };
  } catch (error) {
    console.error('Error getting service pricing:', error);
    return null;
  }
}

/**
 * Map task type to service code
 */
export function taskTypeToServiceCode(taskType: string): string {
  const mapping: Record<string, string> = {
    'Inspection': 'INSP',
    'Assembly': 'ASSM',
    'Repair': 'REPR',
    'Will Call': 'WLCL',
    'Disposal': 'DISP',
    'Delivery': 'DLVR',
    'Pickup': 'PICK',
    'Pack': 'PACK',
    'Unpack': 'UNPK',
    'Ship': 'SHIP',
  };

  return mapping[taskType] || taskType.toUpperCase().substring(0, 4);
}

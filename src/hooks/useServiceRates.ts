import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ServiceRateRow = Database['public']['Tables']['service_rates']['Row'];

export interface ServiceRate extends ServiceRateRow {
  service?: {
    id: string;
    code: string;
    name: string;
    category: string;
    charge_unit: string;
  } | null;
  class?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface RateLookupParams {
  accountId: string | null;
  serviceCode: string;
  classId?: string | null;
}

export interface RateLookupResult {
  rate: number;
  minimumCharge: number | null;
  source: 'account_rate_card' | 'default_rate_card' | 'fallback';
  serviceId: string | null;
  rateCardId: string | null;
}

export function useServiceRates() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  /**
   * Get the rate for a specific service, following the priority:
   * 1. Account's rate card (if account has one)
   * 2. Tenant's default rate card
   * 3. Zero with warning
   */
  const getRate = useCallback(async (params: RateLookupParams): Promise<RateLookupResult> => {
    if (!profile?.tenant_id) {
      return { rate: 0, minimumCharge: null, source: 'fallback', serviceId: null, rateCardId: null };
    }

    try {
      setLoading(true);

      // First, get the service by code
      const { data: service, error: serviceError } = await supabase
        .from('billable_services')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('code', params.serviceCode)
        .eq('is_active', true)
        .single();

      if (serviceError || !service) {
        console.warn(`Service not found: ${params.serviceCode}`);
        return { rate: 0, minimumCharge: null, source: 'fallback', serviceId: null, rateCardId: null };
      }

      // Try account's rate card first
      if (params.accountId) {
        const { data: account } = await supabase
          .from('accounts')
          .select('rate_card_id')
          .eq('id', params.accountId)
          .single();

        if (account?.rate_card_id) {
          const { data: rate } = await supabase
            .from('service_rates')
            .select('*')
            .eq('rate_card_id', account.rate_card_id)
            .eq('service_id', service.id)
            .eq('is_active', true)
            .maybeSingle();

          if (rate) {
            // Check for class-specific rate
            if (params.classId) {
              const { data: classRate } = await supabase
                .from('service_rates')
                .select('*')
                .eq('rate_card_id', account.rate_card_id)
                .eq('service_id', service.id)
                .eq('class_id', params.classId)
                .eq('is_active', true)
                .maybeSingle();

              if (classRate) {
                return {
                  rate: classRate.rate,
                  minimumCharge: classRate.minimum_charge,
                  source: 'account_rate_card',
                  serviceId: service.id,
                  rateCardId: account.rate_card_id,
                };
              }
            }

            return {
              rate: rate.rate,
              minimumCharge: rate.minimum_charge,
              source: 'account_rate_card',
              serviceId: service.id,
              rateCardId: account.rate_card_id,
            };
          }
        }
      }

      // Fall back to default rate card
      const { data: defaultCard } = await supabase
        .from('rate_cards')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_default', true)
        .is('deleted_at', null)
        .single();

      if (defaultCard) {
        const { data: rate } = await supabase
          .from('service_rates')
          .select('*')
          .eq('rate_card_id', defaultCard.id)
          .eq('service_id', service.id)
          .eq('is_active', true)
          .maybeSingle();

        if (rate) {
          return {
            rate: rate.rate,
            minimumCharge: rate.minimum_charge,
            source: 'default_rate_card',
            serviceId: service.id,
            rateCardId: defaultCard.id,
          };
        }
      }

      // No rate found
      return { rate: 0, minimumCharge: null, source: 'fallback', serviceId: service.id, rateCardId: null };
    } catch (error) {
      console.error('Error looking up rate:', error);
      return { rate: 0, minimumCharge: null, source: 'fallback', serviceId: null, rateCardId: null };
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  /**
   * Get all rates for a rate card
   */
  const getRatesForCard = useCallback(async (rateCardId: string): Promise<ServiceRate[]> => {
    try {
      const { data, error } = await supabase
        .from('service_rates')
        .select(`
          *,
          service:billable_services!service_rates_service_id_fkey(id, code, name, category, charge_unit),
          class:classes!service_rates_class_id_fkey(id, code, name)
        `)
        .eq('rate_card_id', rateCardId)
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching rates for card:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rates',
      });
      return [];
    }
  }, [toast]);

  /**
   * Update or create a rate
   */
  const upsertRate = useCallback(async (data: {
    rateCardId: string;
    serviceId: string;
    classId?: string | null;
    rate: number;
    minimumCharge?: number | null;
  }): Promise<ServiceRateRow | null> => {
    if (!profile?.tenant_id) return null;

    try {
      // Check for existing rate
      let query = supabase
        .from('service_rates')
        .select('id')
        .eq('rate_card_id', data.rateCardId)
        .eq('service_id', data.serviceId);

      if (data.classId) {
        query = query.eq('class_id', data.classId);
      } else {
        query = query.is('class_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update
        const { data: result, error } = await supabase
          .from('service_rates')
          .update({
            rate: data.rate,
            minimum_charge: data.minimumCharge,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return result;
      } else {
        // Insert
        const { data: result, error } = await supabase
          .from('service_rates')
          .insert([{
            tenant_id: profile.tenant_id,
            rate_card_id: data.rateCardId,
            service_id: data.serviceId,
            class_id: data.classId || null,
            rate: data.rate,
            minimum_charge: data.minimumCharge,
          }])
          .select()
          .single();

        if (error) throw error;
        return result;
      }
    } catch (error) {
      console.error('Error upserting rate:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save rate',
      });
      return null;
    }
  }, [profile?.tenant_id, toast]);

  return {
    loading,
    getRate,
    getRatesForCard,
    upsertRate,
  };
}

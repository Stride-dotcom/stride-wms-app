/**
 * Promo Code Utilities - Find and apply promo codes to billing events
 */

import { supabase } from '@/integrations/supabase/client';

export interface ApplicablePromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'flat_rate';
  discount_value: number;
  service_scope: 'all' | 'selected';
  selected_services: string[] | null;
}

export interface PromoDiscount {
  promo_code_id: string;
  promo_code: string;
  discount_type: 'percentage' | 'flat_rate';
  discount_value: number;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
}

/**
 * Find the best applicable promo code for a billing event
 * Returns the promo code that gives the highest discount
 */
export async function findBestPromoCode(
  tenantId: string,
  chargeType: string,
  amount: number,
  accountId?: string | null
): Promise<ApplicablePromoCode | null> {
  try {
    // Fetch all active, non-expired promo codes for this tenant
    const now = new Date().toISOString();

    let query = (supabase.from('promo_codes') as any)
      .select('id, code, discount_type, discount_value, service_scope, selected_services, usage_limit_type, usage_limit, usage_count')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null);

    const { data: promoCodes, error } = await query;

    if (error) {
      console.error('[promoCodeUtils] Error fetching promo codes:', error);
      return null;
    }

    if (!promoCodes || promoCodes.length === 0) {
      return null;
    }

    // Filter to applicable promo codes
    const applicableCodes = promoCodes.filter((pc: any) => {
      // Check expiration
      if (pc.expiration_type === 'date' && pc.expiration_date) {
        if (new Date(pc.expiration_date) < new Date()) {
          return false;
        }
      }

      // Check usage limit
      if (pc.usage_limit_type === 'limited' && pc.usage_limit) {
        if (pc.usage_count >= pc.usage_limit) {
          return false;
        }
      }

      // Check service scope
      if (pc.service_scope === 'selected' && pc.selected_services) {
        if (!pc.selected_services.includes(chargeType)) {
          return false;
        }
      }

      return true;
    });

    if (applicableCodes.length === 0) {
      return null;
    }

    // Find the best discount (highest savings)
    let bestCode: ApplicablePromoCode | null = null;
    let bestDiscount = 0;

    for (const pc of applicableCodes) {
      let discountAmount = 0;

      if (pc.discount_type === 'percentage') {
        discountAmount = amount * (pc.discount_value / 100);
      } else {
        // Flat rate - discount is the full value (capped at amount)
        discountAmount = Math.min(pc.discount_value, amount);
      }

      if (discountAmount > bestDiscount) {
        bestDiscount = discountAmount;
        bestCode = {
          id: pc.id,
          code: pc.code,
          discount_type: pc.discount_type,
          discount_value: pc.discount_value,
          service_scope: pc.service_scope,
          selected_services: pc.selected_services,
        };
      }
    }

    return bestCode;
  } catch (error) {
    console.error('[promoCodeUtils] Error finding promo code:', error);
    return null;
  }
}

/**
 * Calculate the discount for a given promo code and amount
 */
export function calculateDiscount(
  promoCode: ApplicablePromoCode,
  originalAmount: number
): PromoDiscount {
  let discountAmount = 0;

  if (promoCode.discount_type === 'percentage') {
    discountAmount = originalAmount * (promoCode.discount_value / 100);
  } else {
    // Flat rate - cap at original amount
    discountAmount = Math.min(promoCode.discount_value, originalAmount);
  }

  // Round to 2 decimal places
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalAmount = Math.round((originalAmount - discountAmount) * 100) / 100;

  return {
    promo_code_id: promoCode.id,
    promo_code: promoCode.code,
    discount_type: promoCode.discount_type,
    discount_value: promoCode.discount_value,
    original_amount: originalAmount,
    discount_amount: discountAmount,
    final_amount: finalAmount,
  };
}

/**
 * Increment the usage count for a promo code
 */
export async function incrementPromoCodeUsage(promoCodeId: string): Promise<boolean> {
  try {
    const { error } = await (supabase.from('promo_codes') as any)
      .update({
        usage_count: supabase.rpc('increment_promo_usage', { promo_id: promoCodeId })
      })
      .eq('id', promoCodeId);

    // If RPC doesn't exist, use direct increment
    if (error) {
      // Fallback: fetch current count and increment
      const { data: current } = await (supabase.from('promo_codes') as any)
        .select('usage_count')
        .eq('id', promoCodeId)
        .single();

      if (current) {
        await (supabase.from('promo_codes') as any)
          .update({ usage_count: (current.usage_count || 0) + 1 })
          .eq('id', promoCodeId);
      }
    }

    return true;
  } catch (error) {
    console.error('[promoCodeUtils] Error incrementing usage:', error);
    return false;
  }
}

/**
 * Batch increment usage for multiple promo code applications
 */
export async function incrementPromoCodeUsageBatch(
  promoCodeUsages: Map<string, number>
): Promise<boolean> {
  try {
    for (const [promoCodeId, count] of promoCodeUsages) {
      const { data: current } = await (supabase.from('promo_codes') as any)
        .select('usage_count')
        .eq('id', promoCodeId)
        .single();

      if (current) {
        await (supabase.from('promo_codes') as any)
          .update({ usage_count: (current.usage_count || 0) + count })
          .eq('id', promoCodeId);
      }
    }
    return true;
  } catch (error) {
    console.error('[promoCodeUtils] Error incrementing batch usage:', error);
    return false;
  }
}

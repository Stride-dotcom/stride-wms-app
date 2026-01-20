import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomField {
  id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'boolean';
  field_order: number;
}

export interface CustomFieldValue {
  id: string;
  custom_field_id: string;
  value: string | null;
}

export function useCustomFields() {
  const { profile } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFields = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase.from('tenant_custom_fields') as any)
        .select('id, field_name, field_type, field_order')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('field_order', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const createField = useCallback(async (
    fieldName: string,
    fieldType: CustomField['field_type']
  ): Promise<CustomField | null> => {
    if (!profile?.tenant_id || !fieldName.trim()) return null;

    try {
      const { data, error } = await (supabase.from('tenant_custom_fields') as any)
        .insert({
          tenant_id: profile.tenant_id,
          field_name: fieldName.trim(),
          field_type: fieldType,
          field_order: fields.length,
        })
        .select('id, field_name, field_type, field_order')
        .single();

      if (error) throw error;

      setFields(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error creating custom field:', error);
      return null;
    }
  }, [profile?.tenant_id, fields.length]);

  const deleteField = useCallback(async (fieldId: string): Promise<boolean> => {
    try {
      // Soft delete
      const { error } = await (supabase.from('tenant_custom_fields') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fieldId);

      if (error) throw error;

      setFields(prev => prev.filter(f => f.id !== fieldId));
      return true;
    } catch (error) {
      console.error('Error deleting custom field:', error);
      return false;
    }
  }, []);

  return {
    fields,
    loading,
    createField,
    deleteField,
    refetch: fetchFields,
  };
}

export function useItemCustomFieldValues(itemId: string | undefined) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchValues = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase.from('item_custom_field_values') as any)
        .select('custom_field_id, value')
        .eq('item_id', itemId);

      if (error) throw error;

      const valuesMap: Record<string, string> = {};
      (data || []).forEach((v: any) => {
        if (v.custom_field_id) {
          valuesMap[v.custom_field_id] = v.value || '';
        }
      });
      setValues(valuesMap);
    } catch (error) {
      console.error('Error fetching custom field values:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  const updateValue = useCallback(async (
    customFieldId: string,
    value: string
  ): Promise<boolean> => {
    if (!itemId) return false;

    try {
      // Try upsert
      const { error } = await (supabase.from('item_custom_field_values') as any)
        .upsert({
          item_id: itemId,
          custom_field_id: customFieldId,
          value: value || null,
        }, {
          onConflict: 'item_id,custom_field_id',
        });

      if (error) throw error;

      setValues(prev => ({ ...prev, [customFieldId]: value }));
      return true;
    } catch (error) {
      console.error('Error updating custom field value:', error);
      return false;
    }
  }, [itemId]);

  return {
    values,
    loading,
    updateValue,
    refetch: fetchValues,
  };
}

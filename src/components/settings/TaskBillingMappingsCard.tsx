/**
 * TaskBillingMappingsCard - Configure which service codes are linked to each task type
 * Displayed within the Services/Pricing settings tab
 */

import { useState, useEffect, useCallback } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TaskType {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  billing_service_code: string | null;
}

interface ServiceCode {
  service_code: string;
  service_name: string;
}

export function TaskBillingMappingsCard() {
  const { profile } = useAuth();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [serviceCodes, setServiceCodes] = useState<ServiceCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      // Fetch task types
      const { data: taskTypesData, error: taskTypesError } = await (supabase
        .from('task_types') as any)
        .select('id, name, description, is_system, billing_service_code')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order');

      if (taskTypesError) throw taskTypesError;

      // Fetch unique service codes from service_events
      const { data: serviceCodesData, error: serviceCodesError } = await supabase
        .from('service_events')
        .select('service_code, service_name')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .is('class_code', null) // Only get general (non-class-specific) services
        .order('service_code');

      if (serviceCodesError) throw serviceCodesError;

      // Deduplicate service codes
      const uniqueServices = new Map<string, ServiceCode>();
      (serviceCodesData || []).forEach(s => {
        if (!uniqueServices.has(s.service_code)) {
          uniqueServices.set(s.service_code, {
            service_code: s.service_code,
            service_name: s.service_name,
          });
        }
      });

      setTaskTypes(taskTypesData || []);
      setServiceCodes(Array.from(uniqueServices.values()));
    } catch (error) {
      console.error('Error fetching task billing mappings:', error);
      toast.error('Failed to load task types');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateTaskServiceCode = async (taskTypeId: string, serviceCode: string | null) => {
    setSaving(taskTypeId);
    try {
      const { error } = await (supabase
        .from('task_types') as any)
        .update({ billing_service_code: serviceCode })
        .eq('id', taskTypeId);

      if (error) throw error;

      setTaskTypes(prev => prev.map(t => 
        t.id === taskTypeId ? { ...t, billing_service_code: serviceCode } : t
      ));

      toast.success('Task billing mapping updated');
    } catch (error) {
      console.error('Error updating task service code:', error);
      toast.error('Failed to update mapping');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MaterialIcon name="link" size="md" className="text-primary" />
          <div>
            <CardTitle className="text-lg">Task Billing Mappings</CardTitle>
            <CardDescription>
              Configure which Price List service is used when each task type completes.
              The rate will be looked up from the Price List based on item class.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Type</TableHead>
              <TableHead>Linked Service Code</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskTypes.map(taskType => (
              <TableRow key={taskType.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{taskType.name}</span>
                    {taskType.is_system && (
                      <Badge variant="outline" className="text-xs">System</Badge>
                    )}
                  </div>
                  {taskType.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{taskType.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={taskType.billing_service_code || 'none'}
                    onValueChange={(value) => updateTaskServiceCode(taskType.id, value === 'none' ? null : value)}
                    disabled={saving === taskType.id}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select service..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No billing</span>
                      </SelectItem>
                      {serviceCodes.map(service => (
                        <SelectItem key={service.service_code} value={service.service_code}>
                          <span className="font-mono text-xs mr-2">{service.service_code}</span>
                          <span className="text-muted-foreground">- {service.service_name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  {saving === taskType.id && (
                    <MaterialIcon name="progress_activity" size="sm" className="animate-spin text-muted-foreground" />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {taskTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No task types found. Task types are created when you create your first task.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

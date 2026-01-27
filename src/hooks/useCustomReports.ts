// Hook for managing custom reports

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  CustomReport,
  ReportConfig,
  DataSourceId,
  FilterDefinition,
  ReportData,
  ColumnSelection,
  SortDefinition,
} from '@/lib/reports/types';
import { DATA_SOURCES } from '@/lib/reports/dataSources';

export function useCustomReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all reports for the tenant
  const fetchReports = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setReports((data as CustomReport[]) || []);
    } catch (e) {
      console.error('Error fetching reports:', e);
      toast({
        title: 'Error',
        description: 'Failed to load saved reports',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  // Create a new report
  const createReport = useCallback(
    async (
      name: string,
      description: string,
      dataSource: DataSourceId,
      config: ReportConfig
    ): Promise<CustomReport | null> => {
      if (!profile?.tenant_id || !profile?.id) return null;

      try {
        const { data, error } = await supabase
          .from('custom_reports')
          .insert({
            tenant_id: profile.tenant_id,
            name,
            description: description || null,
            data_source: dataSource,
            config: config as unknown as Record<string, unknown>,
            created_by: profile.id,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Report saved',
          description: `"${name}" has been saved successfully.`,
        });

        await fetchReports();
        return data as CustomReport;
      } catch (e) {
        console.error('Error creating report:', e);
        toast({
          title: 'Error',
          description: 'Failed to save report',
          variant: 'destructive',
        });
        return null;
      }
    },
    [profile?.tenant_id, profile?.id, toast, fetchReports]
  );

  // Update an existing report
  const updateReport = useCallback(
    async (
      id: string,
      updates: Partial<Pick<CustomReport, 'name' | 'description' | 'config' | 'is_shared'>>
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('custom_reports')
          .update({
            ...updates,
            config: updates.config as unknown as Record<string, unknown>,
          })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Report updated',
          description: 'Your changes have been saved.',
        });

        await fetchReports();
        return true;
      } catch (e) {
        console.error('Error updating report:', e);
        toast({
          title: 'Error',
          description: 'Failed to update report',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, fetchReports]
  );

  // Delete a report (soft delete)
  const deleteReport = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('custom_reports')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Report deleted',
          description: 'The report has been removed.',
        });

        await fetchReports();
        return true;
      } catch (e) {
        console.error('Error deleting report:', e);
        toast({
          title: 'Error',
          description: 'Failed to delete report',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, fetchReports]
  );

  // Execute a report and return data
  const executeReport = useCallback(
    async (
      dataSource: DataSourceId,
      config: ReportConfig,
      reportId?: string,
      reportName?: string
    ): Promise<ReportData | null> => {
      if (!profile?.tenant_id) return null;

      const startTime = performance.now();

      try {
        const source = DATA_SOURCES[dataSource];
        if (!source) throw new Error(`Unknown data source: ${dataSource}`);

        // Build select statement
        const visibleColumns = config.columns.filter((c) => c.visible);
        const selectFields = buildSelectFields(dataSource, visibleColumns);

        // Start query
        let query = supabase
          .from(source.tableName)
          .select(selectFields, { count: 'exact' })
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null);

        // Apply filters
        query = applyFilters(query, config.filters, source);

        // Apply sorting
        if (config.orderBy.length > 0) {
          config.orderBy.forEach((sort) => {
            const col = source.columns.find((c) => c.id === sort.column);
            if (col) {
              query = query.order(col.dbColumn, { ascending: sort.direction === 'asc' });
            }
          });
        } else if (source.defaultSort) {
          source.defaultSort.forEach((sort) => {
            query = query.order(sort.column, { ascending: sort.direction === 'asc' });
          });
        }

        // Apply limit
        const limit = config.limit || 1000;
        query = query.limit(limit);

        const { data, count, error } = await query;

        if (error) throw error;

        const executionTime = Math.round(performance.now() - startTime);

        // Transform data for display
        const rows = transformRows(data || [], dataSource, visibleColumns);

        // Calculate summaries
        const summaries = calculateSummaries(rows, config.summaries);

        // Log execution
        await logExecution(
          profile.tenant_id,
          profile.id || '',
          reportId || null,
          reportName || 'Ad-hoc Report',
          dataSource,
          config.filters,
          count || rows.length,
          executionTime
        );

        return {
          rows,
          totalCount: count || rows.length,
          summaries,
          executionTime,
        };
      } catch (e) {
        console.error('Error executing report:', e);
        toast({
          title: 'Error',
          description: 'Failed to run report',
          variant: 'destructive',
        });
        return null;
      }
    },
    [profile?.tenant_id, profile?.id, toast]
  );

  return {
    reports,
    loading,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
    executeReport,
  };
}

// Helper: Build select fields string
function buildSelectFields(dataSourceId: string, columns: ColumnSelection[]): string {
  const source = DATA_SOURCES[dataSourceId];
  if (!source) return '*';

  const fields: string[] = ['id'];

  columns.forEach((col) => {
    const colDef = source.columns.find((c) => c.id === col.id);
    if (colDef) {
      if (colDef.joinTable && colDef.joinColumn) {
        // Join related table
        fields.push(`${colDef.joinTable}:${colDef.dbColumn}(${colDef.joinColumn})`);
      } else {
        fields.push(colDef.dbColumn);
      }
    }
  });

  // Always include tenant_id and deleted_at for filtering
  if (!fields.includes('tenant_id')) fields.push('tenant_id');

  return fields.join(', ');
}

// Helper: Apply filters to query
function applyFilters(
  query: ReturnType<typeof supabase.from>,
  filters: FilterDefinition[],
  source: typeof DATA_SOURCES[string]
): ReturnType<typeof supabase.from> {
  filters.forEach((filter) => {
    const colDef = source.columns.find((c) => c.id === filter.column);
    if (!colDef) return;

    const dbCol = colDef.dbColumn;

    switch (filter.operator) {
      case 'eq':
        query = query.eq(dbCol, filter.value);
        break;
      case 'ne':
        query = query.neq(dbCol, filter.value);
        break;
      case 'gt':
        query = query.gt(dbCol, filter.value);
        break;
      case 'gte':
        query = query.gte(dbCol, filter.value);
        break;
      case 'lt':
        query = query.lt(dbCol, filter.value);
        break;
      case 'lte':
        query = query.lte(dbCol, filter.value);
        break;
      case 'contains':
        query = query.ilike(dbCol, `%${filter.value}%`);
        break;
      case 'in':
        if (Array.isArray(filter.value)) {
          query = query.in(dbCol, filter.value);
        }
        break;
      case 'between':
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          query = query.gte(dbCol, filter.value[0]).lte(dbCol, filter.value[1]);
        }
        break;
      case 'is_null':
        query = query.is(dbCol, null);
        break;
      case 'is_not_null':
        query = query.not(dbCol, 'is', null);
        break;
    }
  });

  return query;
}

// Helper: Transform raw data rows for display
function transformRows(
  data: Record<string, unknown>[],
  dataSourceId: string,
  columns: ColumnSelection[]
): Record<string, unknown>[] {
  const source = DATA_SOURCES[dataSourceId];
  if (!source) return data;

  return data.map((row) => {
    const transformed: Record<string, unknown> = { id: row.id };

    columns.forEach((col) => {
      const colDef = source.columns.find((c) => c.id === col.id);
      if (!colDef) return;

      if (colDef.joinTable && colDef.joinColumn) {
        // Extract value from joined table
        const joinedData = row[colDef.joinTable] as Record<string, unknown> | null;
        transformed[col.id] = joinedData ? joinedData[colDef.joinColumn] : null;
      } else {
        transformed[col.id] = row[colDef.dbColumn];
      }
    });

    return transformed;
  });
}

// Helper: Calculate summary values
function calculateSummaries(
  rows: Record<string, unknown>[],
  summaries: { id: string; column: string; aggregation: string; label: string }[]
): Record<string, number> {
  const result: Record<string, number> = {};

  summaries.forEach((summary) => {
    const values = rows
      .map((r) => r[summary.column])
      .filter((v) => v !== null && v !== undefined)
      .map((v) => Number(v))
      .filter((v) => !isNaN(v));

    switch (summary.aggregation) {
      case 'sum':
        result[summary.id] = values.reduce((a, b) => a + b, 0);
        break;
      case 'count':
        result[summary.id] = values.length;
        break;
      case 'avg':
        result[summary.id] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        result[summary.id] = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result[summary.id] = values.length > 0 ? Math.max(...values) : 0;
        break;
    }
  });

  return result;
}

// Helper: Log report execution
async function logExecution(
  tenantId: string,
  userId: string,
  reportId: string | null,
  reportName: string,
  dataSource: DataSourceId,
  filters: FilterDefinition[],
  rowCount: number,
  executionTime: number
): Promise<void> {
  try {
    await supabase.from('report_executions').insert({
      tenant_id: tenantId,
      report_id: reportId,
      report_name: reportName,
      data_source: dataSource,
      filters_applied: filters as unknown as Record<string, unknown>,
      row_count: rowCount,
      execution_time_ms: executionTime,
      executed_by: userId,
    });
  } catch (e) {
    // Silently fail - logging shouldn't break the report
    console.error('Failed to log report execution:', e);
  }
}

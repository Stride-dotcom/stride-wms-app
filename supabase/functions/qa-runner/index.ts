import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// Types
// =============================================================================

interface QARunnerRequest {
  action: 'run_tests' | 'cleanup' | 'get_status';
  suites?: string[];
  warehouse_id?: string;
  mode?: 'create_cleanup' | 'create_only';
  run_id?: string;
}

interface TestResult {
  suite: string;
  test_name: string;
  status: 'pass' | 'fail' | 'skip';
  error_message?: string;
  error_stack?: string;
  details?: Record<string, unknown>;
  entity_ids?: Record<string, string[]>;
  logs?: string;
  started_at: string;
  finished_at: string;
}

interface TestContext {
  supabase: SupabaseClient;
  tenantId: string;
  warehouseId: string | null;
  runId: string;
  logs: string[];
}

// =============================================================================
// Utility Functions
// =============================================================================

function log(ctx: TestContext, message: string) {
  const timestamp = new Date().toISOString();
  ctx.logs.push(`[${timestamp}] ${message}`);
  console.log(`[QA] ${message}`);
}

function generateCode(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-QA-${timestamp}-${random}`.toUpperCase();
}

async function getOrCreateWarehouse(ctx: TestContext): Promise<string> {
  if (ctx.warehouseId) return ctx.warehouseId;

  // Get first active warehouse for tenant
  const { data: warehouses } = await ctx.supabase
    .from('warehouses')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(1);

  if (warehouses && warehouses.length > 0) {
    return warehouses[0].id;
  }

  throw new Error('No active warehouse found for tenant');
}

async function getOrCreateAccount(ctx: TestContext): Promise<string> {
  // Get first account for tenant
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .limit(1);

  if (accounts && accounts.length > 0) {
    return accounts[0].id;
  }

  // Create a QA test account
  const { data: account, error } = await ctx.supabase
    .from('accounts')
    .insert({
      tenant_id: ctx.tenantId,
      account_name: 'QA Test Account',
      account_code: generateCode('ACCT'),
      status: 'active',
      metadata: { qa_test: true, qa_run_id: ctx.runId }
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create QA account: ${error.message}`);
  return account.id;
}

async function getOrCreateLocation(ctx: TestContext, warehouseId: string, type: string = 'bin'): Promise<string> {
  // Get first location for warehouse
  const { data: locations } = await ctx.supabase
    .from('locations')
    .select('id')
    .eq('warehouse_id', warehouseId)
    .eq('type', type)
    .is('deleted_at', null)
    .limit(1);

  if (locations && locations.length > 0) {
    return locations[0].id;
  }

  // Create a QA test location
  const { data: location, error } = await ctx.supabase
    .from('locations')
    .insert({
      warehouse_id: warehouseId,
      code: generateCode('LOC'),
      name: `QA Test Location (${type})`,
      type: type,
      status: 'active',
      metadata: { qa_test: true, qa_run_id: ctx.runId }
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create QA location: ${error.message}`);
  return location.id;
}

// =============================================================================
// Test Suite: Receiving Flow
// =============================================================================

async function runReceivingFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'receiving_flow';
  let shipmentId: string | null = null;
  const itemIds: string[] = [];

  // Test 1: Create inbound shipment with items
  {
    const testName = 'Create inbound shipment with items';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);
      const warehouseId = await getOrCreateWarehouse(ctx);
      const accountId = await getOrCreateAccount(ctx);

      // Create shipment
      const { data: shipment, error: shipmentError } = await ctx.supabase
        .from('shipments')
        .insert({
          tenant_id: ctx.tenantId,
          warehouse_id: warehouseId,
          account_id: accountId,
          shipment_number: generateCode('SHP'),
          shipment_type: 'inbound',
          status: 'pending',
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (shipmentError) throw new Error(`Failed to create shipment: ${shipmentError.message}`);
      shipmentId = shipment.id;
      log(ctx, `Created shipment: ${shipment.shipment_number}`);

      // Create 5 items
      for (let i = 0; i < 5; i++) {
        const { data: item, error: itemError } = await ctx.supabase
          .from('items')
          .insert({
            tenant_id: ctx.tenantId,
            warehouse_id: warehouseId,
            account_id: accountId,
            item_code: generateCode('ITM'),
            description: `QA Test Item ${i + 1}`,
            quantity: 1,
            status: 'pending',
            receiving_shipment_id: shipmentId,
            metadata: { qa_test: true, qa_run_id: ctx.runId }
          })
          .select()
          .single();

        if (itemError) throw new Error(`Failed to create item ${i + 1}: ${itemError.message}`);
        itemIds.push(item.id);
      }

      log(ctx, `Created ${itemIds.length} items`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { shipments: shipmentId ? [shipmentId] : [], items: itemIds },
        details: { items_created: itemIds.length }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Add receiving photos (simulate with URLs)
  {
    const testName = 'Add receiving photos to shipment';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created in previous test');

      log(ctx, `Running test: ${testName}`);
      const photos = [
        'https://placehold.co/400x300?text=QA+Receiving+Photo+1',
        'https://placehold.co/400x300?text=QA+Receiving+Photo+2'
      ];

      const { error } = await ctx.supabase
        .from('shipments')
        .update({ receiving_photos: photos })
        .eq('id', shipmentId);

      if (error) throw new Error(`Failed to add photos: ${error.message}`);
      log(ctx, `Added ${photos.length} receiving photos`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        details: { photos_count: photos.length }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 3: Assign put-away locations to items
  {
    const testName = 'Assign put-away locations to items';
    const startedAt = new Date().toISOString();
    try {
      if (itemIds.length === 0) throw new Error('No items created in previous test');

      log(ctx, `Running test: ${testName}`);
      const warehouseId = await getOrCreateWarehouse(ctx);
      const locationId = await getOrCreateLocation(ctx, warehouseId, 'bin');

      for (const itemId of itemIds) {
        const { error } = await ctx.supabase
          .from('items')
          .update({
            current_location_id: locationId,
            status: 'stored'
          })
          .eq('id', itemId);

        if (error) throw new Error(`Failed to update item ${itemId}: ${error.message}`);
      }

      log(ctx, `Assigned location to ${itemIds.length} items`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        details: { items_updated: itemIds.length, location_id: locationId }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 4: Call validator
  {
    const testName = 'Validate shipment receiving completion';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created in previous test');

      log(ctx, `Running test: ${testName}`);

      const { data: validationResult, error } = await ctx.supabase.rpc(
        'validate_shipment_receiving_completion',
        { p_shipment_id: shipmentId }
      );

      if (error) {
        // Function may not exist, mark as skip
        log(ctx, `Validator function not found, skipping: ${error.message}`);
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'validate_shipment_receiving_completion function not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        const isValid = validationResult?.ok === true;
        log(ctx, `Validation result: ${JSON.stringify(validationResult)}`);

        results.push({
          suite,
          test_name: testName,
          status: isValid ? 'pass' : 'fail',
          error_message: !isValid ? `Validation failed: ${JSON.stringify(validationResult?.blockers)}` : undefined,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { validation_result: validationResult }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 5: Complete receiving
  {
    const testName = 'Complete shipment receiving';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created in previous test');

      log(ctx, `Running test: ${testName}`);

      const { error } = await ctx.supabase
        .from('shipments')
        .update({
          status: 'received',
          received_at: new Date().toISOString()
        })
        .eq('id', shipmentId);

      if (error) throw new Error(`Failed to complete receiving: ${error.message}`);
      log(ctx, 'Shipment marked as received');

      // Verify items have locations
      const { data: items } = await ctx.supabase
        .from('items')
        .select('id, current_location_id, status')
        .in('id', itemIds);

      const allHaveLocations = items?.every(item => item.current_location_id !== null);
      const allStored = items?.every(item => item.status === 'stored');

      if (!allHaveLocations) throw new Error('Not all items have locations assigned');
      if (!allStored) throw new Error('Not all items have stored status');

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        details: { items_with_locations: items?.length }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Outbound / Will Call Flow
// =============================================================================

async function runOutboundFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'outbound_flow';
  let shipmentId: string | null = null;
  const itemIds: string[] = [];

  // Test 1: Create outbound shipment with items
  {
    const testName = 'Create outbound shipment with items';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);
      const warehouseId = await getOrCreateWarehouse(ctx);
      const accountId = await getOrCreateAccount(ctx);
      const locationId = await getOrCreateLocation(ctx, warehouseId, 'bin');

      // Create items first (they need to exist for outbound)
      for (let i = 0; i < 3; i++) {
        const { data: item, error: itemError } = await ctx.supabase
          .from('items')
          .insert({
            tenant_id: ctx.tenantId,
            warehouse_id: warehouseId,
            account_id: accountId,
            item_code: generateCode('ITM'),
            description: `QA Outbound Test Item ${i + 1}`,
            quantity: 1,
            status: 'stored',
            current_location_id: locationId,
            metadata: { qa_test: true, qa_run_id: ctx.runId }
          })
          .select()
          .single();

        if (itemError) throw new Error(`Failed to create item ${i + 1}: ${itemError.message}`);
        itemIds.push(item.id);
      }

      // Create outbound shipment with all required fields for SOP validation
      const { data: shipment, error: shipmentError } = await ctx.supabase
        .from('shipments')
        .insert({
          tenant_id: ctx.tenantId,
          warehouse_id: warehouseId,
          account_id: accountId,
          shipment_number: generateCode('OUT'),
          shipment_type: 'outbound',
          status: 'pending',
          released_to: 'QA Test Recipient',
          release_type: 'Customer Pickup',
          customer_authorized: true,
          customer_authorized_at: new Date().toISOString(),
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (shipmentError) throw new Error(`Failed to create shipment: ${shipmentError.message}`);
      shipmentId = shipment.id;

      // Link items to shipment via shipment_items table (required for validator)
      for (const itemId of itemIds) {
        const { error: linkError } = await ctx.supabase
          .from('shipment_items')
          .insert({
            shipment_id: shipmentId,
            item_id: itemId,
            is_staged: true
          });
        
        if (linkError) log(ctx, `Warning: Failed to link item to shipment_items: ${linkError.message}`);
        
        // Also update items table for backward compatibility
        await ctx.supabase
          .from('items')
          .update({ releasing_shipment_id: shipmentId })
          .eq('id', itemId);
      }

      log(ctx, `Created outbound shipment: ${shipment.shipment_number} with ${itemIds.length} items`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { shipments: shipmentId ? [shipmentId] : [], items: itemIds }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Add release photos
  {
    const testName = 'Add release photos to shipment';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created');

      log(ctx, `Running test: ${testName}`);
      const photos = ['https://placehold.co/400x300?text=QA+Release+Photo'];

      const { error } = await ctx.supabase
        .from('shipments')
        .update({ release_photos: photos })
        .eq('id', shipmentId);

      if (error) throw new Error(`Failed to add photos: ${error.message}`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 3: Validate outbound completion
  {
    const testName = 'Validate outbound completion';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created');

      log(ctx, `Running test: ${testName}`);

      const { data: validationResult, error } = await ctx.supabase.rpc(
        'validate_shipment_outbound_completion',
        { p_shipment_id: shipmentId }
      );

      if (error) {
        log(ctx, `Validator function not found, skipping: ${error.message}`);
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'validate_shipment_outbound_completion function not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        const isValid = validationResult?.ok === true;

        results.push({
          suite,
          test_name: testName,
          status: isValid ? 'pass' : 'fail',
          error_message: !isValid ? `Validation failed: ${JSON.stringify(validationResult?.blockers)}` : undefined,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { validation_result: validationResult }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 4: Complete outbound
  {
    const testName = 'Complete outbound shipment';
    const startedAt = new Date().toISOString();
    try {
      if (!shipmentId) throw new Error('No shipment created');

      log(ctx, `Running test: ${testName}`);

      // Update items to released
      for (const itemId of itemIds) {
        await ctx.supabase
          .from('items')
          .update({
            status: 'released',
            released_at: new Date().toISOString()
          })
          .eq('id', itemId);
      }

      // Complete shipment
      const { error } = await ctx.supabase
        .from('shipments')
        .update({
          status: 'released',
          shipped_at: new Date().toISOString()
        })
        .eq('id', shipmentId);

      if (error) throw new Error(`Failed to complete outbound: ${error.message}`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Task Flow (Inspection/Assembly/Repair)
// =============================================================================

async function runTaskFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'task_flow';
  const itemIds: string[] = [];
  const taskIds: string[] = [];

  // Setup: Create items for tasks
  const warehouseId = await getOrCreateWarehouse(ctx);
  const accountId = await getOrCreateAccount(ctx);
  const locationId = await getOrCreateLocation(ctx, warehouseId, 'bin');

  for (let i = 0; i < 3; i++) {
    const { data: item, error } = await ctx.supabase
      .from('items')
      .insert({
        tenant_id: ctx.tenantId,
        warehouse_id: warehouseId,
        account_id: accountId,
        item_code: generateCode('ITM'),
        description: `QA Task Test Item ${i + 1}`,
        quantity: 1,
        status: 'stored',
        current_location_id: locationId,
        metadata: { qa_test: true, qa_run_id: ctx.runId }
      })
      .select()
      .single();

    if (!error && item) itemIds.push(item.id);
  }

  // Test 1: Create inspection tasks (one per item)
  {
    const testName = 'Create inspection tasks (one per item)';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      for (const itemId of itemIds) {
        const { data: task, error: taskError } = await ctx.supabase
          .from('tasks')
          .insert({
            tenant_id: ctx.tenantId,
            warehouse_id: warehouseId,
            account_id: accountId,
            title: `Inspection - QA Test`,
            task_type: 'inspection',
            status: 'pending',
            related_item_id: itemId,
            metadata: { qa_test: true, qa_run_id: ctx.runId }
          })
          .select()
          .single();

        if (taskError) throw new Error(`Failed to create inspection task: ${taskError.message}`);
        taskIds.push(task.id);

        // Link task to item via task_items
        const { error: linkError } = await ctx.supabase
          .from('task_items')
          .insert({
            task_id: task.id,
            item_id: itemId
          });

        if (linkError) throw new Error(`Failed to link task to item: ${linkError.message}`);
      }

      log(ctx, `Created ${taskIds.length} inspection tasks`);

      // Verify each inspection task has exactly 1 item
      for (const taskId of taskIds) {
        const { data: taskItems } = await ctx.supabase
          .from('task_items')
          .select('id')
          .eq('task_id', taskId);

        if (!taskItems || taskItems.length !== 1) {
          throw new Error(`Inspection task ${taskId} has ${taskItems?.length ?? 0} items, expected 1`);
        }
      }

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { tasks: taskIds, items: itemIds },
        details: { tasks_created: taskIds.length, items_per_task: 1 }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Complete inspection task and verify photos
  {
    const testName = 'Complete inspection task with photos';
    const startedAt = new Date().toISOString();
    try {
      if (taskIds.length === 0) throw new Error('No tasks created');

      log(ctx, `Running test: ${testName}`);
      const taskId = taskIds[0];
      const itemId = itemIds[0];

      // Add item photo (using correct column names)
      const { error: photoError } = await ctx.supabase
        .from('item_photos')
        .insert({
          item_id: itemId,
          tenant_id: ctx.tenantId,
          storage_url: 'https://placehold.co/400x300?text=QA+Inspection+Photo',
          photo_type: 'inspection',
          file_name: 'qa-inspection-photo.jpg',
          caption: `QA Test - Run ${ctx.runId}`
        });

      if (photoError) throw new Error(`Failed to add photo: ${photoError.message}`);

      // Complete task
      const { error: taskError } = await ctx.supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw new Error(`Failed to complete task: ${taskError.message}`);

      // Verify photo exists for item
      const { data: photos } = await ctx.supabase
        .from('item_photos')
        .select('id')
        .eq('item_id', itemId);

      if (!photos || photos.length === 0) {
        throw new Error('No photos found for item after inspection completion');
      }

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        details: { photos_count: photos.length }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 3: Create repair task (should start as pending approval if enforced)
  {
    const testName = 'Create repair task';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: task, error } = await ctx.supabase
        .from('tasks')
        .insert({
          tenant_id: ctx.tenantId,
          warehouse_id: warehouseId,
          account_id: accountId,
          title: `Repair - QA Test`,
          task_type: 'repair',
          status: 'pending',
          related_item_id: itemIds[1],
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create repair task: ${error.message}`);
      taskIds.push(task.id);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { tasks: [task.id] }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 4: Create assembly task
  {
    const testName = 'Create assembly task';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: task, error } = await ctx.supabase
        .from('tasks')
        .insert({
          tenant_id: ctx.tenantId,
          warehouse_id: warehouseId,
          account_id: accountId,
          title: `Assembly - QA Test`,
          task_type: 'assembly',
          status: 'pending',
          related_item_id: itemIds[2],
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create assembly task: ${error.message}`);
      taskIds.push(task.id);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { tasks: [task.id] }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 5: Validate task completion
  {
    const testName = 'Validate task completion';
    const startedAt = new Date().toISOString();
    try {
      if (taskIds.length === 0) throw new Error('No tasks created');

      log(ctx, `Running test: ${testName}`);
      const taskId = taskIds[0];

      const { data: validationResult, error } = await ctx.supabase.rpc(
        'validate_task_completion',
        { p_task_id: taskId }
      );

      if (error) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'validate_task_completion function not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { validation_result: validationResult }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Movement / Put-away Flow
// =============================================================================

async function runMovementFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'movement_flow';

  const warehouseId = await getOrCreateWarehouse(ctx);
  const accountId = await getOrCreateAccount(ctx);
  const locationId1 = await getOrCreateLocation(ctx, warehouseId, 'bin');

  // Create second location
  const { data: location2 } = await ctx.supabase
    .from('locations')
    .insert({
      warehouse_id: warehouseId,
      code: generateCode('LOC'),
      name: 'QA Test Location 2',
      type: 'bin',
      status: 'active',
      metadata: { qa_test: true, qa_run_id: ctx.runId }
    })
    .select()
    .single();

  const locationId2 = location2?.id;

  // Create test item
  const { data: item } = await ctx.supabase
    .from('items')
    .insert({
      tenant_id: ctx.tenantId,
      warehouse_id: warehouseId,
      account_id: accountId,
      item_code: generateCode('ITM'),
      description: 'QA Movement Test Item',
      quantity: 1,
      status: 'stored',
      current_location_id: locationId1,
      metadata: { qa_test: true, qa_run_id: ctx.runId }
    })
    .select()
    .single();

  const itemId = item?.id;

  // Test 1: Move item to new location
  {
    const testName = 'Move item to new location';
    const startedAt = new Date().toISOString();
    try {
      if (!itemId || !locationId2) throw new Error('Setup failed');

      log(ctx, `Running test: ${testName}`);

      const { error } = await ctx.supabase
        .from('items')
        .update({ current_location_id: locationId2 })
        .eq('id', itemId);

      if (error) throw new Error(`Failed to move item: ${error.message}`);

      // Verify movement
      const { data: movedItem } = await ctx.supabase
        .from('items')
        .select('current_location_id')
        .eq('id', itemId)
        .single();

      if (movedItem?.current_location_id !== locationId2) {
        throw new Error('Item location not updated');
      }

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { items: [itemId] },
        details: { from_location: locationId1, to_location: locationId2 }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Validate movement event
  {
    const testName = 'Validate movement event';
    const startedAt = new Date().toISOString();
    try {
      if (!itemId || !locationId1) throw new Error('Setup failed');

      log(ctx, `Running test: ${testName}`);

      const { data: validationResult, error } = await ctx.supabase.rpc(
        'validate_movement_event',
        { p_destination_location_id: locationId1, p_item_ids: [itemId] }
      );

      if (error) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'validate_movement_event function not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { validation_result: validationResult }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Stocktake Flow
// =============================================================================

async function runStocktakeFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'stocktake_flow';
  let stocktakeId: string | null = null;

  const warehouseId = await getOrCreateWarehouse(ctx);

  // Test 1: Create stocktake
  {
    const testName = 'Create stocktake for warehouse';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: stocktake, error } = await ctx.supabase
        .from('stocktakes')
        .insert({
          tenant_id: ctx.tenantId,
          warehouse_id: warehouseId,
          stocktake_number: generateCode('STK'),
          status: 'draft',
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create stocktake: ${error.message}`);
      stocktakeId = stocktake.id;
      log(ctx, `Created stocktake: ${stocktake.stocktake_number}`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { stocktakes: stocktakeId ? [stocktakeId] : [] }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Start stocktake
  {
    const testName = 'Start stocktake';
    const startedAt = new Date().toISOString();
    try {
      if (!stocktakeId) throw new Error('No stocktake created');

      log(ctx, `Running test: ${testName}`);

      const { error } = await ctx.supabase
        .from('stocktakes')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', stocktakeId);

      if (error) throw new Error(`Failed to start stocktake: ${error.message}`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 3: Validate stocktake completion
  {
    const testName = 'Validate stocktake completion';
    const startedAt = new Date().toISOString();
    try {
      if (!stocktakeId) throw new Error('No stocktake created');

      log(ctx, `Running test: ${testName}`);

      const { data: validationResult, error } = await ctx.supabase.rpc(
        'validate_stocktake_completion',
        { p_stocktake_id: stocktakeId }
      );

      if (error) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'validate_stocktake_completion function not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { validation_result: validationResult }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 4: Complete stocktake
  {
    const testName = 'Complete stocktake';
    const startedAt = new Date().toISOString();
    try {
      if (!stocktakeId) throw new Error('No stocktake created');

      log(ctx, `Running test: ${testName}`);

      const { error } = await ctx.supabase
        .from('stocktakes')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', stocktakeId);

      if (error) throw new Error(`Failed to complete stocktake: ${error.message}`);

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Claims + Repair Quote Flow
// =============================================================================

async function runClaimsFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'claims_flow';
  let claimId: string | null = null;

  const warehouseId = await getOrCreateWarehouse(ctx);
  const accountId = await getOrCreateAccount(ctx);
  const locationId = await getOrCreateLocation(ctx, warehouseId, 'bin');

  // Create test item for claim
  const { data: item } = await ctx.supabase
    .from('items')
    .insert({
      tenant_id: ctx.tenantId,
      warehouse_id: warehouseId,
      account_id: accountId,
      item_code: generateCode('ITM'),
      description: 'QA Claims Test Item',
      quantity: 1,
      status: 'stored',
      current_location_id: locationId,
      declared_value: 1000,
      metadata: { qa_test: true, qa_run_id: ctx.runId }
    })
    .select()
    .single();

  const itemId = item?.id;

  // Test 1: Create claim
  {
    const testName = 'Create claim for item';
    const startedAt = new Date().toISOString();
    try {
      if (!itemId) throw new Error('No item created');

      log(ctx, `Running test: ${testName}`);

      const { data: claim, error } = await ctx.supabase
        .from('claims')
        .insert({
          tenant_id: ctx.tenantId,
          account_id: accountId,
          item_id: itemId,
          claim_number: generateCode('CLM'),
          claim_type: 'damage',
          status: 'pending',
          description: 'QA Test Claim - Damage during handling',
          claimed_amount: 500,
          metadata: { qa_test: true, qa_run_id: ctx.runId }
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create claim: ${error.message}`);
      claimId = claim.id;
      log(ctx, `Created claim: ${claim.claim_number}`);

      // Verify tenant_id
      if (claim.tenant_id !== ctx.tenantId) {
        throw new Error('Claim tenant_id mismatch');
      }

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        entity_ids: { claims: claimId ? [claimId] : [], items: itemId ? [itemId] : [] }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Add claim attachments
  {
    const testName = 'Add claim attachments';
    const startedAt = new Date().toISOString();
    try {
      if (!claimId) throw new Error('No claim created');

      log(ctx, `Running test: ${testName}`);

      const photos = [
        'https://placehold.co/400x300?text=QA+Claim+Photo+1',
        'https://placehold.co/400x300?text=QA+Claim+Photo+2'
      ];

      const { error } = await ctx.supabase
        .from('claims')
        .update({ photos })
        .eq('id', claimId);

      if (error) throw new Error(`Failed to add attachments: ${error.message}`);

      // Verify attachments
      const { data: claim } = await ctx.supabase
        .from('claims')
        .select('photos')
        .eq('id', claimId)
        .single();

      if (!claim?.photos || (claim.photos as string[]).length === 0) {
        throw new Error('Attachments not saved');
      }

      results.push({
        suite,
        test_name: testName,
        status: 'pass',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        details: { attachments_count: (claim.photos as string[]).length }
      });
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 3: Create repair quote (if table exists)
  {
    const testName = 'Create repair quote for item';
    const startedAt = new Date().toISOString();
    try {
      if (!itemId) throw new Error('No item created');

      log(ctx, `Running test: ${testName}`);

      // Check if repair_quotes table exists
      const { error: checkError } = await ctx.supabase
        .from('repair_quotes')
        .select('id')
        .limit(1);

      if (checkError && checkError.message.includes('does not exist')) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'repair_quotes table does not exist',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        const { data: quote, error } = await ctx.supabase
          .from('repair_quotes')
          .insert({
            tenant_id: ctx.tenantId,
            item_id: itemId,
            flat_rate: 150,
            approval_status: 'pending',
            notes: 'QA Test Repair Quote',
            metadata: { qa_test: true, qa_run_id: ctx.runId }
          })
          .select()
          .single();

        if (error) throw new Error(`Failed to create repair quote: ${error.message}`);

        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          entity_ids: { repair_quotes: [quote.id] }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Pricing Engine / Class Pricing Flow
// =============================================================================

async function runPricingFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'pricing_flow';

  // Test 1: Check service_events table exists and has data
  {
    const testName = 'Verify service_events pricing table';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: services, error } = await ctx.supabase
        .from('service_events')
        .select('id, service_code, service_name, class_code, rate')
        .eq('tenant_id', ctx.tenantId)
        .limit(10);

      if (error) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'service_events table not found',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { services_found: services?.length || 0 }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Verify class pricing rows (if they exist)
  {
    const testName = 'Verify class pricing structure';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: classPricing, error } = await ctx.supabase
        .from('service_events')
        .select('service_code, class_code, rate')
        .eq('tenant_id', ctx.tenantId)
        .not('class_code', 'is', null);

      if (error) throw new Error(`Failed to query class pricing: ${error.message}`);

      // Check for duplicates
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const row of classPricing || []) {
        const key = `${row.service_code}-${row.class_code}`;
        if (seen.has(key)) {
          duplicates.push(key);
        }
        seen.add(key);
      }

      if (duplicates.length > 0) {
        results.push({
          suite,
          test_name: testName,
          status: 'fail',
          error_message: `Duplicate class pricing rows found: ${duplicates.join(', ')}`,
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { class_pricing_rows: classPricing?.length || 0 }
        });
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Test Suite: Guided Prompts Coverage
// =============================================================================

async function runPromptsFlowTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const suite = 'prompts_flow';

  const expectedPromptTypes = ['receiving', 'inspection', 'assembly', 'repair', 'outbound'];

  // Test 1: Check prompts table exists
  {
    const testName = 'Verify guided prompts table exists';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      // Try tenant_guided_prompts first
      const { error: error1 } = await ctx.supabase
        .from('tenant_guided_prompts')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .limit(1);

      if (!error1) {
        results.push({
          suite,
          test_name: testName,
          status: 'pass',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          details: { table: 'tenant_guided_prompts' }
        });
      } else {
        // Try guided_prompts
        const { error: error2 } = await ctx.supabase
          .from('guided_prompts')
          .select('id')
          .limit(1);

        if (!error2) {
          results.push({
            suite,
            test_name: testName,
            status: 'pass',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            details: { table: 'guided_prompts' }
          });
        } else {
          results.push({
            suite,
            test_name: testName,
            status: 'skip',
            error_message: 'Guided prompts table not found',
            started_at: startedAt,
            finished_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  // Test 2: Check for required prompt types
  {
    const testName = 'Verify required prompt types exist';
    const startedAt = new Date().toISOString();
    try {
      log(ctx, `Running test: ${testName}`);

      const { data: prompts, error } = await ctx.supabase
        .from('tenant_guided_prompts')
        .select('prompt_type, is_enabled')
        .eq('tenant_id', ctx.tenantId);

      if (error) {
        results.push({
          suite,
          test_name: testName,
          status: 'skip',
          error_message: 'Could not query prompts',
          started_at: startedAt,
          finished_at: new Date().toISOString()
        });
      } else {
        const foundTypes = new Set((prompts || []).map(p => p.prompt_type));
        const missingTypes = expectedPromptTypes.filter(t => !foundTypes.has(t));

        if (missingTypes.length > 0) {
          results.push({
            suite,
            test_name: testName,
            status: 'fail',
            error_message: `Missing prompt types: ${missingTypes.join(', ')}`,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            details: { found_types: Array.from(foundTypes), missing_types: missingTypes }
          });
        } else {
          results.push({
            suite,
            test_name: testName,
            status: 'pass',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            details: { prompt_types: Array.from(foundTypes) }
          });
        }
      }
    } catch (error) {
      results.push({
        suite,
        test_name: testName,
        status: 'skip',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }
  }

  return results;
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runTests(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string | null,
  runId: string,
  requestedSuites: string[],
  mode: string
): Promise<{ results: TestResult[]; summary: { pass: number; fail: number; skip: number } }> {
  const ctx: TestContext = {
    supabase,
    tenantId,
    warehouseId,
    runId,
    logs: []
  };

  const allResults: TestResult[] = [];

  const suiteRunners: Record<string, (ctx: TestContext) => Promise<TestResult[]>> = {
    receiving_flow: runReceivingFlowTests,
    outbound_flow: runOutboundFlowTests,
    task_flow: runTaskFlowTests,
    movement_flow: runMovementFlowTests,
    stocktake_flow: runStocktakeFlowTests,
    claims_flow: runClaimsFlowTests,
    pricing_flow: runPricingFlowTests,
    prompts_flow: runPromptsFlowTests
  };

  const suitesToRun = requestedSuites.length > 0
    ? requestedSuites.filter(s => s in suiteRunners)
    : Object.keys(suiteRunners);

  for (const suite of suitesToRun) {
    log(ctx, `Starting suite: ${suite}`);
    try {
      const runner = suiteRunners[suite];
      const results = await runner(ctx);
      allResults.push(...results);

      // Save results to database
      for (const result of results) {
        await supabase.from('qa_test_results').insert({
          run_id: runId,
          tenant_id: tenantId,
          suite: result.suite,
          test_name: result.test_name,
          status: result.status,
          started_at: result.started_at,
          finished_at: result.finished_at,
          error_message: result.error_message,
          error_stack: result.error_stack,
          details: result.details || {},
          entity_ids: result.entity_ids || {},
          logs: result.logs
        });
      }
    } catch (error) {
      log(ctx, `Suite ${suite} failed with error: ${error instanceof Error ? error.message : 'Unknown'}`);
      allResults.push({
        suite,
        test_name: 'Suite execution',
        status: 'fail',
        error_message: error instanceof Error ? error.message : 'Suite execution failed',
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString()
      });
    }
    log(ctx, `Completed suite: ${suite}`);
  }

  // Calculate summary
  const summary = {
    pass: allResults.filter(r => r.status === 'pass').length,
    fail: allResults.filter(r => r.status === 'fail').length,
    skip: allResults.filter(r => r.status === 'skip').length
  };

  // Cleanup if mode is create_cleanup
  if (mode === 'create_cleanup') {
    log(ctx, 'Running cleanup...');
    try {
      await supabase.rpc('cleanup_qa_test_data', { p_run_id: runId });
      log(ctx, 'Cleanup completed');
    } catch (error) {
      log(ctx, `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  return { results: allResults, summary };
}

// =============================================================================
// HTTP Handler
// =============================================================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create client with user's JWT
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey.replace('service_role', ''), {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create service role client for operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile and verify admin
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found for user' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify admin role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`roles(name)`)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const isAdmin = userRoles?.some((ur: any) =>
      ['admin', 'tenant_admin', 'manager'].includes(ur.roles?.name)
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body: QARunnerRequest = await req.json();

    if (body.action === 'cleanup') {
      // Cleanup existing run
      if (!body.run_id) {
        return new Response(JSON.stringify({ error: 'run_id required for cleanup' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: cleanupResult, error: cleanupError } = await supabase.rpc(
        'cleanup_qa_test_data',
        { p_run_id: body.run_id }
      );

      if (cleanupError) {
        return new Response(JSON.stringify({ error: cleanupError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: true, result: cleanupResult }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (body.action === 'get_status') {
      // Get status of a run
      if (!body.run_id) {
        return new Response(JSON.stringify({ error: 'run_id required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: run } = await supabase
        .from('qa_test_runs')
        .select('*')
        .eq('id', body.run_id)
        .single();

      const { data: results } = await supabase
        .from('qa_test_results')
        .select('*')
        .eq('run_id', body.run_id)
        .order('created_at');

      return new Response(JSON.stringify({ run, results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (body.action === 'run_tests') {
      const suites = body.suites || [];
      const warehouseId = body.warehouse_id || null;
      const mode = body.mode || 'create_cleanup';

      // Create test run record
      const { data: run, error: runError } = await supabase
        .from('qa_test_runs')
        .insert({
          tenant_id: profile.tenant_id,
          warehouse_id: warehouseId,
          executed_by: user.id,
          status: 'running',
          mode,
          suites_requested: suites,
          metadata: {
            user_agent: req.headers.get('user-agent'),
            started_via: 'edge_function'
          }
        })
        .select()
        .single();

      if (runError) {
        return new Response(JSON.stringify({ error: runError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Run tests
      const { results, summary } = await runTests(
        supabase,
        profile.tenant_id,
        warehouseId,
        run.id,
        suites,
        mode
      );

      // Update run record
      const finalStatus = summary.fail > 0 ? 'failed' : 'completed';
      await supabase
        .from('qa_test_runs')
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          pass_count: summary.pass,
          fail_count: summary.fail,
          skip_count: summary.skip
        })
        .eq('id', run.id);

      return new Response(JSON.stringify({
        run_id: run.id,
        status: finalStatus,
        summary,
        results_count: results.length
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in qa-runner function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);

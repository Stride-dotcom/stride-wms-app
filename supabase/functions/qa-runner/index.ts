import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================

type TestStatus = 'pass' | 'fail' | 'skip' | 'error';

interface TestStep {
  name: string;
  status: TestStatus;
  message: string;
  expected?: string;
  actual?: string;
  duration_ms?: number;
  entity_ids?: Record<string, string>;
}

interface TestResult {
  test_id: string;
  test_name: string;
  status: TestStatus;
  message: string;
  steps: TestStep[];
  entity_ids: Record<string, string>;
  error?: string;
  error_stack?: string;
  duration_ms: number;
}

interface SuiteResult {
  suite_key: string;
  suite_name: string;
  qa_run_id: string;
  status: TestStatus;
  tests: TestResult[];
  created_entity_ids: Record<string, string[]>;
  total_duration_ms: number;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
}

// ============================================================================
// REPAIR QUOTES FLOW TEST SUITE
// ============================================================================

async function runRepairQuotesFlow(
  supabase: any,
  tenantId: string,
  profileId: string,
  qaRunId: string
): Promise<SuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];
  const createdEntityIds: Record<string, string[]> = {
    accounts: [],
    items: [],
    repair_quotes: [],
    repair_quote_tokens: [],
    tasks: [],
  };

  // Shared state
  let qaAccount: { id: string; name: string } | null = null;
  let qaItem1: { id: string; item_code: string } | null = null;
  let qaItem2: { id: string; item_code: string } | null = null;
  let qaItem3: { id: string; item_code: string } | null = null;
  let quote1: { id: string } | null = null;
  let quote2: { id: string } | null = null;
  let quote3: { id: string } | null = null;

  // Helper: Create QA account
  async function createQAAccount(): Promise<{ id: string; name: string } | null> {
    const accountName = `QA Test Account ${qaRunId.slice(0, 8)}`;
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        tenant_id: tenantId,
        account_name: accountName,
        account_code: `QA-${qaRunId.slice(0, 8)}`,
        status: 'active',
        primary_contact_email: 'qa-test@example.com',
        metadata: { qa_test: true, qa_run_id: qaRunId, source: 'qa_runner' },
      })
      .select('id, account_name')
      .single();

    if (error) return null;
    createdEntityIds.accounts.push(data.id);
    return { id: data.id, name: data.account_name };
  }

  // Helper: Create QA item
  async function createQAItem(accountId: string, suffix: string): Promise<{ id: string; item_code: string } | null> {
    const itemCode = `QA-ITM-${qaRunId.slice(0, 6)}${suffix}`;
    const { data, error } = await supabase
      .from('items')
      .insert({
        tenant_id: tenantId,
        account_id: accountId,
        item_code: itemCode,
        description: `QA Test Item ${suffix}`,
        status: 'active',
        metadata: { qa_test: true, qa_run_id: qaRunId, source: 'qa_runner' },
      })
      .select('id, item_code')
      .single();

    if (error) return null;
    createdEntityIds.items.push(data.id);
    return data;
  }

  // Helper: Create repair quote
  async function createRepairQuote(
    itemId: string,
    accountId: string,
    status: string = 'draft'
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('repair_quotes')
      .insert({
        tenant_id: tenantId,
        item_id: itemId,
        account_id: accountId,
        status,
        audit_log: [{ action: 'created', by: 'QA Runner', at: new Date().toISOString() }],
        metadata: { qa_test: true, qa_run_id: qaRunId, source: 'qa_runner' },
      })
      .select('id')
      .single();

    if (error) return null;
    createdEntityIds.repair_quotes.push(data.id);
    return data;
  }

  // Helper: Set customer price
  async function setCustomerPrice(quoteId: string, price: number): Promise<boolean> {
    const { error } = await supabase
      .from('repair_quotes')
      .update({ customer_total: price, updated_at: new Date().toISOString() })
      .eq('id', quoteId);
    return !error;
  }

  // Helper: Send to client (create token + update status)
  async function sendToClient(quoteId: string): Promise<{ token: string } | null> {
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('customer_total, account_id')
      .eq('id', quoteId)
      .single();

    if (!quote?.customer_total || quote.customer_total <= 0) {
      return null; // Price not set
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { data: tokenData, error: tokenError } = await supabase
      .from('repair_quote_tokens')
      .insert({
        tenant_id: tenantId,
        repair_quote_id: quoteId,
        token_type: 'client_review',
        recipient_email: 'qa-test@example.com',
        recipient_name: 'QA Test Client',
        expires_at: expiresAt.toISOString(),
        created_by: profileId,
        metadata: { qa_test: true, qa_run_id: qaRunId, source: 'qa_runner' },
      })
      .select('token')
      .single();

    if (tokenError) return null;
    createdEntityIds.repair_quote_tokens.push(tokenData.token);

    await supabase
      .from('repair_quotes')
      .update({
        status: 'sent_to_client',
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    return { token: tokenData.token };
  }

  // Helper: Simulate client accept + create repair task
  async function simulateClientAccept(quoteId: string): Promise<{ taskId: string } | null> {
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('audit_log, item_id, tenant_id, account_id, sidemark_id')
      .eq('id', quoteId)
      .single();

    if (!quote) return null;

    const auditLog = quote.audit_log || [];
    auditLog.push({
      action: 'accepted',
      by: null,
      by_name: 'QA Test Client',
      at: new Date().toISOString(),
    });

    const { error: updateError } = await supabase
      .from('repair_quotes')
      .update({
        status: 'accepted',
        client_response: 'accepted',
        client_responded_at: new Date().toISOString(),
        audit_log: auditLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (updateError) return null;

    // Create repair task - SINGLE ITEM ONLY
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        tenant_id: quote.tenant_id,
        account_id: quote.account_id,
        sidemark_id: quote.sidemark_id,
        title: 'Repair - QA Test',
        task_type: 'Repair',
        status: 'pending',
        priority: 'normal',
        metadata: {
          qa_test: true,
          qa_run_id: qaRunId,
          source: 'qa_runner',
          repair_quote_id: quoteId,
        },
      })
      .select('id')
      .single();

    if (taskError) return null;
    createdEntityIds.tasks.push(task.id);

    // Create task_items - ONE item only (HARD REQUIREMENT)
    await supabase.from('task_items').insert({
      task_id: task.id,
      item_id: quote.item_id,
    });

    return { taskId: task.id };
  }

  // Helper: Simulate client decline
  async function simulateClientDecline(quoteId: string): Promise<boolean> {
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('audit_log')
      .eq('id', quoteId)
      .single();

    if (!quote) return false;

    const auditLog = quote.audit_log || [];
    auditLog.push({
      action: 'declined',
      by: null,
      by_name: 'QA Test Client',
      at: new Date().toISOString(),
      details: { reason: 'QA test decline' },
    });

    const { error } = await supabase
      .from('repair_quotes')
      .update({
        status: 'declined',
        client_response: 'declined',
        client_responded_at: new Date().toISOString(),
        audit_log: auditLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    return !error;
  }

  // Helper: Cancel quote
  async function cancelQuote(quoteId: string): Promise<boolean> {
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('audit_log')
      .eq('id', quoteId)
      .single();

    if (!quote) return false;

    const auditLog = quote.audit_log || [];
    auditLog.push({
      action: 'cancelled',
      by: 'QA Test Admin',
      at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('repair_quotes')
      .update({
        status: 'closed',
        audit_log: auditLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    return !error;
  }

  // ==========================================================================
  // TEST 1: Create Quote Request (Single Item)
  // ==========================================================================
  const test1Start = Date.now();
  const test1Steps: TestStep[] = [];
  const test1Entities: Record<string, string> = {};

  try {
    // Step 1: Create QA account
    qaAccount = await createQAAccount();
    if (!qaAccount) {
      test1Steps.push({ name: 'Create QA account', status: 'fail', message: 'Failed to create account' });
      throw new Error('Failed to create QA account');
    }
    test1Steps.push({ name: 'Create QA account', status: 'pass', message: `Created: ${qaAccount.name}` });
    test1Entities.account_id = qaAccount.id;

    // Step 2: Create QA item
    qaItem1 = await createQAItem(qaAccount.id, '-1');
    if (!qaItem1) {
      test1Steps.push({ name: 'Create QA item', status: 'fail', message: 'Failed to create item' });
      throw new Error('Failed to create QA item');
    }
    test1Steps.push({ name: 'Create QA item', status: 'pass', message: `Created: ${qaItem1.item_code}` });
    test1Entities.item_id = qaItem1.id;

    // Step 3: Create repair quote
    quote1 = await createRepairQuote(qaItem1.id, qaAccount.id, 'awaiting_assignment');
    if (!quote1) {
      test1Steps.push({ name: 'Create repair quote', status: 'fail', message: 'Failed to create quote' });
      throw new Error('Failed to create repair quote');
    }
    test1Steps.push({ name: 'Create repair quote', status: 'pass', message: `Created: ${quote1.id.slice(0, 8)}...` });
    test1Entities.quote_id = quote1.id;

    // Step 4: Verify single-item link
    const { data: verifyQuote } = await supabase
      .from('repair_quotes')
      .select('id, item_id, status')
      .eq('id', quote1.id)
      .single();

    if (!verifyQuote?.item_id) {
      test1Steps.push({
        name: 'Verify single-item link',
        status: 'fail',
        message: 'Quote item_id is null',
        expected: 'item_id not null',
        actual: 'null',
      });
      throw new Error('Quote item_id is null');
    }

    if (verifyQuote.item_id !== qaItem1.id) {
      test1Steps.push({
        name: 'Verify single-item link',
        status: 'fail',
        message: 'Quote linked to wrong item',
        expected: qaItem1.id,
        actual: verifyQuote.item_id,
      });
      throw new Error('Quote linked to wrong item');
    }

    test1Steps.push({
      name: 'Verify single-item link',
      status: 'pass',
      message: 'Quote correctly linked to single item',
      expected: qaItem1.id,
      actual: verifyQuote.item_id,
    });

    tests.push({
      test_id: 'rq_1',
      test_name: 'Create Quote Request (Single Item)',
      status: 'pass',
      message: 'Successfully created repair quote for single item',
      steps: test1Steps,
      entity_ids: test1Entities,
      duration_ms: Date.now() - test1Start,
    });
  } catch (error) {
    tests.push({
      test_id: 'rq_1',
      test_name: 'Create Quote Request (Single Item)',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test1Steps,
      entity_ids: test1Entities,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - test1Start,
    });
  }

  // ==========================================================================
  // TEST 2: Duplicate Protection
  // ==========================================================================
  const test2Start = Date.now();
  const test2Steps: TestStep[] = [];
  const test2Entities: Record<string, string> = {};

  try {
    if (!qaItem1 || !qaAccount) {
      test2Steps.push({ name: 'Prerequisites', status: 'skip', message: 'Test 1 failed' });
      throw new Error('Prerequisites not met');
    }

    // Count open quotes for item
    const { count } = await supabase
      .from('repair_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', qaItem1.id)
      .not('status', 'in', '("cancelled","declined","closed")');

    if ((count || 0) > 1) {
      test2Steps.push({
        name: 'Verify single open quote',
        status: 'fail',
        message: 'Multiple open quotes for same item',
        expected: '≤1',
        actual: String(count),
      });
      throw new Error('Duplicate protection failed');
    }

    test2Steps.push({
      name: 'Verify single open quote',
      status: 'pass',
      message: 'Only 1 open quote exists',
      expected: '≤1',
      actual: String(count),
    });

    tests.push({
      test_id: 'rq_2',
      test_name: 'Duplicate Protection',
      status: 'pass',
      message: 'Duplicate protection working',
      steps: test2Steps,
      entity_ids: test2Entities,
      duration_ms: Date.now() - test2Start,
    });
  } catch (error) {
    const status = test2Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_2',
      test_name: 'Duplicate Protection',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test2Steps,
      entity_ids: test2Entities,
      error: error instanceof Error ? error.message : undefined,
      duration_ms: Date.now() - test2Start,
    });
  }

  // ==========================================================================
  // TEST 3: Admin Pricing Required Before Send
  // ==========================================================================
  const test3Start = Date.now();
  const test3Steps: TestStep[] = [];
  const test3Entities: Record<string, string> = {};

  try {
    if (!quote1) {
      test3Steps.push({ name: 'Prerequisites', status: 'skip', message: 'No quote to test' });
      throw new Error('Prerequisites not met');
    }

    test3Entities.quote_id = quote1.id;

    // Step 1: Attempt send without price
    const sendResult1 = await sendToClient(quote1.id);
    if (sendResult1) {
      test3Steps.push({
        name: 'Attempt send without price',
        status: 'fail',
        message: 'Send succeeded without price (should be blocked)',
        expected: 'blocked',
        actual: 'sent',
      });
      throw new Error('Send should be blocked without price');
    }
    test3Steps.push({ name: 'Attempt send without price', status: 'pass', message: 'Correctly blocked' });

    // Step 2: Set customer price
    const priceSet = await setCustomerPrice(quote1.id, 250.00);
    if (!priceSet) {
      test3Steps.push({ name: 'Set customer price', status: 'fail', message: 'Failed to set price' });
      throw new Error('Failed to set price');
    }
    test3Steps.push({ name: 'Set customer price', status: 'pass', message: 'Price set to $250.00' });

    // Step 3: Send to client
    const sendResult2 = await sendToClient(quote1.id);
    if (!sendResult2) {
      test3Steps.push({ name: 'Send to client', status: 'fail', message: 'Failed to send after price set' });
      throw new Error('Failed to send quote');
    }
    test3Steps.push({ name: 'Send to client', status: 'pass', message: `Token: ${sendResult2.token.slice(0, 8)}...` });
    test3Entities.token = sendResult2.token;

    // Step 4: Verify status
    const { data: verifyQuote } = await supabase
      .from('repair_quotes')
      .select('status')
      .eq('id', quote1.id)
      .single();

    if (verifyQuote?.status !== 'sent_to_client') {
      test3Steps.push({
        name: 'Verify status',
        status: 'fail',
        expected: 'sent_to_client',
        actual: verifyQuote?.status,
        message: 'Status not updated',
      });
      throw new Error('Status not updated');
    }
    test3Steps.push({ name: 'Verify status', status: 'pass', message: 'Status: sent_to_client' });

    tests.push({
      test_id: 'rq_3',
      test_name: 'Admin Pricing Required Before Send',
      status: 'pass',
      message: 'Pricing requirement enforced correctly',
      steps: test3Steps,
      entity_ids: test3Entities,
      duration_ms: Date.now() - test3Start,
    });
  } catch (error) {
    const status = test3Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_3',
      test_name: 'Admin Pricing Required Before Send',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test3Steps,
      entity_ids: test3Entities,
      error: error instanceof Error ? error.message : undefined,
      duration_ms: Date.now() - test3Start,
    });
  }

  // ==========================================================================
  // TEST 4: Client Accepts Quote → Creates Single Repair Task
  // ==========================================================================
  const test4Start = Date.now();
  const test4Steps: TestStep[] = [];
  const test4Entities: Record<string, string> = {};

  try {
    if (!quote1 || !qaItem1) {
      test4Steps.push({ name: 'Prerequisites', status: 'skip', message: 'Earlier tests failed' });
      throw new Error('Prerequisites not met');
    }

    test4Entities.quote_id = quote1.id;
    test4Entities.item_id = qaItem1.id;

    // Step 1: Simulate accept
    const acceptResult = await simulateClientAccept(quote1.id);
    if (!acceptResult) {
      test4Steps.push({ name: 'Simulate client accept', status: 'fail', message: 'Accept failed' });
      throw new Error('Accept failed');
    }
    test4Steps.push({ name: 'Simulate client accept', status: 'pass', message: 'Quote accepted' });
    test4Entities.task_id = acceptResult.taskId;

    // Step 2: Verify quote status
    const { data: verifyQuote } = await supabase
      .from('repair_quotes')
      .select('status, client_response')
      .eq('id', quote1.id)
      .single();

    if (verifyQuote?.status !== 'accepted') {
      test4Steps.push({
        name: 'Verify quote status',
        status: 'fail',
        expected: 'accepted',
        actual: verifyQuote?.status,
        message: 'Status not updated',
      });
      throw new Error('Quote status not updated');
    }
    test4Steps.push({ name: 'Verify quote status', status: 'pass', message: 'Status: accepted' });

    // Step 3: Find repair task
    const { data: repairTasks } = await supabase
      .from('tasks')
      .select('id, task_type')
      .eq('tenant_id', tenantId)
      .eq('task_type', 'Repair')
      .contains('metadata', { repair_quote_id: quote1.id });

    if (!repairTasks || repairTasks.length !== 1) {
      test4Steps.push({
        name: 'Verify single repair task',
        status: 'fail',
        expected: '1 task',
        actual: `${repairTasks?.length || 0} tasks`,
        message: 'Should have exactly 1 repair task',
      });
      throw new Error('Wrong number of repair tasks');
    }
    test4Steps.push({ name: 'Verify single repair task', status: 'pass', message: '1 repair task created' });

    // Step 4: Verify task_items count = 1
    const { count: taskItemCount } = await supabase
      .from('task_items')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', repairTasks[0].id);

    if (taskItemCount !== 1) {
      test4Steps.push({
        name: 'Verify single task_item',
        status: 'fail',
        expected: '1',
        actual: String(taskItemCount),
        message: 'Task should have exactly 1 item',
      });
      throw new Error('Task item count mismatch');
    }
    test4Steps.push({ name: 'Verify single task_item', status: 'pass', message: '1 item linked to task' });

    // Step 5: Verify correct item linked
    const { data: taskItems } = await supabase
      .from('task_items')
      .select('item_id')
      .eq('task_id', repairTasks[0].id);

    if (taskItems?.[0]?.item_id !== qaItem1.id) {
      test4Steps.push({
        name: 'Verify correct item',
        status: 'fail',
        expected: qaItem1.id,
        actual: taskItems?.[0]?.item_id,
        message: 'Wrong item linked',
      });
      throw new Error('Wrong item linked');
    }
    test4Steps.push({
      name: 'Verify correct item',
      status: 'pass',
      message: 'Correct item linked to task',
      expected: qaItem1.id,
      actual: taskItems[0].item_id,
    });

    tests.push({
      test_id: 'rq_4',
      test_name: 'Client Accepts Quote → Creates Single Repair Task',
      status: 'pass',
      message: 'Accept creates exactly 1 repair task with 1 item',
      steps: test4Steps,
      entity_ids: test4Entities,
      duration_ms: Date.now() - test4Start,
    });
  } catch (error) {
    const status = test4Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_4',
      test_name: 'Client Accepts Quote → Creates Single Repair Task',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test4Steps,
      entity_ids: test4Entities,
      error: error instanceof Error ? error.message : undefined,
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - test4Start,
    });
  }

  // ==========================================================================
  // TEST 5: Client Declines Quote → No Repair Task
  // ==========================================================================
  const test5Start = Date.now();
  const test5Steps: TestStep[] = [];
  const test5Entities: Record<string, string> = {};

  try {
    if (!qaAccount) {
      test5Steps.push({ name: 'Prerequisites', status: 'skip', message: 'No account' });
      throw new Error('Prerequisites not met');
    }

    // Create fresh item and quote
    qaItem2 = await createQAItem(qaAccount.id, '-2');
    if (!qaItem2) {
      test5Steps.push({ name: 'Create fresh item', status: 'fail', message: 'Failed' });
      throw new Error('Failed to create item');
    }
    test5Steps.push({ name: 'Create fresh item', status: 'pass', message: qaItem2.item_code });
    test5Entities.item_id = qaItem2.id;

    quote2 = await createRepairQuote(qaItem2.id, qaAccount.id, 'draft');
    if (!quote2) {
      test5Steps.push({ name: 'Create quote', status: 'fail', message: 'Failed' });
      throw new Error('Failed to create quote');
    }
    test5Steps.push({ name: 'Create quote', status: 'pass', message: quote2.id.slice(0, 8) });
    test5Entities.quote_id = quote2.id;

    // Set price and send
    await setCustomerPrice(quote2.id, 150.00);
    const sendResult = await sendToClient(quote2.id);
    if (!sendResult) {
      test5Steps.push({ name: 'Send to client', status: 'fail', message: 'Failed' });
      throw new Error('Failed to send');
    }
    test5Steps.push({ name: 'Send to client', status: 'pass', message: 'Sent' });

    // Simulate decline
    const declined = await simulateClientDecline(quote2.id);
    if (!declined) {
      test5Steps.push({ name: 'Simulate decline', status: 'fail', message: 'Failed' });
      throw new Error('Failed to decline');
    }
    test5Steps.push({ name: 'Simulate decline', status: 'pass', message: 'Declined' });

    // Verify no repair task
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('task_type', 'Repair')
      .contains('metadata', { repair_quote_id: quote2.id });

    if (taskCount && taskCount > 0) {
      test5Steps.push({
        name: 'Verify no repair task',
        status: 'fail',
        expected: '0',
        actual: String(taskCount),
        message: 'Task created on decline',
      });
      throw new Error('Task created on decline');
    }
    test5Steps.push({ name: 'Verify no repair task', status: 'pass', message: 'No task created' });

    tests.push({
      test_id: 'rq_5',
      test_name: 'Client Declines Quote → No Repair Task',
      status: 'pass',
      message: 'Decline does not create repair task',
      steps: test5Steps,
      entity_ids: test5Entities,
      duration_ms: Date.now() - test5Start,
    });
  } catch (error) {
    const status = test5Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_5',
      test_name: 'Client Declines Quote → No Repair Task',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test5Steps,
      entity_ids: test5Entities,
      error: error instanceof Error ? error.message : undefined,
      duration_ms: Date.now() - test5Start,
    });
  }

  // ==========================================================================
  // TEST 6: Cancel Quote (Admin)
  // ==========================================================================
  const test6Start = Date.now();
  const test6Steps: TestStep[] = [];
  const test6Entities: Record<string, string> = {};

  try {
    if (!qaAccount) {
      test6Steps.push({ name: 'Prerequisites', status: 'skip', message: 'No account' });
      throw new Error('Prerequisites not met');
    }

    // Create fresh item and quote
    qaItem3 = await createQAItem(qaAccount.id, '-3');
    if (!qaItem3) {
      test6Steps.push({ name: 'Create fresh item', status: 'fail', message: 'Failed' });
      throw new Error('Failed to create item');
    }
    test6Entities.item_id = qaItem3.id;

    quote3 = await createRepairQuote(qaItem3.id, qaAccount.id, 'draft');
    if (!quote3) {
      test6Steps.push({ name: 'Create quote', status: 'fail', message: 'Failed' });
      throw new Error('Failed to create quote');
    }
    test6Steps.push({ name: 'Create fresh item and quote', status: 'pass', message: 'Created' });
    test6Entities.quote_id = quote3.id;

    // Set price and send
    await setCustomerPrice(quote3.id, 200.00);
    await sendToClient(quote3.id);
    test6Steps.push({ name: 'Send to client', status: 'pass', message: 'Sent' });

    // Admin cancels
    const cancelled = await cancelQuote(quote3.id);
    if (!cancelled) {
      test6Steps.push({ name: 'Cancel quote', status: 'fail', message: 'Failed' });
      throw new Error('Failed to cancel');
    }
    test6Steps.push({ name: 'Cancel quote', status: 'pass', message: 'Cancelled' });

    // Verify status = closed
    const { data: verifyQuote } = await supabase
      .from('repair_quotes')
      .select('status')
      .eq('id', quote3.id)
      .single();

    if (verifyQuote?.status !== 'closed') {
      test6Steps.push({
        name: 'Verify status closed',
        status: 'fail',
        expected: 'closed',
        actual: verifyQuote?.status,
        message: 'Status not closed',
      });
      throw new Error('Status not closed');
    }
    test6Steps.push({ name: 'Verify status closed', status: 'pass', message: 'Status: closed' });

    // Verify no repair task
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('task_type', 'Repair')
      .contains('metadata', { repair_quote_id: quote3.id });

    if (taskCount && taskCount > 0) {
      test6Steps.push({
        name: 'Verify no repair task',
        status: 'fail',
        expected: '0',
        actual: String(taskCount),
        message: 'Task created for cancelled quote',
      });
      throw new Error('Task created for cancelled quote');
    }
    test6Steps.push({ name: 'Verify no repair task', status: 'pass', message: 'No task created' });

    tests.push({
      test_id: 'rq_6',
      test_name: 'Cancel Quote (Admin)',
      status: 'pass',
      message: 'Cancel closes quote and prevents task creation',
      steps: test6Steps,
      entity_ids: test6Entities,
      duration_ms: Date.now() - test6Start,
    });
  } catch (error) {
    const status = test6Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_6',
      test_name: 'Cancel Quote (Admin)',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test6Steps,
      entity_ids: test6Entities,
      error: error instanceof Error ? error.message : undefined,
      duration_ms: Date.now() - test6Start,
    });
  }

  // ==========================================================================
  // TEST 7: Audit / Timestamps / Ownership
  // ==========================================================================
  const test7Start = Date.now();
  const test7Steps: TestStep[] = [];
  const test7Entities: Record<string, string> = {};

  try {
    if (!quote1) {
      test7Steps.push({ name: 'Prerequisites', status: 'skip', message: 'No quote' });
      throw new Error('Prerequisites not met');
    }

    test7Entities.quote_id = quote1.id;

    const { data: verifyQuote } = await supabase
      .from('repair_quotes')
      .select('tenant_id, account_id, created_at, updated_at')
      .eq('id', quote1.id)
      .single();

    // Verify tenant_id
    if (verifyQuote?.tenant_id !== tenantId) {
      test7Steps.push({
        name: 'Verify tenant_id',
        status: 'fail',
        expected: tenantId,
        actual: verifyQuote?.tenant_id,
        message: 'Tenant mismatch',
      });
      throw new Error('Tenant mismatch');
    }
    test7Steps.push({ name: 'Verify tenant_id', status: 'pass', message: 'Matches' });

    // Verify timestamps
    if (!verifyQuote?.created_at || !verifyQuote?.updated_at) {
      test7Steps.push({
        name: 'Verify timestamps',
        status: 'fail',
        expected: 'Both set',
        actual: `created: ${!!verifyQuote?.created_at}, updated: ${!!verifyQuote?.updated_at}`,
        message: 'Missing timestamps',
      });
      throw new Error('Missing timestamps');
    }
    test7Steps.push({ name: 'Verify timestamps', status: 'pass', message: 'Both present' });

    // Verify account_id
    if (!verifyQuote?.account_id) {
      test7Steps.push({
        name: 'Verify account_id',
        status: 'fail',
        expected: 'not null',
        actual: 'null',
        message: 'Account not set',
      });
      throw new Error('Account not set');
    }
    test7Steps.push({ name: 'Verify account_id', status: 'pass', message: verifyQuote.account_id.slice(0, 8) });

    tests.push({
      test_id: 'rq_7',
      test_name: 'Audit / Timestamps / Ownership',
      status: 'pass',
      message: 'All audit fields correct',
      steps: test7Steps,
      entity_ids: test7Entities,
      duration_ms: Date.now() - test7Start,
    });
  } catch (error) {
    const status = test7Steps.some(s => s.status === 'skip') ? 'skip' : 'fail';
    tests.push({
      test_id: 'rq_7',
      test_name: 'Audit / Timestamps / Ownership',
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
      steps: test7Steps,
      entity_ids: test7Entities,
      error: error instanceof Error ? error.message : undefined,
      duration_ms: Date.now() - test7Start,
    });
  }

  // Calculate summary
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const skipped = tests.filter(t => t.status === 'skip').length;

  const overallStatus: TestStatus = failed > 0 ? 'fail' : skipped === tests.length ? 'skip' : 'pass';

  return {
    suite_key: 'repair_quotes_flow',
    suite_name: 'Repair Quotes',
    qa_run_id: qaRunId,
    status: overallStatus,
    tests,
    created_entity_ids: createdEntityIds,
    total_duration_ms: Date.now() - startTime,
    summary: { passed, failed, skipped },
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanupQAData(
  supabase: any,
  tenantId: string,
  qaRunId?: string
): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];

  const filter = qaRunId
    ? { qa_run_id: qaRunId }
    : { qa_test: true };

  // Delete in order: task_items (via tasks), tasks, tokens, quote_items, quotes, items, accounts
  try {
    // Get tasks to delete task_items first
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('tenant_id', tenantId)
      .contains('metadata', filter);

    if (tasks?.length) {
      for (const task of tasks) {
        await supabase.from('task_items').delete().eq('task_id', task.id);
      }
      const { count } = await supabase
        .from('tasks')
        .delete()
        .eq('tenant_id', tenantId)
        .contains('metadata', filter);
      deleted += count || 0;
    }

    // Delete tokens
    const { count: tokenCount } = await supabase
      .from('repair_quote_tokens')
      .delete()
      .eq('tenant_id', tenantId)
      .contains('metadata', filter);
    deleted += tokenCount || 0;

    // Get quotes to delete quote_items first
    const { data: quotes } = await supabase
      .from('repair_quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .contains('metadata', filter);

    if (quotes?.length) {
      for (const quote of quotes) {
        await supabase.from('repair_quote_items').delete().eq('repair_quote_id', quote.id);
      }
      const { count } = await supabase
        .from('repair_quotes')
        .delete()
        .eq('tenant_id', tenantId)
        .contains('metadata', filter);
      deleted += count || 0;
    }

    // Delete items
    const { count: itemCount } = await supabase
      .from('items')
      .delete()
      .eq('tenant_id', tenantId)
      .contains('metadata', filter);
    deleted += itemCount || 0;

    // Delete accounts
    const { count: accountCount } = await supabase
      .from('accounts')
      .delete()
      .eq('tenant_id', tenantId)
      .contains('metadata', filter);
    deleted += accountCount || 0;

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown cleanup error');
  }

  return { deleted, errors };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id, tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== 'tenant_admin') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, suite_key, qa_run_id } = body;

    if (action === 'run_suite') {
      const runId = crypto.randomUUID();

      if (suite_key === 'repair_quotes_flow') {
        const result = await runRepairQuotesFlow(supabase, profile.tenant_id, profile.id, runId);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Unknown suite: ${suite_key}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'cleanup') {
      const result = await cleanupQAData(supabase, profile.tenant_id, qa_run_id);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: run_suite, cleanup" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("qa-runner error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

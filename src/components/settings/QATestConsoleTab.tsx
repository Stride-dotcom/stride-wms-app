import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip' | 'error';

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

interface TestSuiteDefinition {
  key: string;
  name: string;
  description: string;
  tests: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

// ============================================================================
// TEST SUITES DEFINITION
// ============================================================================

const TEST_SUITES: TestSuiteDefinition[] = [
  {
    key: 'repair_quotes_flow',
    name: 'Repair Quotes',
    description: 'Test the full repair quote lifecycle including creation, pricing, client acceptance/decline, and task creation.',
    tests: [
      { id: 'rq_1', name: 'Create Quote Request (Single Item)', description: 'Verify a repair quote can be created for exactly one item' },
      { id: 'rq_2', name: 'Duplicate Protection', description: 'Ensure duplicate open quotes for same item are prevented' },
      { id: 'rq_3', name: 'Admin Pricing Required Before Send', description: 'Verify price must be set before sending to client' },
      { id: 'rq_4', name: 'Client Accepts Quote → Creates Repair Task', description: 'Prove acceptance creates exactly one repair task for the item' },
      { id: 'rq_5', name: 'Client Declines Quote → No Repair Task', description: 'Decline should not create any repair task' },
      { id: 'rq_6', name: 'Cancel Quote (Admin)', description: 'Cancel blocks acceptance and prevents task creation' },
      { id: 'rq_7', name: 'Audit / Timestamps / Ownership', description: 'Verify tenant_id, timestamps, and account ownership' },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function QATestConsoleTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('run');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const [isRunning, setIsRunning] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [suiteResult, setSuiteResult] = useState<SuiteResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runSuite = async (suiteKey: string) => {
    setIsRunning(true);
    setCurrentSuite(suiteKey);
    setSuiteResult(null);
    setLogs([]);

    log(`Starting suite: ${suiteKey}`);

    try {
      const { data, error } = await supabase.functions.invoke('qa-runner', {
        body: {
          action: 'run_suite',
          suite_key: suiteKey,
        },
      });

      if (error) {
        log(`Error: ${error.message}`);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      const result = data as SuiteResult;
      setSuiteResult(result);

      log(`Suite completed: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`);
      log(`Duration: ${result.total_duration_ms}ms`);

      toast({
        title: 'Suite Completed',
        description: `${result.summary.passed} passed, ${result.summary.failed} failed`,
        variant: result.summary.failed > 0 ? 'destructive' : 'default',
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log(`Error: ${message}`);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsRunning(false);
      setCurrentSuite(null);
    }
  };

  const cleanup = async () => {
    if (!suiteResult) return;

    log('Starting cleanup...');

    try {
      const { data, error } = await supabase.functions.invoke('qa-runner', {
        body: {
          action: 'cleanup',
          qa_run_id: suiteResult.qa_run_id,
        },
      });

      if (error) {
        log(`Cleanup error: ${error.message}`);
        toast({ title: 'Cleanup Error', description: error.message, variant: 'destructive' });
        return;
      }

      log(`Cleanup completed: ${data.deleted} entities deleted`);
      toast({ title: 'Cleanup Complete', description: `Deleted ${data.deleted} QA entities` });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log(`Cleanup error: ${message}`);
      toast({ title: 'Cleanup Error', description: message, variant: 'destructive' });
    }
  };

  const generateFixPrompt = (result: TestResult): string => {
    const failingSteps = result.steps.filter(s => s.status === 'fail');

    return `## QA Test Failure

**Suite:** Repair Quotes
**Test:** ${result.test_name}
**Test ID:** ${result.test_id}

### Failing Step(s):
${failingSteps.map(s => `- **${s.name}**
  - Expected: ${s.expected || 'N/A'}
  - Actual: ${s.actual || 'N/A'}
  - Message: ${s.message}`).join('\n')}

### Error:
${result.error || 'No error message'}

### Error Stack:
\`\`\`
${result.error_stack || 'No stack trace'}
\`\`\`

### Entity IDs Involved:
${Object.entries(result.entity_ids).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'None'}

### Suspected Files:
- src/hooks/useRepairQuotes.ts
- supabase/functions/qa-runner/index.ts

### Expected Behavior:
${result.test_name} should pass with all steps completing successfully.

Please investigate and fix the issue.`;
  };

  const copyFixPrompt = (result: TestResult) => {
    const prompt = generateFixPrompt(result);
    navigator.clipboard.writeText(prompt);
    toast({ title: 'Copied', description: 'Fix prompt copied to clipboard' });
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const statusColors: Record<TestStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800',
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    skip: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-200 text-red-900',
  };

  const statusIcons: Record<TestStatus, string> = {
    pending: 'hourglass_empty',
    running: 'progress_activity',
    pass: 'check_circle',
    fail: 'cancel',
    skip: 'skip_next',
    error: 'error',
  };

  const failedTests = suiteResult?.tests.filter(t => t.status === 'fail' || t.status === 'error') || [];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <MaterialIcon name="science" size="md" />
            QA Test Console
          </h3>
          <p className="text-sm text-muted-foreground">
            Run automated tests to validate system behavior
          </p>
        </div>
        <div className="flex gap-2">
          {suiteResult && (
            <Button variant="outline" onClick={cleanup}>
              <MaterialIcon name="delete_sweep" size="sm" className="mr-2" />
              Cleanup QA Data
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="run" className="flex items-center gap-2">
            <MaterialIcon name="play_arrow" size="sm" />
            Run Tests
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <MaterialIcon name="assignment" size="sm" />
            Error Results
            {failedTests.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {failedTests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Run Tests Tab */}
        <TabsContent value="run" className="space-y-4 mt-4">
          {/* Test Suites */}
          {TEST_SUITES.map(suite => (
            <Card key={suite.key}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{suite.name}</CardTitle>
                    <CardDescription>{suite.description}</CardDescription>
                  </div>
                  <Button
                    onClick={() => runSuite(suite.key)}
                    disabled={isRunning}
                  >
                    {isRunning && currentSuite === suite.key ? (
                      <>
                        <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                        Run {suite.name} Suite
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {suite.tests.map(test => {
                    const result = suiteResult?.tests.find(r => r.test_id === test.id);
                    const status: TestStatus = isRunning && currentSuite === suite.key
                      ? 'running'
                      : result?.status || 'pending';

                    return (
                      <div
                        key={test.id}
                        className="flex items-center gap-2 p-2 rounded border bg-muted/30"
                      >
                        <MaterialIcon
                          name={statusIcons[status]}
                          size="sm"
                          className={status === 'running' ? 'animate-spin' : ''}
                        />
                        <span className="text-sm truncate" title={test.description}>
                          {test.name}
                        </span>
                        {result && (
                          <Badge className={`ml-auto shrink-0 ${statusColors[result.status]}`}>
                            {result.status.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Progress & Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MaterialIcon name="terminal" size="sm" />
                  Run Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-48 border rounded bg-slate-950 p-2">
                  <div className="font-mono text-xs text-slate-300 space-y-1">
                    {logs.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap">{line}</div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {suiteResult && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-6 text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Pass: {suiteResult.summary.passed}
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Fail: {suiteResult.summary.failed}
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    Skip: {suiteResult.summary.skipped}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    Duration: {suiteResult.total_duration_ms}ms
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Run ID: {suiteResult.qa_run_id}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Error Results Tab */}
        <TabsContent value="results" className="space-y-4 mt-4">
          {failedTests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MaterialIcon name="check_circle" className="mx-auto mb-4 text-green-500" style={{ fontSize: '48px' }} />
                <p>No errors to display</p>
                <p className="text-xs mt-1">Run tests to see results here</p>
              </CardContent>
            </Card>
          ) : (
            failedTests.map(result => (
              <Card key={result.test_id}>
                <Collapsible
                  open={expandedResults.has(result.test_id)}
                  onOpenChange={() => {
                    setExpandedResults(prev => {
                      const next = new Set(prev);
                      if (next.has(result.test_id)) next.delete(result.test_id);
                      else next.add(result.test_id);
                      return next;
                    });
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MaterialIcon name={statusIcons[result.status]} size="sm" className="text-red-500" />
                          <div>
                            <CardTitle className="text-sm">{result.test_name}</CardTitle>
                            <CardDescription className="text-xs">Repair Quotes Suite</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[result.status]}>
                            {result.status.toUpperCase()}
                          </Badge>
                          <MaterialIcon name="expand_more" size="sm" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      <Separator />

                      {/* Error Message */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Error</h4>
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                          {result.error || result.message}
                        </div>
                      </div>

                      {/* Steps */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Steps</h4>
                        <div className="space-y-2">
                          {result.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <MaterialIcon
                                name={statusIcons[step.status]}
                                size="sm"
                                className={step.status === 'pass' ? 'text-green-500' : step.status === 'fail' ? 'text-red-500' : 'text-gray-400'}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{step.name}</div>
                                <div className="text-muted-foreground">{step.message}</div>
                                {step.expected && (
                                  <div className="text-xs mt-1">
                                    <span className="text-green-600">Expected:</span> {step.expected}
                                    {step.actual && (
                                      <>
                                        <span className="ml-2 text-red-600">Actual:</span> {step.actual}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Entity IDs */}
                      {Object.keys(result.entity_ids).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Entity IDs</h4>
                          <div className="text-xs font-mono bg-muted p-2 rounded">
                            {Object.entries(result.entity_ids).map(([k, v]) => (
                              <div key={k}>{k}: {v}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyFixPrompt(result)}>
                          <MaterialIcon name="content_copy" size="sm" className="mr-2" />
                          Copy Fix Prompt
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

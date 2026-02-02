import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useQATests, TEST_SUITES, QATestRun, QATestResult } from '@/hooks/useQATests';
import { useWarehouses } from '@/hooks/useWarehouses';
import { cn } from '@/lib/utils';

// =============================================================================
// Status Badge Component
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    running: { variant: 'default', label: 'Running' },
    completed: { variant: 'secondary', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
    cancelled: { variant: 'outline', label: 'Cancelled' },
    pass: { variant: 'secondary', label: 'Pass' },
    fail: { variant: 'destructive', label: 'Fail' },
    skip: { variant: 'outline', label: 'Skip' },
    pending: { variant: 'outline', label: 'Pending' }
  };

  const config = variants[status] || { variant: 'outline', label: status };

  return (
    <Badge variant={config.variant} className={cn(
      status === 'pass' && 'bg-green-100 text-green-800 hover:bg-green-100',
      status === 'completed' && 'bg-green-100 text-green-800 hover:bg-green-100'
    )}>
      {config.label}
    </Badge>
  );
}

// =============================================================================
// Run Tests Tab
// =============================================================================

function RunTestsTab() {
  const { runTests, runningTests, fetchRuns } = useQATests();
  const { warehouses } = useWarehouses();
  const [selectedSuites, setSelectedSuites] = useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [mode, setMode] = useState<'create_cleanup' | 'create_only'>('create_cleanup');
  const [runLog, setRunLog] = useState<string[]>([]);

  const handleToggleSuite = (suiteId: string) => {
    setSelectedSuites(prev =>
      prev.includes(suiteId)
        ? prev.filter(s => s !== suiteId)
        : [...prev, suiteId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSuites.length === TEST_SUITES.length) {
      setSelectedSuites([]);
    } else {
      setSelectedSuites(TEST_SUITES.map(s => s.id));
    }
  };

  const handleRunTests = async (suites?: string[]) => {
    setRunLog([`[${new Date().toISOString()}] Starting test run...`]);

    const suitesToRun = suites || selectedSuites;
    if (suitesToRun.length === 0) {
      setRunLog(prev => [...prev, `[${new Date().toISOString()}] Running all test suites`]);
    } else {
      setRunLog(prev => [...prev, `[${new Date().toISOString()}] Running suites: ${suitesToRun.join(', ')}`]);
    }

    const result = await runTests({
      suites: suitesToRun,
      warehouse_id: selectedWarehouse || undefined,
      mode
    });

    if (result) {
      setRunLog(prev => [
        ...prev,
        `[${new Date().toISOString()}] Tests completed`,
        `  Pass: ${result.summary.pass}`,
        `  Fail: ${result.summary.fail}`,
        `  Skip: ${result.summary.skip}`,
        `  Run ID: ${result.run_id}`
      ]);
    } else {
      setRunLog(prev => [...prev, `[${new Date().toISOString()}] Test run failed`]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Options Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="settings" size="md" />
            Test Options
          </CardTitle>
          <CardDescription>
            Configure test execution settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Target Warehouse</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="All warehouses (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All warehouses</SelectItem>
                  {warehouses.map(wh => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>QA Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'create_cleanup' | 'create_only')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_cleanup">Create + Cleanup (default)</SelectItem>
                  <SelectItem value="create_only">Create only (keep test data)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {mode === 'create_cleanup'
                  ? 'Test data will be automatically cleaned up after tests complete'
                  : 'Test data will be preserved for inspection'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Suites Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MaterialIcon name="science" size="md" />
                Test Suites
              </CardTitle>
              <CardDescription>
                Select test suites to run
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedSuites.length === TEST_SUITES.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                onClick={() => handleRunTests()}
                disabled={runningTests}
              >
                {runningTests ? (
                  <>
                    <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                    Run All Tests
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {TEST_SUITES.map(suite => (
              <div
                key={suite.id}
                className={cn(
                  "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                  selectedSuites.includes(suite.id)
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleToggleSuite(suite.id)}
              >
                <Checkbox
                  checked={selectedSuites.includes(suite.id)}
                  onCheckedChange={() => handleToggleSuite(suite.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name={suite.icon} size="sm" className="text-muted-foreground" />
                    <span className="font-medium">{suite.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {suite.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunTests([suite.id]);
                  }}
                  disabled={runningTests}
                >
                  <MaterialIcon name="play_arrow" size="sm" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run Log Card */}
      {runLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="terminal" size="md" />
              Run Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-4">
              <pre className="text-sm font-mono">
                {runLog.join('\n')}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// Error Results Tab
// =============================================================================

function ErrorResultsTab() {
  const {
    runs,
    currentRun,
    currentResults,
    loading,
    fetchRuns,
    fetchRunResults,
    cleanupRun,
    generateFixPrompt,
    clearCurrentRun
  } = useQATests();
  const [selectedResult, setSelectedResult] = useState<QATestResult | null>(null);
  const [fixPromptDialogOpen, setFixPromptDialogOpen] = useState(false);
  const [fixPrompt, setFixPrompt] = useState('');

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleViewRun = (run: QATestRun) => {
    fetchRunResults(run.id);
  };

  const handleCopyFixPrompt = (result: QATestResult) => {
    const prompt = generateFixPrompt(result);
    setFixPrompt(prompt);
    setFixPromptDialogOpen(true);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fixPrompt);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = fixPrompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Group results by suite
  const resultsBySuite = currentResults.reduce((acc, result) => {
    if (!acc[result.suite]) acc[result.suite] = [];
    acc[result.suite].push(result);
    return acc;
  }, {} as Record<string, QATestResult[]>);

  if (currentRun) {
    return (
      <div className="space-y-6">
        {/* Back button and run header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={clearCurrentRun}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
            Back to Runs
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Run Details
                  <StatusBadge status={currentRun.status} />
                </CardTitle>
                <CardDescription>
                  Started {new Date(currentRun.started_at).toLocaleString()}
                  {currentRun.executed_by_user && (
                    <> by {currentRun.executed_by_user.first_name} {currentRun.executed_by_user.last_name}</>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{currentRun.pass_count}</div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{currentRun.fail_count}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{currentRun.skip_count}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Mode:</span>{' '}
                <span className="font-medium">{currentRun.mode === 'create_cleanup' ? 'Create + Cleanup' : 'Create Only'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Warehouse:</span>{' '}
                <span className="font-medium">{currentRun.warehouse?.name || 'All'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>{' '}
                <span className="font-medium">
                  {currentRun.finished_at
                    ? `${Math.round((new Date(currentRun.finished_at).getTime() - new Date(currentRun.started_at).getTime()) / 1000)}s`
                    : 'In progress'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results by suite */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {Object.entries(resultsBySuite).map(([suite, results]) => {
                const passCount = results.filter(r => r.status === 'pass').length;
                const failCount = results.filter(r => r.status === 'fail').length;
                const skipCount = results.filter(r => r.status === 'skip').length;
                const suiteInfo = TEST_SUITES.find(s => s.id === suite);

                return (
                  <AccordionItem key={suite} value={suite}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <MaterialIcon name={suiteInfo?.icon || 'folder'} size="sm" className="text-muted-foreground" />
                        <span className="font-medium">{suiteInfo?.name || suite}</span>
                        <div className="flex items-center gap-2 ml-auto mr-4">
                          {passCount > 0 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {passCount} pass
                            </Badge>
                          )}
                          {failCount > 0 && (
                            <Badge variant="destructive">
                              {failCount} fail
                            </Badge>
                          )}
                          {skipCount > 0 && (
                            <Badge variant="outline">
                              {skipCount} skip
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-8">
                        {results.map(result => (
                          <div
                            key={result.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              result.status === 'fail' && "border-red-200 bg-red-50",
                              result.status === 'pass' && "border-green-200 bg-green-50",
                              result.status === 'skip' && "border-gray-200 bg-gray-50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <StatusBadge status={result.status} />
                              <span className="font-medium">{result.test_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.error_message && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedResult(result)}
                                >
                                  <MaterialIcon name="info" size="sm" className="mr-1" />
                                  Details
                                </Button>
                              )}
                              {result.status === 'fail' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyFixPrompt(result)}
                                >
                                  <MaterialIcon name="content_copy" size="sm" className="mr-1" />
                                  Copy Fix Prompt
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Result details dialog */}
        <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedResult?.test_name}</DialogTitle>
              <DialogDescription>
                Suite: {selectedResult?.suite}
              </DialogDescription>
            </DialogHeader>
            {selectedResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedResult.status} />
                  {selectedResult.started_at && selectedResult.finished_at && (
                    <span className="text-sm text-muted-foreground">
                      Duration: {Math.round((new Date(selectedResult.finished_at).getTime() - new Date(selectedResult.started_at).getTime()) / 1000)}s
                    </span>
                  )}
                </div>

                {selectedResult.error_message && (
                  <div>
                    <Label className="text-muted-foreground">Error Message</Label>
                    <pre className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm overflow-x-auto">
                      {selectedResult.error_message}
                    </pre>
                  </div>
                )}

                {selectedResult.error_stack && (
                  <div>
                    <Label className="text-muted-foreground">Stack Trace</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48">
                      {selectedResult.error_stack}
                    </pre>
                  </div>
                )}

                {selectedResult.details && Object.keys(selectedResult.details).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Details</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(selectedResult.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedResult.entity_ids && Object.keys(selectedResult.entity_ids).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Entity IDs</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(selectedResult.entity_ids, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedResult.status === 'fail' && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedResult(null);
                      handleCopyFixPrompt(selectedResult);
                    }}
                  >
                    <MaterialIcon name="content_copy" size="sm" className="mr-2" />
                    Copy Fix Prompt
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fix prompt dialog */}
        <Dialog open={fixPromptDialogOpen} onOpenChange={setFixPromptDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Fix Prompt</DialogTitle>
              <DialogDescription>
                Copy this prompt and paste it to Claude/Lovable to help fix the issue
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap">{fixPrompt}</pre>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFixPromptDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={handleCopyToClipboard}>
                <MaterialIcon name="content_copy" size="sm" className="mr-2" />
                Copy to Clipboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="history" size="md" />
              Test Run History
            </CardTitle>
            <CardDescription>
              View results from previous test runs
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchRuns()} disabled={loading}>
            <MaterialIcon name="refresh" size="sm" className={cn("mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && runs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MaterialIcon name="science" size="lg" className="mx-auto mb-2 opacity-50" />
            <p>No test runs yet</p>
            <p className="text-sm">Run some tests to see results here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Executed By</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(run => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {new Date(run.started_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(run.started_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">{run.pass_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 font-medium">{run.fail_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-gray-600">{run.skip_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.executed_by_user
                      ? `${run.executed_by_user.first_name || ''} ${run.executed_by_user.last_name || ''}`.trim() || run.executed_by_user.email
                      : 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {run.mode === 'create_cleanup' ? 'Cleanup' : 'Keep'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewRun(run)}
                      >
                        <MaterialIcon name="visibility" size="sm" className="mr-1" />
                        View
                      </Button>
                      {run.mode === 'create_only' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cleanupRun(run.id)}
                        >
                          <MaterialIcon name="delete_sweep" size="sm" className="mr-1" />
                          Cleanup
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// UI Visual QA Results Tab
// =============================================================================

interface UIVisualResult {
  id: string;
  test_name: string;
  route: string;
  viewport: string;
  status: 'pass' | 'fail' | 'skip';
  error_message?: string;
  details?: {
    overflow: boolean;
    consoleErrors: string[];
    exceptions: string[];
    networkFailures: string[];
    axeViolations: { id: string; impact: string; description: string; nodes: number }[];
    artifacts: string[];
    tourSteps: { step: string; action: string; status: string; error?: string; screenshot?: string }[];
    fileHints: string[];
  };
}

interface TourCoverageData {
  totalRoutes: number;
  routesWithTours: number;
  routesWithoutTours: string[];
  missingTestIds: { selector: string; route: string; count: number }[];
  skippedSteps: { route: string; step: string; reason: string }[];
  coveragePercent: number;
}

function UIVisualResultsTab() {
  const { runs, fetchRuns, fetchRunResults, currentRun, currentResults, loading, clearCurrentRun } = useQATests();
  const [selectedViewport, setSelectedViewport] = useState<string>('all');
  const [showCoverage, setShowCoverage] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Filter for UI visual QA runs
  const visualRuns = runs.filter(run =>
    run.suites_requested?.includes('ui_visual_qa') ||
    run.metadata?.viewports
  );

  // Filter current results for UI visual QA
  const visualResults = currentResults.filter(r => r.suite === 'ui_visual_qa');
  const coverageResult = visualResults.find(r => r.test_name === 'tour_coverage');
  const testResults = visualResults.filter(r => r.test_name !== 'tour_coverage');

  // Group by route
  const resultsByRoute = testResults.reduce((acc, result) => {
    const route = (result.details as any)?.route || result.test_name.split(' (')[0];
    if (!acc[route]) acc[route] = [];
    acc[route].push(result);
    return acc;
  }, {} as Record<string, typeof testResults>);

  // Filter by viewport
  const filteredRoutes = selectedViewport === 'all'
    ? resultsByRoute
    : Object.fromEntries(
        Object.entries(resultsByRoute).map(([route, results]) => [
          route,
          results.filter(r => r.test_name.includes(`(${selectedViewport})`))
        ]).filter(([_, results]) => results.length > 0)
      );

  const coverageData = coverageResult?.details as TourCoverageData | undefined;

  if (currentRun && visualResults.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={clearCurrentRun}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
            Back to Runs
          </Button>
        </div>

        {/* Run Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  UI Visual QA Results
                  <StatusBadge status={currentRun.status} />
                </CardTitle>
                <CardDescription>
                  Run ID: {currentRun.id.slice(0, 8)}... | {new Date(currentRun.started_at).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {testResults.filter(r => r.status === 'pass').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {testResults.filter(r => r.status === 'fail').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {testResults.filter(r => r.status === 'skip').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tour Coverage Card */}
        {coverageData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="coverage" size="md" />
                  Tour Coverage Report
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowCoverage(!showCoverage)}>
                  {showCoverage ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary">{coverageData.coveragePercent}%</div>
                  <div className="text-sm text-muted-foreground">Coverage</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">{coverageData.routesWithTours}</div>
                  <div className="text-sm text-muted-foreground">Routes with Tours</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">{coverageData.totalRoutes}</div>
                  <div className="text-sm text-muted-foreground">Total Routes</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-amber-600">{coverageData.missingTestIds?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Missing TestIDs</div>
                </div>
              </div>

              {showCoverage && (
                <div className="space-y-4 mt-4">
                  {coverageData.routesWithoutTours?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Routes Without Tours</Label>
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex flex-wrap gap-2">
                          {coverageData.routesWithoutTours.slice(0, 20).map(route => (
                            <Badge key={route} variant="outline">{route}</Badge>
                          ))}
                          {coverageData.routesWithoutTours.length > 20 && (
                            <Badge variant="secondary">+{coverageData.routesWithoutTours.length - 20} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {coverageData.missingTestIds?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Missing TestIDs (Top 20)</Label>
                      <div className="mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Selector</TableHead>
                              <TableHead>Route</TableHead>
                              <TableHead>Occurrences</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {coverageData.missingTestIds.slice(0, 20).map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-sm">{item.selector}</TableCell>
                                <TableCell>{item.route}</TableCell>
                                <TableCell>{item.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Viewport Filter */}
        <div className="flex items-center gap-4">
          <Label>Filter by Viewport:</Label>
          <Select value={selectedViewport} onValueChange={setSelectedViewport}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Viewports</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="tablet">Tablet</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results by Route */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results by Route</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(filteredRoutes).map(([route, results]) => {
                const passCount = results.filter(r => r.status === 'pass').length;
                const failCount = results.filter(r => r.status === 'fail').length;
                const hasFailures = failCount > 0;

                return (
                  <AccordionItem key={route} value={route}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <MaterialIcon
                          name={hasFailures ? 'error' : 'check_circle'}
                          size="sm"
                          className={hasFailures ? 'text-red-500' : 'text-green-500'}
                        />
                        <span className="font-mono text-sm">{route}</span>
                        <div className="flex items-center gap-2 ml-auto mr-4">
                          {passCount > 0 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {passCount} pass
                            </Badge>
                          )}
                          {failCount > 0 && (
                            <Badge variant="destructive">{failCount} fail</Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-8">
                        {results.map(result => {
                          const details = result.details as UIVisualResult['details'];
                          return (
                            <div
                              key={result.id}
                              className={cn(
                                "p-4 rounded-lg border",
                                result.status === 'fail' && "border-red-200 bg-red-50",
                                result.status === 'pass' && "border-green-200 bg-green-50"
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={result.status} />
                                  <span className="font-medium">{result.test_name}</span>
                                </div>
                              </div>

                              {result.error_message && (
                                <div className="text-sm text-red-600 mb-2">
                                  {result.error_message}
                                </div>
                              )}

                              {details && (
                                <div className="grid gap-2 text-sm">
                                  {details.overflow && (
                                    <div className="flex items-center gap-2 text-red-600">
                                      <MaterialIcon name="warning" size="sm" />
                                      Horizontal overflow detected
                                    </div>
                                  )}
                                  {details.consoleErrors?.length > 0 && (
                                    <div className="flex items-center gap-2 text-red-600">
                                      <MaterialIcon name="error" size="sm" />
                                      {details.consoleErrors.length} console error(s)
                                    </div>
                                  )}
                                  {details.axeViolations?.length > 0 && (
                                    <div className="flex items-center gap-2 text-amber-600">
                                      <MaterialIcon name="accessibility" size="sm" />
                                      {details.axeViolations.length} accessibility violation(s)
                                    </div>
                                  )}
                                  {details.artifacts?.length > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <MaterialIcon name="image" size="sm" />
                                      {details.artifacts.length} screenshot(s)
                                    </div>
                                  )}
                                  {details.fileHints?.length > 0 && (
                                    <div className="mt-2">
                                      <span className="text-muted-foreground">Files to check: </span>
                                      <span className="font-mono text-xs">{details.fileHints.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    );
  }

  // List of UI Visual QA runs
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="screenshot_monitor" size="md" />
              UI Visual QA Runs
            </CardTitle>
            <CardDescription>
              View visual regression test results and screenshots
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchRuns()} disabled={loading}>
            <MaterialIcon name="refresh" size="sm" className={cn("mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && visualRuns.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        ) : visualRuns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MaterialIcon name="screenshot_monitor" size="lg" className="mx-auto mb-2 opacity-50" />
            <p>No UI Visual QA runs yet</p>
            <p className="text-sm">Run the UI Visual QA workflow from GitHub Actions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Viewports</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visualRuns.map(run => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {new Date(run.started_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(run.started_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(run.metadata?.viewports || ['desktop', 'tablet', 'mobile']).map((vp: string) => (
                        <Badge key={vp} variant="outline" className="text-xs">
                          {vp}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">{run.pass_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 font-medium">{run.fail_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-gray-600">{run.skip_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchRunResults(run.id)}
                    >
                      <MaterialIcon name="visibility" size="sm" className="mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function QATestConsoleTab() {
  const [activeTab, setActiveTab] = useState('run');

  return (
    <div className="space-y-6" data-testid="settings-qa-console">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <MaterialIcon name="bug_report" size="md" />
          QA Test Console
        </h3>
        <p className="text-sm text-muted-foreground">
          Run automated end-to-end system tests and view results
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="qa-console-tabs">
        <TabsList>
          <TabsTrigger value="run" className="flex items-center gap-2" data-testid="qa-tab-run">
            <MaterialIcon name="play_circle" size="sm" />
            Run Tests
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" data-testid="qa-tab-results">
            <MaterialIcon name="checklist" size="sm" />
            Error Results
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-2" data-testid="qa-tab-visual">
            <MaterialIcon name="screenshot_monitor" size="sm" />
            UI Visual QA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="mt-6">
          <RunTestsTab />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ErrorResultsTab />
        </TabsContent>

        <TabsContent value="visual" className="mt-6">
          <UIVisualResultsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

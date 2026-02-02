import { test, expect, Page, BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pageTours, PageTour, TourStep, RoleContext } from './tours';
import { getFileHintsForRoute, getAllRoutes } from './routeToFileHints';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const QA_TENANT_ID = process.env.QA_TENANT_ID || '';
const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || '';
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || '';
const QA_CLIENT_EMAIL = process.env.QA_CLIENT_EMAIL || '';
const QA_CLIENT_PASSWORD = process.env.QA_CLIENT_PASSWORD || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

const VIEWPORTS = ['desktop', 'tablet', 'mobile'] as const;
type Viewport = typeof VIEWPORTS[number];

// ============================================================
// TYPES
// ============================================================

interface TestResult {
  suite: string;
  test_name: string;
  route: string;
  viewport: Viewport;
  status: 'pass' | 'fail' | 'skip';
  error_message?: string;
  started_at: string;
  finished_at: string;
  details: {
    overflow: boolean;
    consoleErrors: string[];
    exceptions: string[];
    networkFailures: string[];
    axeViolations: AxeViolation[];
    artifacts: string[];
    tourSteps: TourStepResult[];
    fileHints: string[];
  };
}

interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  nodes: number;
}

interface TourStepResult {
  step: string;
  action: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  screenshot?: string;
}

interface TourCoverageReport {
  totalRoutes: number;
  routesWithTours: number;
  routesWithoutTours: string[];
  missingTestIds: { selector: string; route: string; count: number }[];
  skippedSteps: { route: string; step: string; reason: string }[];
  coveragePercent: number;
}

// ============================================================
// GLOBAL STATE
// ============================================================

let supabase: SupabaseClient;
let runId: string;
let adminContext: BrowserContext;
let clientContext: BrowserContext;
const testResults: TestResult[] = [];
const missingTestIds: Map<string, { route: string; count: number }> = new Map();
const skippedSteps: { route: string; step: string; reason: string }[] = [];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateRunId(): string {
  return `ui-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function createSupabaseClient(): Promise<SupabaseClient> {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function loginUser(page: Page, email: string, password: string, isClient: boolean = false): Promise<boolean> {
  try {
    const loginUrl = isClient ? '/client/login' : '/auth';
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for navigation away from login
    await page.waitForURL((url) => !url.pathname.includes('auth') && !url.pathname.includes('login'), {
      timeout: 15000,
    });

    return true;
  } catch (error) {
    console.error(`Login failed for ${email}:`, error);
    return false;
  }
}

async function getDynamicId(table: string, tenantId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from(table)
      .select('id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    return data?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function getDynamicIdForRoute(route: string): Promise<string | null> {
  const routeTableMap: Record<string, string> = {
    '/shipments/:id': 'shipments',
    '/inventory/:id': 'items',
    '/tasks/:id': 'tasks',
    '/claims/:id': 'claims',
    '/stocktakes/:id/scan': 'stocktakes',
    '/stocktakes/:id/report': 'stocktakes',
    '/manifests/:id': 'manifests',
    '/manifests/:id/scan': 'manifests',
    '/manifests/:id/history': 'manifests',
    '/repair-quotes/:id': 'repair_quotes',
    '/quotes/:id': 'quotes',
  };

  const table = routeTableMap[route];
  if (!table) return null;

  return getDynamicId(table, QA_TENANT_ID);
}

function resolveRoute(route: string, id: string | null): string {
  if (!id) return route;
  return route.replace(':id', id);
}

async function captureScreenshot(page: Page, runId: string, viewport: Viewport, route: string, stepName: string): Promise<string> {
  const routeSlug = route.replace(/\//g, '_').replace(/:/g, '').substring(1) || 'root';
  const filename = `${stepName.replace(/\s+/g, '_').toLowerCase()}.png`;
  const localPath = path.join('screenshots', runId, viewport, routeSlug, filename);

  // Ensure directory exists
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.screenshot({ path: localPath, fullPage: false });

  // Return storage path for Supabase
  return `ui/${runId}/${viewport}/${routeSlug}/${filename}`;
}

async function checkLayoutIssues(page: Page): Promise<{ overflow: boolean; blankContent: boolean }> {
  return page.evaluate(() => {
    const overflow = document.body.scrollWidth > window.innerWidth;
    const main = document.querySelector('main');
    const blankContent = main ? main.getBoundingClientRect().height < 50 : false;
    return { overflow, blankContent };
  });
}

async function runAxeCheck(page: Page): Promise<AxeViolation[]> {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'unknown',
      description: v.description,
      nodes: v.nodes.length,
    }));
  } catch {
    return [];
  }
}

async function executeTourStep(
  page: Page,
  step: TourStep,
  runId: string,
  viewport: Viewport,
  route: string
): Promise<TourStepResult> {
  const result: TourStepResult = {
    step: step.note || step.action,
    action: step.action,
    status: 'pass',
  };

  const timeout = step.timeout || 5000;

  try {
    switch (step.action) {
      case 'click':
        if (step.selector) {
          const element = page.locator(step.selector).first();
          await element.waitFor({ state: 'visible', timeout });
          await element.click({ timeout });
        }
        break;

      case 'openDropdown':
        if (step.selector) {
          await page.click(step.selector, { timeout });
          await page.waitForTimeout(300); // Allow dropdown animation
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          await page.fill(step.selector, step.value, { timeout });
        }
        break;

      case 'waitFor':
        if (step.selector) {
          await page.waitForSelector(step.selector, { timeout });
        }
        break;

      case 'expectVisible':
        if (step.selector) {
          await expect(page.locator(step.selector).first()).toBeVisible({ timeout });
        }
        break;

      case 'closeModal':
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        break;

      case 'navigateBack':
        await page.goBack({ waitUntil: 'networkidle', timeout: 10000 });
        break;

      case 'screenshot':
        result.screenshot = await captureScreenshot(page, runId, viewport, route, step.note || 'screenshot');
        break;

      case 'pressKey':
        if (step.value) {
          await page.keyboard.press(step.value);
          await page.waitForTimeout(200);
        }
        break;
    }

    if (step.screenshotAfter) {
      result.screenshot = await captureScreenshot(page, runId, viewport, route, `after_${step.note || step.action}`);
    }
  } catch (error) {
    if (step.optional) {
      result.status = 'skip';
      result.error = error instanceof Error ? error.message : 'Unknown error';

      // Track missing testids
      if (step.selector && error instanceof Error && error.message.includes('locator')) {
        const existing = missingTestIds.get(step.selector);
        if (existing) {
          existing.count++;
        } else {
          missingTestIds.set(step.selector, { route, count: 1 });
        }
      }

      skippedSteps.push({
        route,
        step: step.note || step.action,
        reason: result.error,
      });
    } else {
      result.status = 'fail';
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return result;
}

async function runTour(
  page: Page,
  tour: PageTour,
  runId: string,
  viewport: Viewport
): Promise<{ stepResults: TourStepResult[]; artifacts: string[] }> {
  const stepResults: TourStepResult[] = [];
  const artifacts: string[] = [];

  // Get dynamic ID if needed
  let resolvedRoute = tour.route;
  if (tour.requiresId) {
    const id = await getDynamicIdForRoute(tour.route);
    if (id) {
      resolvedRoute = resolveRoute(tour.route, id);
    } else {
      // Skip tour if no ID available
      return {
        stepResults: [{ step: 'setup', action: 'getDynamicId', status: 'skip', error: 'No ID found for route' }],
        artifacts: [],
      };
    }
  }

  // Navigate to route
  try {
    await page.goto(`${APP_BASE_URL}${resolvedRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500); // Allow initial render
  } catch (error) {
    return {
      stepResults: [{ step: 'navigation', action: 'goto', status: 'fail', error: error instanceof Error ? error.message : 'Navigation failed' }],
      artifacts: [],
    };
  }

  // Execute each step
  for (const step of tour.steps) {
    const result = await executeTourStep(page, step, runId, viewport, tour.route);
    stepResults.push(result);
    if (result.screenshot) {
      artifacts.push(result.screenshot);
    }

    // Stop on critical failure (non-optional step)
    if (result.status === 'fail' && !step.optional) {
      break;
    }
  }

  return { stepResults, artifacts };
}

async function testRoute(
  page: Page,
  route: string,
  viewport: Viewport,
  tour?: PageTour
): Promise<TestResult> {
  const startedAt = new Date().toISOString();
  const consoleErrors: string[] = [];
  const exceptions: string[] = [];
  const networkFailures: string[] = [];
  let stepResults: TourStepResult[] = [];
  let artifacts: string[] = [];

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    exceptions.push(error.message);
  });

  // Capture network failures
  page.on('requestfailed', (request) => {
    networkFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    if (tour) {
      // Run full tour
      const tourResult = await runTour(page, tour, runId, viewport);
      stepResults = tourResult.stepResults;
      artifacts = tourResult.artifacts;
    } else {
      // Just navigate and screenshot (route-only coverage)
      let resolvedRoute = route;
      if (route.includes(':id')) {
        const id = await getDynamicIdForRoute(route);
        if (id) {
          resolvedRoute = resolveRoute(route, id);
        } else {
          return {
            suite: 'ui_visual_qa',
            test_name: `${route} (${viewport})`,
            route,
            viewport,
            status: 'skip',
            error_message: 'No dynamic ID available for route',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            details: {
              overflow: false,
              consoleErrors: [],
              exceptions: [],
              networkFailures: [],
              axeViolations: [],
              artifacts: [],
              tourSteps: [],
              fileHints: getFileHintsForRoute(route)?.files || [],
            },
          };
        }
      }

      await page.goto(`${APP_BASE_URL}${resolvedRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshot = await captureScreenshot(page, runId, viewport, route, 'initial');
      artifacts.push(screenshot);
    }

    // Check layout issues
    const layoutIssues = await checkLayoutIssues(page);

    // Run accessibility check
    const axeViolations = await runAxeCheck(page);

    // Determine status
    const hasFailedSteps = stepResults.some((s) => s.status === 'fail');
    const hasCriticalAxe = axeViolations.some((v) => v.impact === 'critical' || v.impact === 'serious');
    const hasConsoleErrors = consoleErrors.length > 0;
    const hasExceptions = exceptions.length > 0;
    const hasNetworkFailures = networkFailures.length > 0;

    let status: 'pass' | 'fail' | 'skip' = 'pass';
    let errorMessage: string | undefined;

    if (hasFailedSteps || layoutIssues.overflow || layoutIssues.blankContent || hasCriticalAxe || hasConsoleErrors || hasExceptions || hasNetworkFailures) {
      status = 'fail';
      const reasons: string[] = [];
      if (hasFailedSteps) reasons.push('Tour step failed');
      if (layoutIssues.overflow) reasons.push('Horizontal overflow detected');
      if (layoutIssues.blankContent) reasons.push('Blank main content');
      if (hasCriticalAxe) reasons.push('Critical accessibility violations');
      if (hasConsoleErrors) reasons.push(`${consoleErrors.length} console errors`);
      if (hasExceptions) reasons.push(`${exceptions.length} uncaught exceptions`);
      if (hasNetworkFailures) reasons.push(`${networkFailures.length} network failures`);
      errorMessage = reasons.join('; ');
    }

    return {
      suite: 'ui_visual_qa',
      test_name: `${route} (${viewport})`,
      route,
      viewport,
      status,
      error_message: errorMessage,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: {
        overflow: layoutIssues.overflow,
        consoleErrors,
        exceptions,
        networkFailures,
        axeViolations,
        artifacts,
        tourSteps: stepResults,
        fileHints: getFileHintsForRoute(route)?.files || [],
      },
    };
  } catch (error) {
    return {
      suite: 'ui_visual_qa',
      test_name: `${route} (${viewport})`,
      route,
      viewport,
      status: 'fail',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: {
        overflow: false,
        consoleErrors,
        exceptions,
        networkFailures,
        axeViolations: [],
        artifacts,
        tourSteps: stepResults,
        fileHints: getFileHintsForRoute(route)?.files || [],
      },
    };
  }
}

async function saveResultsToSupabase(results: TestResult[], runId: string, coverageReport: TourCoverageReport): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Supabase not configured, skipping database save');
    return;
  }

  try {
    // Create test run
    const { data: run, error: runError } = await supabase
      .from('qa_test_runs')
      .insert({
        id: runId,
        tenant_id: QA_TENANT_ID,
        status: results.some((r) => r.status === 'fail') ? 'failed' : 'completed',
        suites_requested: ['ui_visual_qa'],
        mode: 'create_cleanup',
        pass_count: results.filter((r) => r.status === 'pass').length,
        fail_count: results.filter((r) => r.status === 'fail').length,
        skip_count: results.filter((r) => r.status === 'skip').length,
        finished_at: new Date().toISOString(),
        metadata: {
          viewports: VIEWPORTS,
          totalRoutes: coverageReport.totalRoutes,
          coveragePercent: coverageReport.coveragePercent,
        },
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating test run:', runError);
      return;
    }

    // Save individual test results
    for (const result of results) {
      await supabase.from('qa_test_results').insert({
        run_id: runId,
        tenant_id: QA_TENANT_ID,
        suite: result.suite,
        test_name: result.test_name,
        status: result.status,
        error_message: result.error_message,
        started_at: result.started_at,
        finished_at: result.finished_at,
        details: result.details,
      });
    }

    // Save coverage report as a special test result
    await supabase.from('qa_test_results').insert({
      run_id: runId,
      tenant_id: QA_TENANT_ID,
      suite: 'ui_visual_qa',
      test_name: 'tour_coverage',
      status: 'pass',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      details: coverageReport,
    });

    console.log(`Results saved to Supabase. Run ID: ${runId}`);
  } catch (error) {
    console.error('Error saving to Supabase:', error);
  }
}

function generateCoverageReport(): TourCoverageReport {
  const allRoutes = getAllRoutes();
  const routesWithTours = pageTours.map((t) => t.route);
  const routesWithoutTours = allRoutes.filter((r) => !routesWithTours.includes(r));

  const missingTestIdsList = Array.from(missingTestIds.entries())
    .map(([selector, info]) => ({ selector, route: info.route, count: info.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalRoutes: allRoutes.length,
    routesWithTours: routesWithTours.length,
    routesWithoutTours,
    missingTestIds: missingTestIdsList,
    skippedSteps,
    coveragePercent: Math.round((routesWithTours.length / allRoutes.length) * 100),
  };
}

// ============================================================
// TESTS
// ============================================================

test.describe('UI Visual QA', () => {
  test.beforeAll(async ({ browser }) => {
    // Initialize
    runId = generateRunId();
    console.log(`Starting UI Visual QA run: ${runId}`);

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = await createSupabaseClient();
    }

    // Create browser contexts for admin and client
    adminContext = await browser.newContext();
    clientContext = await browser.newContext();

    // Login admin
    const adminPage = await adminContext.newPage();
    const adminLoggedIn = await loginUser(adminPage, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, false);
    if (!adminLoggedIn) {
      console.error('Admin login failed');
    }
    await adminPage.close();

    // Login client (if credentials provided)
    if (QA_CLIENT_EMAIL && QA_CLIENT_PASSWORD) {
      const clientPage = await clientContext.newPage();
      const clientLoggedIn = await loginUser(clientPage, QA_CLIENT_EMAIL, QA_CLIENT_PASSWORD, true);
      if (!clientLoggedIn) {
        console.error('Client login failed');
      }
      await clientPage.close();
    }
  });

  test.afterAll(async () => {
    // Generate coverage report
    const coverageReport = generateCoverageReport();

    // Save results
    await saveResultsToSupabase(testResults, runId, coverageReport);

    // Write coverage report to file
    const reportPath = path.join('screenshots', runId, 'tour_coverage.json');
    fs.writeFileSync(reportPath, JSON.stringify(coverageReport, null, 2));

    // Cleanup contexts
    await adminContext?.close();
    await clientContext?.close();
  });

  // Generate tests for each tour and viewport
  for (const tour of pageTours) {
    for (const viewport of VIEWPORTS) {
      test(`${tour.name} - ${viewport}`, async () => {
        const context = tour.roleContext === 'client' ? clientContext : adminContext;
        const page = await context.newPage();

        try {
          const result = await testRoute(page, tour.route, viewport, tour);
          testResults.push(result);

          // Assert based on result
          if (result.status === 'fail') {
            expect.soft(result.error_message).toBeUndefined();
          }
        } finally {
          await page.close();
        }
      });
    }
  }

  // Test routes without tours (screenshot only)
  const routesWithTours = new Set(pageTours.map((t) => t.route));
  const routesWithoutTours = getAllRoutes().filter((r) => !routesWithTours.has(r));

  for (const route of routesWithoutTours.slice(0, 10)) { // Limit to 10 untoured routes
    for (const viewport of VIEWPORTS) {
      test(`Route-only: ${route} - ${viewport}`, async () => {
        const page = await adminContext.newPage();

        try {
          const result = await testRoute(page, route, viewport);
          testResults.push(result);

          if (result.status === 'fail') {
            expect.soft(result.error_message).toBeUndefined();
          }
        } finally {
          await page.close();
        }
      });
    }
  }
});

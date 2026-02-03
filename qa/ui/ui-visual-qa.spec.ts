import { test, expect, Page, BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pageTours, PageTour, TourStep, RoleContext, Priority, ERROR_CODES, ErrorCode, shouldCheckScrollBuffer, shouldFailRun } from './tours';
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

// Buffer check constants
const MIN_SCROLL_BUFFER_PX = 80;
const MAX_SCROLL_BUFFER_PX = 120;
const IDEAL_SCROLL_BUFFER_PX = 100;

const VIEWPORTS = ['desktop', 'tablet', 'mobile'] as const;
type Viewport = typeof VIEWPORTS[number];

// ============================================================
// TYPES
// ============================================================

interface UIIssue {
  code: ErrorCode;
  message: string;
  selector?: string;
  measuredValue?: number;
  expectedValue?: number;
  screenshot?: string;
}

interface UISuggestion {
  type: 'contrast' | 'tap_target' | 'spacing' | 'sticky_footer' | 'layout';
  message: string;
  selector?: string;
  priority: 'low' | 'medium' | 'high';
}

interface TestResult {
  suite: string;
  test_name: string;
  route: string;
  viewport: Viewport;
  priority: Priority;
  status: 'pass' | 'fail' | 'skip';
  error_message?: string;
  started_at: string;
  finished_at: string;
  details: {
    issues: UIIssue[];
    suggestions: UISuggestion[];
    overflow: boolean;
    scrollable: boolean;
    scrollBufferPx?: number;
    primaryActionReachable?: boolean;
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
  p0Count: number;
  p1Count: number;
  p2Count: number;
}

interface ScrollCheckResult {
  scrollable: boolean;
  scrollLocked: boolean;
  bufferPx: number;
  primaryActionVisible: boolean;
  primaryActionReachable: boolean;
  lowestActionableSelector?: string;
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

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');

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

  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.screenshot({ path: localPath, fullPage: false });

  return `ui/${runId}/${viewport}/${routeSlug}/${filename}`;
}

// ============================================================
// SCROLLABILITY & BUFFER CHECKS
// ============================================================

async function checkScrollability(page: Page, primaryActionSelector?: string): Promise<ScrollCheckResult> {
  return page.evaluate(async (selector) => {
    const result: ScrollCheckResult = {
      scrollable: false,
      scrollLocked: false,
      bufferPx: 0,
      primaryActionVisible: false,
      primaryActionReachable: false,
    };

    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Check if page needs scrolling
    if (documentHeight > viewportHeight) {
      const initialScrollY = window.scrollY;

      // Try to scroll
      window.scrollTo(0, 100);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (window.scrollY !== initialScrollY) {
        result.scrollable = true;
        window.scrollTo(0, initialScrollY); // Reset
      } else {
        result.scrollLocked = true;
      }
    }

    // Find lowest actionable element
    const actionSelectors = selector
      ? selector.split(',').map(s => s.trim())
      : [
          'button[type="submit"]',
          '[data-testid*="save"]',
          '[data-testid*="submit"]',
          '[data-testid*="complete"]',
          '[data-testid*="finish"]',
          'form button:last-child',
          'input:last-of-type',
          'textarea:last-of-type',
        ];

    let lowestElement: Element | null = null;
    let lowestBottom = 0;

    for (const sel of actionSelectors) {
      try {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const absoluteBottom = rect.bottom + window.scrollY;
          if (absoluteBottom > lowestBottom) {
            lowestBottom = absoluteBottom;
            lowestElement = el;
          }
        });
      } catch {
        // Invalid selector, skip
      }
    }

    if (lowestElement) {
      result.lowestActionableSelector = lowestElement.tagName.toLowerCase() +
        (lowestElement.id ? `#${lowestElement.id}` : '') +
        (lowestElement.className ? `.${lowestElement.className.split(' ')[0]}` : '');

      // Check if element is currently visible
      const rect = lowestElement.getBoundingClientRect();
      result.primaryActionVisible = rect.top >= 0 && rect.bottom <= viewportHeight;

      // Scroll to bottom and check buffer
      window.scrollTo(0, documentHeight - viewportHeight);
      await new Promise(resolve => setTimeout(resolve, 100));

      const rectAfterScroll = lowestElement.getBoundingClientRect();
      result.bufferPx = Math.round(viewportHeight - rectAfterScroll.bottom);
      result.primaryActionReachable = result.bufferPx >= 0;

      // Reset scroll
      window.scrollTo(0, 0);
    }

    return result;
  }, primaryActionSelector);
}

async function checkLayoutIssues(page: Page): Promise<{ overflow: boolean; blankContent: boolean }> {
  return page.evaluate(() => {
    const overflow = document.body.scrollWidth > window.innerWidth;
    const main = document.querySelector('main');
    const blankContent = main ? main.getBoundingClientRect().height < 50 : false;
    return { overflow, blankContent };
  });
}

// ============================================================
// UI IMPROVEMENT SUGGESTIONS
// ============================================================

async function generateUISuggestions(page: Page): Promise<UISuggestion[]> {
  return page.evaluate(() => {
    const suggestions: UISuggestion[] = [];

    // Check for small tap targets (< 44px)
    const buttons = document.querySelectorAll('button, a, [role="button"]');
    let smallTapTargets = 0;
    buttons.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        smallTapTargets++;
      }
    });
    if (smallTapTargets > 3) {
      suggestions.push({
        type: 'tap_target',
        message: `${smallTapTargets} interactive elements have tap targets smaller than 44px. Consider increasing size for mobile/glove usability.`,
        priority: 'medium',
      });
    }

    // Check for forms without sticky footer
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const rect = form.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.8) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          const btnRect = submitBtn.getBoundingClientRect();
          const stickyParent = submitBtn.closest('[class*="sticky"], [class*="fixed"]');
          if (!stickyParent && btnRect.bottom > window.innerHeight) {
            suggestions.push({
              type: 'sticky_footer',
              message: 'Long form detected without sticky action bar. Consider adding sticky footer for submit button.',
              priority: 'medium',
            });
          }
        }
      }
    });

    // Check for crowded content (many elements close together)
    const allInteractive = document.querySelectorAll('button, a, input, select, textarea');
    let crowdedPairs = 0;
    const elements = Array.from(allInteractive);
    for (let i = 0; i < elements.length - 1; i++) {
      const rect1 = elements[i].getBoundingClientRect();
      const rect2 = elements[i + 1].getBoundingClientRect();
      const gap = Math.abs(rect2.top - rect1.bottom);
      if (gap < 8 && gap >= 0) {
        crowdedPairs++;
      }
    }
    if (crowdedPairs > 5) {
      suggestions.push({
        type: 'spacing',
        message: `${crowdedPairs} pairs of interactive elements have less than 8px spacing. Consider improving spacing for touch usability.`,
        priority: 'low',
      });
    }

    return suggestions;
  });
}

// ============================================================
// AXE ACCESSIBILITY CHECK
// ============================================================

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

// ============================================================
// TOUR EXECUTION
// ============================================================

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
      case 'openModal':
        if (step.selector) {
          await page.click(step.selector, { timeout });
          await page.waitForTimeout(300);
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          await page.fill(step.selector, step.value, { timeout });
        }
        break;

      case 'scroll':
        if (step.value) {
          await page.evaluate((scrollY) => window.scrollTo(0, parseInt(scrollY)), step.value);
        }
        break;

      case 'scrollToBottom':
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(200);
        break;

      case 'scrollToElement':
        if (step.selector) {
          await page.locator(step.selector).first().scrollIntoViewIfNeeded({ timeout });
          await page.waitForTimeout(200);
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

  let resolvedRoute = tour.route;
  if (tour.requiresId) {
    const id = await getDynamicIdForRoute(tour.route);
    if (id) {
      resolvedRoute = resolveRoute(tour.route, id);
    } else {
      return {
        stepResults: [{ step: 'setup', action: 'getDynamicId', status: 'skip', error: 'No ID found for route' }],
        artifacts: [],
      };
    }
  }

  try {
    await page.goto(`${APP_BASE_URL}${resolvedRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
  } catch (error) {
    return {
      stepResults: [{ step: 'navigation', action: 'goto', status: 'fail', error: error instanceof Error ? error.message : 'Navigation failed' }],
      artifacts: [],
    };
  }

  for (const step of tour.steps) {
    const result = await executeTourStep(page, step, runId, viewport, tour.route);
    stepResults.push(result);
    if (result.screenshot) {
      artifacts.push(result.screenshot);
    }

    if (result.status === 'fail' && !step.optional) {
      break;
    }
  }

  return { stepResults, artifacts };
}

// ============================================================
// MAIN TEST FUNCTION
// ============================================================

async function testRoute(
  page: Page,
  route: string,
  viewport: Viewport,
  tour?: PageTour
): Promise<TestResult> {
  const startedAt = new Date().toISOString();
  const priority = tour?.priority || 'P2';
  const consoleErrors: string[] = [];
  const exceptions: string[] = [];
  const networkFailures: string[] = [];
  const issues: UIIssue[] = [];
  let stepResults: TourStepResult[] = [];
  let artifacts: string[] = [];
  let suggestions: UISuggestion[] = [];

  // Event listeners
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    exceptions.push(error.message);
  });

  page.on('requestfailed', (request) => {
    networkFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    if (tour) {
      const tourResult = await runTour(page, tour, runId, viewport);
      stepResults = tourResult.stepResults;
      artifacts = tourResult.artifacts;
    } else {
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
            priority,
            status: 'skip',
            error_message: 'No dynamic ID available for route',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            details: {
              issues: [],
              suggestions: [],
              overflow: false,
              scrollable: false,
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

    // Layout checks
    const layoutIssues = await checkLayoutIssues(page);

    if (layoutIssues.overflow) {
      issues.push({
        code: ERROR_CODES.HORIZONTAL_OVERFLOW,
        message: 'Horizontal overflow detected - content extends beyond viewport width',
      });
    }

    if (layoutIssues.blankContent) {
      issues.push({
        code: ERROR_CODES.BLANK_CONTENT,
        message: 'Main content area appears blank or has very small height',
      });
    }

    // Scroll and buffer checks (P0 and P1 only)
    let scrollResult: ScrollCheckResult | undefined;
    if (shouldCheckScrollBuffer(priority)) {
      scrollResult = await checkScrollability(page, tour?.primaryActionSelector);

      if (scrollResult.scrollLocked) {
        issues.push({
          code: ERROR_CODES.SCROLL_LOCKED,
          message: 'Page content exceeds viewport but scrolling is locked',
        });
      }

      if (scrollResult.bufferPx < MIN_SCROLL_BUFFER_PX && scrollResult.lowestActionableSelector) {
        issues.push({
          code: ERROR_CODES.INSUFFICIENT_SCROLL_BUFFER,
          message: `Scroll buffer is ${scrollResult.bufferPx}px, minimum required is ${MIN_SCROLL_BUFFER_PX}px for glove-friendly usability`,
          selector: scrollResult.lowestActionableSelector,
          measuredValue: scrollResult.bufferPx,
          expectedValue: IDEAL_SCROLL_BUFFER_PX,
        });
      }

      if (!scrollResult.primaryActionReachable && tour?.primaryActionSelector) {
        issues.push({
          code: ERROR_CODES.PRIMARY_ACTION_NOT_REACHABLE,
          message: 'Primary action button is not reachable after scrolling to bottom',
          selector: tour.primaryActionSelector,
        });
      }
    }

    // Accessibility check
    const axeViolations = await runAxeCheck(page);
    const criticalAxe = axeViolations.filter(v => v.impact === 'critical');
    const seriousAxe = axeViolations.filter(v => v.impact === 'serious');

    if (criticalAxe.length > 0) {
      issues.push({
        code: ERROR_CODES.AXE_CRITICAL,
        message: `${criticalAxe.length} critical accessibility violation(s): ${criticalAxe.map(v => v.id).join(', ')}`,
      });
    }

    if (seriousAxe.length > 0) {
      issues.push({
        code: ERROR_CODES.AXE_SERIOUS,
        message: `${seriousAxe.length} serious accessibility violation(s): ${seriousAxe.map(v => v.id).join(', ')}`,
      });
    }

    // Console/network errors
    if (consoleErrors.length > 0) {
      issues.push({
        code: ERROR_CODES.CONSOLE_ERROR,
        message: `${consoleErrors.length} console error(s) detected`,
      });
    }

    if (exceptions.length > 0) {
      issues.push({
        code: ERROR_CODES.UNCAUGHT_EXCEPTION,
        message: `${exceptions.length} uncaught exception(s) detected`,
      });
    }

    if (networkFailures.length > 0) {
      issues.push({
        code: ERROR_CODES.NETWORK_FAILURE,
        message: `${networkFailures.length} network request failure(s) detected`,
      });
    }

    // Tour step failures
    const failedSteps = stepResults.filter(s => s.status === 'fail');
    if (failedSteps.length > 0) {
      issues.push({
        code: ERROR_CODES.TOUR_STEP_FAILED,
        message: `${failedSteps.length} tour step(s) failed: ${failedSteps.map(s => s.step).join(', ')}`,
      });
    }

    // Generate UI suggestions (P0 and P1 only)
    if (shouldCheckScrollBuffer(priority)) {
      suggestions = await generateUISuggestions(page);
    }

    // Determine overall status
    const hasFailingIssues = issues.length > 0;
    let status: 'pass' | 'fail' | 'skip' = hasFailingIssues ? 'fail' : 'pass';
    let errorMessage: string | undefined;

    if (hasFailingIssues) {
      errorMessage = issues.map(i => `[${i.code}] ${i.message}`).join('; ');
    }

    return {
      suite: 'ui_visual_qa',
      test_name: `${route} (${viewport})`,
      route,
      viewport,
      priority,
      status,
      error_message: errorMessage,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: {
        issues,
        suggestions,
        overflow: layoutIssues.overflow,
        scrollable: scrollResult?.scrollable || false,
        scrollBufferPx: scrollResult?.bufferPx,
        primaryActionReachable: scrollResult?.primaryActionReachable,
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
      priority,
      status: 'fail',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: {
        issues,
        suggestions: [],
        overflow: false,
        scrollable: false,
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

// ============================================================
// RESULTS PERSISTENCE
// ============================================================

async function saveResultsToSupabase(results: TestResult[], runId: string, coverageReport: TourCoverageReport): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Supabase not configured, skipping database save');
    return;
  }

  try {
    const p0Failures = results.filter(r => r.priority === 'P0' && r.status === 'fail');
    const runStatus = p0Failures.length > 0 ? 'failed' : results.some(r => r.status === 'fail') ? 'completed' : 'completed';

    const { error: runError } = await supabase
      .from('qa_test_runs')
      .insert({
        id: runId,
        tenant_id: QA_TENANT_ID,
        status: runStatus,
        suites_requested: ['ui_visual_qa'],
        mode: 'create_cleanup',
        pass_count: results.filter(r => r.status === 'pass').length,
        fail_count: results.filter(r => r.status === 'fail').length,
        skip_count: results.filter(r => r.status === 'skip').length,
        finished_at: new Date().toISOString(),
        metadata: {
          viewports: VIEWPORTS,
          totalRoutes: coverageReport.totalRoutes,
          coveragePercent: coverageReport.coveragePercent,
          p0Failures: p0Failures.length,
          p1Failures: results.filter(r => r.priority === 'P1' && r.status === 'fail').length,
        },
      });

    if (runError) {
      console.error('Error creating test run:', runError);
      return;
    }

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
  const routesWithTours = pageTours.map(t => t.route);
  const routesWithoutTours = allRoutes.filter(r => !routesWithTours.includes(r));

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
    p0Count: pageTours.filter(t => t.priority === 'P0').length,
    p1Count: pageTours.filter(t => t.priority === 'P1').length,
    p2Count: pageTours.filter(t => t.priority === 'P2').length,
  };
}

// ============================================================
// TESTS
// ============================================================

test.describe('UI Visual QA', () => {
  test.beforeAll(async ({ browser }) => {
    runId = generateRunId();
    console.log(`Starting UI Visual QA run: ${runId}`);

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = await createSupabaseClient();
    }

    adminContext = await browser.newContext();
    clientContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const adminLoggedIn = await loginUser(adminPage, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, false);
    if (!adminLoggedIn) {
      console.error('Admin login failed');
    }
    await adminPage.close();

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
    const coverageReport = generateCoverageReport();
    await saveResultsToSupabase(testResults, runId, coverageReport);

    const reportPath = path.join('screenshots', runId, 'tour_coverage.json');
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(coverageReport, null, 2));

    await adminContext?.close();
    await clientContext?.close();
  });

  // Generate tests for each tour and viewport
  for (const tour of pageTours) {
    for (const viewport of VIEWPORTS) {
      test(`[${tour.priority}] ${tour.name} - ${viewport}`, async () => {
        const context = tour.roleContext === 'client' ? clientContext : adminContext;
        const page = await context.newPage();

        try {
          const result = await testRoute(page, tour.route, viewport, tour);
          testResults.push(result);

          // For P0 failures, fail the test hard
          if (result.status === 'fail' && shouldFailRun(tour.priority)) {
            expect(result.error_message).toBeUndefined();
          } else if (result.status === 'fail') {
            // P1/P2 failures are soft
            expect.soft(result.error_message).toBeUndefined();
          }
        } finally {
          await page.close();
        }
      });
    }
  }

  // Test routes without tours (screenshot only)
  const routesWithTours = new Set(pageTours.map(t => t.route));
  const routesWithoutTours = getAllRoutes().filter(r => !routesWithTours.has(r));

  for (const route of routesWithoutTours.slice(0, 10)) {
    for (const viewport of VIEWPORTS) {
      test(`[P2] Route-only: ${route} - ${viewport}`, async () => {
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

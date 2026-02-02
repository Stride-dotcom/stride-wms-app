# UI Visual QA System

Automated visual regression testing for Stride WMS using Playwright.

## Overview

The UI Visual QA system visits every screen in the Stride WMS app, runs scripted interactions (page tours), captures screenshots across 3 viewports, and reports results in the Settings > QA Tests console.

## Features

- **Full Route Coverage**: Tests all routes defined in the app
- **Page Tours**: Scripted UI interactions for each page
- **3 Viewports**: Desktop (1440x900), Tablet (834x1194), Mobile (390x844)
- **Automated Checks**:
  - Screenshot capture
  - Console error detection
  - Uncaught exception detection
  - Network failure detection
  - Horizontal overflow detection
  - Accessibility violations (axe-core)
- **Tour Coverage Report**: Shows which routes have tours and missing testids
- **Integration with QA Console**: Results visible in Settings > QA Tests > UI Visual QA

## Directory Structure

```
qa/ui/
├── README.md                 # This file
├── playwright.config.ts      # Playwright configuration
├── ui-visual-qa.spec.ts      # Main test spec
├── tours.ts                  # Page tour definitions
├── routeToFileHints.ts       # Route to source file mapping
├── run.ts                    # Orchestration script
└── upload-artifacts.ts       # Artifact upload for CI
```

## Running Locally

### Prerequisites

1. Install Playwright browsers:
   ```bash
   npx playwright install --with-deps chromium
   ```

2. Set environment variables:
   ```bash
   export APP_BASE_URL="http://localhost:5173"
   export QA_ADMIN_EMAIL="admin@example.com"
   export QA_ADMIN_PASSWORD="password"
   # Optional for client portal tests
   export QA_CLIENT_EMAIL="client@example.com"
   export QA_CLIENT_PASSWORD="password"
   # Optional for Supabase integration
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   export QA_TENANT_ID="your-tenant-id"
   ```

### Run Tests

```bash
# Run all tests
npx playwright test --config=qa/ui/playwright.config.ts

# Run specific viewport
npx playwright test --config=qa/ui/playwright.config.ts --project=desktop

# Run with headed browser
npx playwright test --config=qa/ui/playwright.config.ts --headed

# View report after tests
npx playwright show-report
```

## Running via GitHub Actions

1. Go to Actions > UI Visual QA
2. Click "Run workflow"
3. Optionally specify viewports or routes
4. View results in the workflow artifacts or Settings > QA Tests > UI Visual QA

### Required Secrets

- `APP_BASE_URL` - Application URL
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `QA_TENANT_ID` - Tenant ID for test data
- `QA_ADMIN_EMAIL` - Admin user email
- `QA_ADMIN_PASSWORD` - Admin user password
- `QA_CLIENT_EMAIL` - Client user email (optional)
- `QA_CLIENT_PASSWORD` - Client user password (optional)

## Adding New Tours

Edit `qa/ui/tours.ts` to add tours for new pages:

```typescript
{
  route: '/new-page',
  name: 'New Page Tour',
  roleContext: 'admin',
  steps: [
    { action: 'screenshot', note: 'Initial state' },
    { action: 'expectVisible', selector: '[data-testid="page-header"]' },
    { action: 'click', selector: '[data-testid="button"]', screenshotAfter: true },
    { action: 'pressKey', value: 'Escape' },
    { action: 'screenshot', note: 'Final state' },
  ],
}
```

### Tour Actions

- `click` - Click an element
- `type` - Type text into an input
- `waitFor` - Wait for an element to appear
- `expectVisible` - Assert element is visible
- `screenshot` - Capture screenshot
- `pressKey` - Press a keyboard key
- `navigateBack` - Go back in history
- `closeModal` - Press Escape to close modal

### Adding Test IDs

Add `data-testid` attributes to components for reliable selection:

```tsx
<Button data-testid="submit-button">Submit</Button>
```

Naming conventions:
- Navigation: `nav-{route}` (e.g., `nav-shipments`)
- Page headers: `page-header`
- Create buttons: `create-{entity}-button`
- Tabs: `{page}-tab-{name}`
- Rows: `{entity}-row`
- Filters: `{name}-filter`

## Viewing Results

1. Go to Settings > QA Tests > UI Visual QA tab
2. Select a run to view details
3. See tour coverage report with:
   - Coverage percentage
   - Routes with/without tours
   - Missing testids
4. View results grouped by route
5. For failures, see:
   - Console errors
   - Accessibility violations
   - Screenshot artifacts
   - File hints for fixing

## Artifacts

Screenshots are stored in:
- Local: `screenshots/{run_id}/{viewport}/{route_slug}/{step}.png`
- Supabase Storage: `qa-artifacts/ui/{run_id}/{viewport}/{route_slug}/{step}.png`

## Interpreting Failures

### Horizontal Overflow
The page content extends beyond the viewport width. Check:
- Fixed-width elements that should be responsive
- Tables without horizontal scroll
- Long unbroken text

### Console Errors
JavaScript errors were logged. Check the browser console for details.

### Accessibility Violations
axe-core found WCAG violations. Common issues:
- Missing alt text on images
- Low color contrast
- Missing form labels
- Focus indicators

### Tour Step Failures
A scripted interaction failed. Possible causes:
- Missing data-testid attribute
- Element not rendered
- Timing issues (element not ready)

## Maintenance

### Update Route Coverage
When adding new routes:
1. Add route to `routeToFileHints.ts`
2. Add tour to `tours.ts`
3. Add data-testid attributes to the new page

### Run After UI Changes
Run UI Visual QA after significant UI changes to catch:
- Layout regressions
- Missing interactions
- Accessibility regressions

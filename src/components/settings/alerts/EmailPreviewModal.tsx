import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  CommunicationBrandSettings,
  COMMUNICATION_VARIABLES,
} from '@/hooks/useCommunications';
import { buildBrandedEmailHtml, replaceTokens } from '@/lib/emailTemplates/brandedEmailBuilder';

interface EmailPreviewProps {
  subject: string;
  heading: string;
  body: string;
  ctaEnabled: boolean;
  ctaLabel: string;
  ctaLink: string;
  brandSettings: CommunicationBrandSettings | null;
  tenantCompanyName?: string;
  tenantLogoUrl?: string;
  accentColor: string;
}

interface EmailPreviewModalProps extends EmailPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Build sample data map from COMMUNICATION_VARIABLES + real tenant overrides */
function useSampleData(
  brandSettings: CommunicationBrandSettings | null,
  tenantCompanyName?: string,
  tenantLogoUrl?: string
) {
  return useMemo(() => {
    const data: Record<string, string> = {};
    COMMUNICATION_VARIABLES.forEach((v) => {
      data[v.key] = v.sample;
    });

    // Use real company name for tenant_name (from tenant_company_settings)
    if (tenantCompanyName) data['tenant_name'] = tenantCompanyName;

    // Use real company logo (from tenant_company_settings), then brand override
    if (tenantLogoUrl) data['brand_logo_url'] = tenantLogoUrl;

    if (brandSettings) {
      // Brand settings overrides (these take priority)
      if (brandSettings.brand_logo_url) data['brand_logo_url'] = brandSettings.brand_logo_url;
      if (brandSettings.brand_support_email) data['brand_support_email'] = brandSettings.brand_support_email;
      if (brandSettings.portal_base_url) data['portal_base_url'] = brandSettings.portal_base_url;
    }

    // If still no logo URL, use empty string to avoid broken image
    if (!data['brand_logo_url'] || data['brand_logo_url'] === 'https://example.com/logo.png') {
      data['brand_logo_url'] = '';
    }

    return data;
  }, [brandSettings, tenantCompanyName, tenantLogoUrl]);
}

/** Build the final preview HTML from editor fields */
function usePreviewHtml(
  heading: string,
  body: string,
  ctaEnabled: boolean,
  ctaLabel: string,
  ctaLink: string,
  accentColor: string,
  sampleData: Record<string, string>
) {
  return useMemo(() => {
    const rawHtml = buildBrandedEmailHtml({
      heading,
      body,
      ctaEnabled,
      ctaLabel,
      ctaLink,
      accentColor,
    });
    let html = replaceTokens(rawHtml, sampleData);
    // Remove <img> tags with empty src (no logo configured).
    // The onerror handler can't fire inside a sandboxed iframe without allow-scripts.
    html = html.replace(/<img[^>]*src=["']\s*["'][^>]*\/?>/gi, '');
    return html;
  }, [heading, body, ctaEnabled, ctaLabel, ctaLink, accentColor, sampleData]);
}

/**
 * Full-screen email preview modal (used on mobile).
 * Renders the branded HTML email in an iframe with sample data.
 */
export function EmailPreviewModal({
  open,
  onOpenChange,
  subject,
  heading,
  body,
  ctaEnabled,
  ctaLabel,
  ctaLink,
  brandSettings,
  tenantCompanyName,
  tenantLogoUrl,
  accentColor,
}: EmailPreviewModalProps) {
  // ESC key support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const sampleData = useSampleData(brandSettings, tenantCompanyName, tenantLogoUrl);
  const previewHtml = usePreviewHtml(heading, body, ctaEnabled, ctaLabel, ctaLink, accentColor, sampleData);
  const resolvedSubject = useMemo(() => replaceTokens(subject, sampleData), [subject, sampleData]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Email Preview"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <MaterialIcon name="visibility" size="md" className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Email Preview</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          <MaterialIcon name="close" size="sm" className="mr-2" />
          Close
        </Button>
      </div>

      {/* Subject line */}
      <div className="px-6 py-3 border-b bg-muted/20 flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-0.5">Subject</p>
        <p className="text-sm font-medium">{resolvedSubject || '(no subject)'}</p>
        <div className="mt-1 text-xs text-muted-foreground">
          From: {brandSettings?.from_name || 'Company Name'}{' '}
          &lt;{brandSettings?.from_email || 'notifications@company.com'}&gt;
        </div>
      </div>

      {/* Email rendered in iframe */}
      <div className="flex-1 overflow-hidden bg-muted/30">
        <iframe
          title="Email Preview"
          srcDoc={previewHtml}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
        />
      </div>

      {/* Note */}
      <div className="px-6 py-2 border-t bg-card text-center flex-shrink-0">
        <p className="text-xs text-muted-foreground">
          Preview uses sample data for tokens. Actual emails use real values.
        </p>
      </div>
    </div>,
    document.body
  );
}

/**
 * Inline live preview for desktop side-by-side layout.
 * Renders the branded HTML email in an iframe that updates as the user types.
 */
export function EmailLivePreview({
  subject,
  heading,
  body,
  ctaEnabled,
  ctaLabel,
  ctaLink,
  brandSettings,
  tenantCompanyName,
  tenantLogoUrl,
  accentColor,
}: EmailPreviewProps) {
  const sampleData = useSampleData(brandSettings, tenantCompanyName, tenantLogoUrl);
  const previewHtml = usePreviewHtml(heading, body, ctaEnabled, ctaLabel, ctaLink, accentColor, sampleData);
  const resolvedSubject = useMemo(() => replaceTokens(subject, sampleData), [subject, sampleData]);

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Preview Header */}
      <div className="px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <MaterialIcon name="visibility" size="sm" className="text-muted-foreground" />
          <span className="text-sm font-semibold">Live Preview</span>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Subject</p>
          <p className="text-sm font-medium truncate">{resolvedSubject || '(no subject)'}</p>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          From: {brandSettings?.from_name || 'Company Name'}{' '}
          &lt;{brandSettings?.from_email || 'notifications@company.com'}&gt;
        </div>
      </div>

      {/* Email iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          title="Email Live Preview"
          srcDoc={previewHtml}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
        />
      </div>

      {/* Note */}
      <div className="px-4 py-2 border-t bg-card flex-shrink-0">
        <p className="text-[11px] text-muted-foreground text-center">
          Sample data shown. Actual emails use real values.
        </p>
      </div>
    </div>
  );
}

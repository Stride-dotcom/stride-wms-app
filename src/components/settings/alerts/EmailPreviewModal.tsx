import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  CommunicationBrandSettings,
  COMMUNICATION_VARIABLES,
} from '@/hooks/useCommunications';

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
  ctaEnabled: boolean;
  ctaLabel: string;
  ctaLink: string;
  brandSettings: CommunicationBrandSettings | null;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  subject,
  body,
  ctaEnabled,
  ctaLabel,
  ctaLink,
  brandSettings,
}: EmailPreviewModalProps) {
  const accentColor = brandSettings?.brand_primary_color || '#E85D2D';
  const logoUrl = brandSettings?.brand_logo_url || null;
  const tenantName = brandSettings?.from_name || 'Your Company';
  const supportEmail = brandSettings?.brand_support_email || '';
  const portalUrl = brandSettings?.portal_base_url || '';

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

  if (!open) return null;

  // Replace tokens with sample data for preview
  const sampleData = buildSampleData();
  const resolvedSubject = replaceTokens(subject, sampleData);
  const resolvedBody = replaceTokens(body, sampleData);

  // Convert basic markdown to HTML-safe display
  const bodyHtml = markdownToSimpleHtml(resolvedBody);

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

      {/* Scrollable Preview Content */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Subject line preview */}
          <div className="mb-6 p-4 bg-card rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Subject</p>
            <p className="text-sm font-medium">{resolvedSubject || '(no subject)'}</p>
          </div>

          {/* Email render */}
          <div className="border rounded-lg overflow-hidden shadow-sm">
            {/* Header Bar */}
            <div
              className="p-6 flex items-center"
              style={{ backgroundColor: accentColor }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="h-8 max-w-[180px] object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-white font-semibold text-lg">{tenantName}</span>
              )}
            </div>

            {/* Body */}
            <div className="bg-white p-8">
              <div
                className="text-[15px] leading-relaxed text-[#475569] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />

              {/* CTA Button */}
              {ctaEnabled && ctaLabel && (
                <div className="mt-8 text-center">
                  <span
                    className="inline-block px-8 py-3.5 text-white font-semibold text-sm rounded-lg cursor-default"
                    style={{ backgroundColor: accentColor }}
                  >
                    {ctaLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[#e2e8f0]" />

            {/* Footer */}
            <div className="bg-[#f8fafc] p-6 text-center text-sm text-[#64748b] space-y-1">
              <p className="font-semibold text-[#1e293b]">{tenantName}</p>
              {portalUrl && <p>{portalUrl}</p>}
              {supportEmail && <p>{supportEmail}</p>}
              {!portalUrl && !supportEmail && (
                <p className="text-[#94a3b8]">Configure portal URL or support email in Brand Settings</p>
              )}
            </div>
          </div>

          {/* Sender preview */}
          <div className="mt-6 p-4 bg-card rounded-lg border text-sm">
            <span className="text-muted-foreground">From: </span>
            <span className="font-medium">
              {brandSettings?.from_name || 'Company Name'}{' '}
              &lt;{brandSettings?.from_email || 'notifications@company.com'}&gt;
            </span>
          </div>

          {/* Note */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            This preview uses sample data for tokens. Actual emails will use real values.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Helpers ---

function buildSampleData(): Record<string, string> {
  const data: Record<string, string> = {};
  COMMUNICATION_VARIABLES.forEach((v) => {
    data[v.key] = v.sample;
  });
  return data;
}

function replaceTokens(text: string, data: Record<string, string>): string {
  let result = text;
  Object.entries(data).forEach(([key, value]) => {
    result = result
      .replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      .replace(new RegExp(`\\[\\[${key}\\]\\]`, 'g'), value);
  });
  return result;
}

function markdownToSimpleHtml(text: string): string {
  // Escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links: [text](url)
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" style="color:#2563eb;text-decoration:underline;">$1</a>'
  );

  return html;
}

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  // Replace tokens with sample data for preview
  const sampleData = buildSampleData();
  const resolvedSubject = replaceTokens(subject, sampleData);
  const resolvedBody = replaceTokens(body, sampleData);
  const resolvedCtaLink = replaceTokens(ctaLink, sampleData);

  // Convert basic markdown to HTML-safe display
  const bodyHtml = markdownToSimpleHtml(resolvedBody);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="visibility" size="md" />
            Email Preview
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* Subject line preview */}
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Subject</p>
            <p className="text-sm font-medium">{resolvedSubject || '(no subject)'}</p>
          </div>

          {/* Email render */}
          <div className="border rounded-lg overflow-hidden bg-[#f1f5f9]">
            {/* Header Bar */}
            <div
              className="p-6 flex items-center justify-between"
              style={{ backgroundColor: accentColor }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="h-8 max-w-[150px] object-contain"
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
                <div className="mt-6 text-center">
                  <a
                    href={resolvedCtaLink || '#'}
                    className="inline-block px-7 py-3.5 text-white font-semibold text-sm rounded-lg no-underline"
                    style={{ backgroundColor: accentColor }}
                  >
                    {ctaLabel}
                  </a>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[#e2e8f0]" />

            {/* Footer */}
            <div className="bg-[#f8fafc] p-6 text-center text-sm text-[#64748b] space-y-1">
              <p className="font-semibold text-[#1e293b]">{tenantName}</p>
              {supportEmail && <p>{supportEmail}</p>}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links: [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#E85D2D;">$1</a>');

  return html;
}

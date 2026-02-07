import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CommunicationAlert,
  CommunicationTemplate,
  CommunicationBrandSettings,
  COMMUNICATION_VARIABLES,
  TRIGGER_EVENTS,
} from '@/hooks/useCommunications';
import { EmailPreviewModal } from './EmailPreviewModal';

// Link-type tokens for CTA button link dropdown
const LINK_TOKENS = COMMUNICATION_VARIABLES.filter(
  (v) => v.key.endsWith('_link') || v.key.endsWith('_url')
);

type Channel = 'email' | 'sms' | 'in_app';

interface AlertTemplateEditorProps {
  alerts: CommunicationAlert[];
  templates: CommunicationTemplate[];
  brandSettings: CommunicationBrandSettings | null;
  onUpdateAlert: (id: string, updates: Partial<CommunicationAlert>) => Promise<boolean>;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  onCreateTemplate: (alertId: string, channel: 'email' | 'sms', alertName: string, triggerEvent?: string) => Promise<CommunicationTemplate | null>;
  onBack: () => void;
  selectedAlertId?: string;
}

export function AlertTemplateEditor({
  alerts,
  templates,
  brandSettings,
  onUpdateAlert,
  onUpdateTemplate,
  onCreateTemplate,
  onBack,
  selectedAlertId,
}: AlertTemplateEditorProps) {
  const [alertId, setAlertId] = useState(selectedAlertId || alerts[0]?.id || '');
  const [channel, setChannel] = useState<Channel>('email');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [inAppBody, setInAppBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastFocusedField, setLastFocusedField] = useState<string>('body');

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const recipientsRef = useRef<HTMLInputElement>(null);
  const smsBodyRef = useRef<HTMLTextAreaElement>(null);
  const inAppBodyRef = useRef<HTMLTextAreaElement>(null);

  const selectedAlert = alerts.find((a) => a.id === alertId) || null;
  const emailTemplate = templates.find((t) => t.alert_id === alertId && t.channel === 'email') || null;
  const smsTemplate = templates.find((t) => t.alert_id === alertId && t.channel === 'sms') || null;

  // Load template data when alert or channel changes
  useEffect(() => {
    if (!selectedAlert) return;

    if (emailTemplate) {
      setSubject(emailTemplate.subject_template || '');
      setBody(emailTemplate.body_template || '');
      // Parse CTA from editor_json if available
      const editorData = emailTemplate.editor_json as Record<string, unknown> | null;
      if (editorData) {
        setRecipients((editorData.recipients as string) || '');
        setCtaEnabled(!!(editorData.cta_enabled));
        setCtaLabel((editorData.cta_label as string) || '');
        setCtaLink((editorData.cta_link as string) || '');
      } else {
        setRecipients('');
        setCtaEnabled(false);
        setCtaLabel('');
        setCtaLink('');
      }
    } else {
      setSubject('');
      setBody('');
      setRecipients('');
      setCtaEnabled(false);
      setCtaLabel('');
      setCtaLink('');
    }

    if (smsTemplate) {
      setSmsBody(smsTemplate.body_template || '');
      // Load SMS recipients from editor_json if not already loaded
      const smsEditorData = smsTemplate.editor_json as Record<string, unknown> | null;
      if (smsEditorData && !emailTemplate) {
        setRecipients((smsEditorData.recipients as string) || '');
      }
    } else {
      setSmsBody('');
    }

    // In-app uses SMS template slot or separate storage - initialize from body
    setInAppBody('');
  }, [alertId, selectedAlert, emailTemplate, smsTemplate]);

  const handleSave = async () => {
    if (!selectedAlert) return;
    setIsSaving(true);

    try {
      // Save email template
      if (emailTemplate) {
        await onUpdateTemplate(emailTemplate.id, {
          subject_template: subject,
          body_template: body,
          editor_json: {
            recipients,
            cta_enabled: ctaEnabled,
            cta_label: ctaLabel,
            cta_link: ctaLink,
          } as Record<string, unknown>,
        });
      }

      // Save SMS template
      if (smsTemplate) {
        await onUpdateTemplate(smsTemplate.id, {
          body_template: smsBody,
          editor_json: {
            recipients,
          } as Record<string, unknown>,
        });
      }
    } catch {
      // Errors handled by hook toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onBack();
  };

  const insertToken = useCallback((tokenKey: string) => {
    const token = `[[${tokenKey}]]`;

    const insertAtCursor = (
      ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
      value: string,
      setter: (val: string) => void
    ) => {
      const el = ref.current;
      if (!el) {
        setter(value + token);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newVal = value.substring(0, start) + token + value.substring(end);
      setter(newVal);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + token.length;
        el.focus();
      });
    };

    if (channel === 'sms') {
      insertAtCursor(smsBodyRef, smsBody, setSmsBody);
    } else if (channel === 'in_app') {
      insertAtCursor(inAppBodyRef, inAppBody, setInAppBody);
    } else {
      // Email channel - insert into last focused field
      if (lastFocusedField === 'subject') {
        insertAtCursor(subjectRef, subject, setSubject);
      } else if (lastFocusedField === 'recipients') {
        insertAtCursor(recipientsRef, recipients, setRecipients);
      } else {
        insertAtCursor(bodyRef, body, setBody);
      }
    }
  }, [channel, lastFocusedField, body, subject, recipients, smsBody, inAppBody]);

  const triggerLabel = selectedAlert
    ? TRIGGER_EVENTS.find((e) => e.value === selectedAlert.trigger_event)?.label || selectedAlert.trigger_event
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <MaterialIcon name="arrow_back" size="md" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Alert Template Editor</h1>
            <p className="text-sm text-muted-foreground">
              Set recipients, subject, message body + token dropdown + optional CTA + branding from
              Organization.
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* TOP ROW: Alert Trigger + Template Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alert Trigger</Label>
              <Select value={alertId} onValueChange={setAlertId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select alert" />
                </SelectTrigger>
                <SelectContent>
                  {alerts.map((alert) => (
                    <SelectItem key={alert.id} value={alert.id}>
                      {alert.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template Type</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="in_app">In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enabled Toggle */}
          {selectedAlert && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Alert Enabled</span>
              <Switch
                checked={selectedAlert.is_enabled}
                onCheckedChange={(checked) => onUpdateAlert(selectedAlert.id, { is_enabled: checked })}
              />
            </div>
          )}

          {/* Tokens Dropdown + Insert */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tokens</Label>
            <TokenInsertRow onInsert={insertToken} />
            <p className="text-xs text-muted-foreground">
              Click into a field first, then insert a token.
            </p>
          </div>

          <Separator />

          {/* Recipients - always visible */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Recipients (comma-separated emails and/or tokens)
            </Label>
            <Input
              ref={recipientsRef}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              onFocus={() => setLastFocusedField('recipients')}
              placeholder=""
            />
          </div>

          {/* EMAIL-SPECIFIC FIELDS */}
          {channel === 'email' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input
                  ref={subjectRef}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setLastFocusedField('subject')}
                  placeholder=""
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Body (light rich text)</Label>
                <div className="flex items-center gap-2 mb-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => wrapSelection(bodyRef, '**', '**', body, setBody)}
                  >
                    Bold
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => wrapSelection(bodyRef, '*', '*', body, setBody)}
                  >
                    Italic
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => wrapSelection(bodyRef, '[', '](url)', body, setBody)}
                  >
                    Link
                  </Button>
                  <span className="text-xs text-muted-foreground">/ minimal tools only</span>
                </div>
                <Textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setLastFocusedField('body')}
                  className="min-h-[200px] resize-y font-mono text-sm"
                  placeholder=""
                />
              </div>

              {/* Optional CTA Button */}
              <div className="space-y-3">
                <h3 className="font-bold text-base">Optional CTA Button</h3>
                <p className="text-xs text-muted-foreground">Enable only if needed.</p>
                <Separator />

                <div className="flex items-center gap-3">
                  <Switch
                    checked={ctaEnabled}
                    onCheckedChange={setCtaEnabled}
                  />
                  <span className="text-sm">Enable CTA button</span>
                </div>

                {ctaEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Button Label</Label>
                      <Input
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                        placeholder="e.g. View Shipment"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Button Link</Label>
                      <Select value={ctaLink} onValueChange={setCtaLink}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a link token" />
                        </SelectTrigger>
                        <SelectContent>
                          {LINK_TOKENS.map((token) => (
                            <SelectItem key={token.key} value={`[[${token.key}]]`}>
                              [[{token.key}]]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Brand Styling */}
              <div className="space-y-3">
                <h3 className="font-bold text-base">Brand Styling</h3>
                <p className="text-xs text-muted-foreground">
                  Logo auto from Organization &rarr; Logo. Color optional override.
                </p>
                <Separator />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Accent Color (optional)</Label>
                  <Input
                    value={brandSettings?.brand_primary_color || '#FF6A00'}
                    disabled
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Managed from Organization &rarr; Brand Settings
                  </p>
                </div>
              </div>

              {/* Preview Button */}
              <div>
                <Button variant="outline" onClick={() => setShowPreview(true)}>
                  <MaterialIcon name="visibility" size="sm" className="mr-2" />
                  Preview
                </Button>
              </div>
            </>
          )}

          {/* SMS CHANNEL */}
          {channel === 'sms' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SMS Body</Label>
              <Textarea
                ref={smsBodyRef}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                onFocus={() => setLastFocusedField('smsBody')}
                className="min-h-[200px] resize-y font-mono text-sm"
                placeholder="Enter SMS message..."
              />
            </div>
          )}

          {/* IN-APP CHANNEL */}
          {channel === 'in_app' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">In-App Message</Label>
              <Textarea
                ref={inAppBodyRef}
                value={inAppBody}
                onChange={(e) => setInAppBody(e.target.value)}
                onFocus={() => setLastFocusedField('inAppBody')}
                className="min-h-[200px] resize-y font-mono text-sm"
                placeholder="Enter in-app notification message..."
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 pb-8">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showPreview && (
        <EmailPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          subject={subject}
          body={body}
          ctaEnabled={ctaEnabled}
          ctaLabel={ctaLabel}
          ctaLink={ctaLink}
          brandSettings={brandSettings}
        />
      )}
    </div>
  );
}

// Token insert dropdown component
function TokenInsertRow({ onInsert }: { onInsert: (key: string) => void }) {
  const [selectedToken, setSelectedToken] = useState('');

  // Group variables for the dropdown
  const groups = COMMUNICATION_VARIABLES.reduce<Record<string, typeof COMMUNICATION_VARIABLES>>((acc, v) => {
    if (!acc[v.group]) acc[v.group] = [];
    acc[v.group].push(v);
    return acc;
  }, {});

  const handleInsert = () => {
    if (selectedToken) {
      onInsert(selectedToken);
      setSelectedToken('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedToken} onValueChange={setSelectedToken}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select token..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {Object.entries(groups).map(([group, vars]) => (
            <div key={group}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
              {vars.map((v) => (
                <SelectItem key={v.key} value={v.key}>
                  [[{v.key}]] &mdash; {v.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleInsert} disabled={!selectedToken}>
        Insert
      </Button>
    </div>
  );
}

// Helper to wrap selected text in textarea with before/after strings
function wrapSelection(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  value: string,
  setter: (val: string) => void
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const selected = value.substring(start, end);
  const newVal =
    value.substring(0, start) + before + (selected || 'text') + after + value.substring(end);
  setter(newVal);
  requestAnimationFrame(() => {
    const newCursor = start + before.length + (selected || 'text').length + after.length;
    el.selectionStart = el.selectionEnd = newCursor;
    el.focus();
  });
}

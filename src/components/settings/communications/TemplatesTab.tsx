import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  MessageSquare,
  Code,
  Eye,
  Save,
  History,
  Search,
  ChevronDown,
  Info,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import {
  CommunicationAlert,
  CommunicationTemplate,
  CommunicationTemplateVersion,
  CommunicationDesignElement,
  CommunicationBrandSettings,
  COMMUNICATION_VARIABLES,
} from '@/hooks/useCommunications';
import { format } from 'date-fns';

interface TemplatesTabProps {
  alerts: CommunicationAlert[];
  templates: CommunicationTemplate[];
  designElements: CommunicationDesignElement[];
  brandSettings: CommunicationBrandSettings | null;
  selectedAlertId: string | null;
  selectedChannel: 'email' | 'sms' | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  getTemplateVersions: (templateId: string) => Promise<CommunicationTemplateVersion[]>;
  revertToVersion: (templateId: string, version: CommunicationTemplateVersion) => Promise<boolean>;
  onClose: () => void;
}

export function TemplatesTab({
  alerts,
  templates,
  designElements,
  brandSettings,
  selectedAlertId,
  selectedChannel,
  onUpdateTemplate,
  getTemplateVersions,
  revertToVersion,
  onClose,
}: TemplatesTabProps) {
  const [currentAlertId, setCurrentAlertId] = useState(selectedAlertId || '');
  const [currentChannel, setCurrentChannel] = useState<'email' | 'sms'>(selectedChannel || 'email');
  const [editorMode, setEditorMode] = useState<'rich' | 'code'>('code');
  const [previewContext, setPreviewContext] = useState<'shipment' | 'task' | 'release'>('shipment');
  const [variableSearch, setVariableSearch] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  
  const currentTemplate = templates.find(
    t => t.alert_id === currentAlertId && t.channel === currentChannel
  );
  
  const currentAlert = alerts.find(a => a.id === currentAlertId);
  
  const [formData, setFormData] = useState({
    subject_template: '',
    body_template: '',
    from_name: '',
    from_email: '',
    sms_sender_id: '',
  });

  useEffect(() => {
    if (currentTemplate) {
      setFormData({
        subject_template: currentTemplate.subject_template || '',
        body_template: currentTemplate.body_template || '',
        from_name: currentTemplate.from_name || brandSettings?.from_name || '',
        from_email: currentTemplate.from_email || brandSettings?.from_email || '',
        sms_sender_id: currentTemplate.sms_sender_id || brandSettings?.sms_sender_id || '',
      });
    }
  }, [currentTemplate, brandSettings]);

  useEffect(() => {
    if (selectedAlertId) {
      setCurrentAlertId(selectedAlertId);
    }
    if (selectedChannel) {
      setCurrentChannel(selectedChannel);
    }
  }, [selectedAlertId, selectedChannel]);

  const filteredVariables = COMMUNICATION_VARIABLES.filter(v =>
    v.key.toLowerCase().includes(variableSearch.toLowerCase()) ||
    v.label.toLowerCase().includes(variableSearch.toLowerCase()) ||
    v.group.toLowerCase().includes(variableSearch.toLowerCase())
  );

  const groupedVariables = filteredVariables.reduce((acc, v) => {
    if (!acc[v.group]) acc[v.group] = [];
    acc[v.group].push(v);
    return acc;
  }, {} as Record<string, typeof COMMUNICATION_VARIABLES>);

  const insertVariable = (varKey: string) => {
    const variable = `{{${varKey}}}`;
    const target = currentChannel === 'email' && subjectRef.current?.matches(':focus')
      ? subjectRef.current
      : bodyRef.current;
    
    if (target) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const fieldName = target === subjectRef.current ? 'subject_template' : 'body_template';
      const currentValue = formData[fieldName as keyof typeof formData] || '';
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      
      setFormData(prev => ({ ...prev, [fieldName]: newValue }));
      
      // Restore cursor position
      setTimeout(() => {
        target.focus();
        target.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const copyVariable = (varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const insertDesignElement = (element: CommunicationDesignElement) => {
    if (bodyRef.current) {
      const start = bodyRef.current.selectionStart || 0;
      const end = bodyRef.current.selectionEnd || 0;
      const newValue = formData.body_template.substring(0, start) + element.html_snippet + formData.body_template.substring(end);
      setFormData(prev => ({ ...prev, body_template: newValue }));
    }
  };

  const handleSave = async () => {
    if (!currentTemplate) return;
    
    setIsSaving(true);
    await onUpdateTemplate(currentTemplate.id, {
      subject_template: formData.subject_template || null,
      body_template: formData.body_template,
      from_name: formData.from_name || null,
      from_email: formData.from_email || null,
      sms_sender_id: formData.sms_sender_id || null,
    });
    setIsSaving(false);
  };

  const loadVersions = async () => {
    if (!currentTemplate) return;
    const vers = await getTemplateVersions(currentTemplate.id);
    setVersions(vers);
    setShowVersions(true);
  };

  const handleRevert = async (version: CommunicationTemplateVersion) => {
    if (!currentTemplate) return;
    await revertToVersion(currentTemplate.id, version);
    setShowVersions(false);
  };

  const renderPreview = () => {
    if (!formData.body_template) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No template content to preview
        </div>
      );
    }

    // Replace variables with sample data
    let html = formData.body_template;
    COMMUNICATION_VARIABLES.forEach(v => {
      html = html.replace(new RegExp(`{{${v.key}}}`, 'g'), v.sample);
    });

    // Replace brand settings
    if (brandSettings) {
      html = html.replace(/{{brand_logo_url}}/g, brandSettings.brand_logo_url || '');
      html = html.replace(/{{brand_primary_color}}/g, brandSettings.brand_primary_color);
      html = html.replace(/{{brand_support_email}}/g, brandSettings.brand_support_email || 'support@example.com');
      html = html.replace(/{{portal_base_url}}/g, brandSettings.portal_base_url || 'https://portal.example.com');
    }

    // Sample items list for preview
    const sampleItemsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;border-left:4px solid #FD5A2A;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-weight:600;color:#111111;">1x Office Chair</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-size:14px;padding-top:4px;">ITM-001 • Supplier Inc • Aisle A, Rack 5</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    html = html.replace(/{{items_list_html}}/g, sampleItemsHtml);

    if (currentChannel === 'sms') {
      return (
        <div className="flex justify-center p-4">
          <div className="w-[320px] rounded-[40px] bg-[#111111] p-4 shadow-xl">
            <div className="rounded-[32px] bg-white overflow-hidden">
              <div className="bg-muted p-3 text-center text-xs font-medium border-b">
                Messages
              </div>
              <div className="p-4 min-h-[400px] bg-[#f3f4f6]">
                <div className="bg-[#007AFF] text-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] text-sm whitespace-pre-wrap">
                  {formData.body_template.replace(/{{(\w+)}}/g, (_, key) => {
                    const variable = COMMUNICATION_VARIABLES.find(v => v.key === key);
                    return variable?.sample || `[${key}]`;
                  })}
                </div>
                <div className="text-xs text-muted-foreground text-center mt-2">
                  {formData.body_template.length} / 160 characters
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <iframe
        srcDoc={html}
        className="w-full h-full border-0 bg-white"
        title="Email Preview"
        sandbox="allow-same-origin"
      />
    );
  };

  if (!currentAlertId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select an Alert to Edit Templates</h3>
        <p className="text-muted-foreground mb-4">
          Choose an alert from the dropdown or go to the Alerts tab to create one.
        </p>
        <Select value={currentAlertId} onValueChange={setCurrentAlertId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select an alert" />
          </SelectTrigger>
          <SelectContent>
            {alerts.map((alert) => (
              <SelectItem key={alert.id} value={alert.id}>
                {alert.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-300px)] min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-4">
          <Select value={currentAlertId} onValueChange={setCurrentAlertId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select alert" />
            </SelectTrigger>
            <SelectContent>
              {alerts.map((alert) => (
                <SelectItem key={alert.id} value={alert.id}>
                  {alert.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Tabs value={currentChannel} onValueChange={(v) => setCurrentChannel(v as 'email' | 'sms')}>
            <TabsList>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Test
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Coming next (Email/Twilio provider integration)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button variant="outline" size="sm" onClick={loadVersions}>
            <History className="mr-2 h-4 w-4" />
            Versions
          </Button>
          
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-4 pt-4 overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* From Settings (Email only) */}
          {currentChannel === 'email' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  placeholder="e.g., Stride Logistics"
                  value={formData.from_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="e.g., notifications@stride.com"
                  value={formData.from_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* SMS Sender (SMS only) */}
          {currentChannel === 'sms' && (
            <div className="space-y-2">
              <Label htmlFor="sms_sender">SMS Sender ID</Label>
              <Input
                id="sms_sender"
                placeholder="e.g., STRIDE or +1234567890"
                value={formData.sms_sender_id}
                onChange={(e) => setFormData(prev => ({ ...prev, sms_sender_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric sender ID or phone number (requires Twilio configuration)
              </p>
            </div>
          )}

          {/* Subject (Email only) */}
          {currentChannel === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                ref={subjectRef}
                id="subject"
                placeholder="Email subject with {{variables}}"
                value={formData.subject_template}
                onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
              />
            </div>
          )}

          {/* Body Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <Label>Body</Label>
              {currentChannel === 'email' && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Insert Element
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      {['icon', 'divider', 'callout', 'button', 'header_block'].map(category => {
                        const categoryElements = designElements.filter(e => e.category === category);
                        if (categoryElements.length === 0) return null;
                        return (
                          <div key={category}>
                            <DropdownMenuLabel className="capitalize">{category.replace('_', ' ')}</DropdownMenuLabel>
                            {categoryElements.map(element => (
                              <DropdownMenuItem
                                key={element.id}
                                onClick={() => insertDesignElement(element)}
                              >
                                {element.name}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </div>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'rich' | 'code')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="code" className="text-xs px-2 h-6">
                        <Code className="h-3 w-3 mr-1" />
                        Code
                      </TabsTrigger>
                      <TabsTrigger value="rich" className="text-xs px-2 h-6" disabled>
                        Rich
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
            
            <Textarea
              ref={bodyRef}
              className="flex-1 min-h-[200px] font-mono text-sm resize-none"
              placeholder={currentChannel === 'email' ? 'HTML template with {{variables}}' : 'SMS message with {{variables}}'}
              value={formData.body_template}
              onChange={(e) => setFormData(prev => ({ ...prev, body_template: e.target.value }))}
            />
            
            {currentChannel === 'sms' && (
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-muted-foreground">Characters: {formData.body_template.length}</span>
                <span className={formData.body_template.length > 160 ? 'text-destructive' : 'text-muted-foreground'}>
                  {Math.ceil(formData.body_template.length / 160)} SMS segment(s)
                </span>
              </div>
            )}
          </div>

          {/* Variables Panel */}
          <Card className="flex-shrink-0">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Variables</CardTitle>
                <div className="relative w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search variables..."
                    className="pl-8 h-8 text-sm"
                    value={variableSearch}
                    onChange={(e) => setVariableSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[200px]">
                <div className="space-y-4">
                  {Object.entries(groupedVariables).map(([group, vars]) => (
                    <div key={group}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {group}
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {vars.map((variable) => (
                          <TooltipProvider key={variable.key}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group text-sm"
                                  onClick={() => insertVariable(variable.key)}
                                >
                                  <span className="font-mono text-xs truncate">
                                    {`{{${variable.key}}}`}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyVariable(variable.key);
                                    }}
                                  >
                                    {copiedVar === variable.key ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px]">
                                <p className="font-medium">{variable.label}</p>
                                <p className="text-xs text-muted-foreground">{variable.description}</p>
                                <p className="text-xs mt-1">Sample: <code>{variable.sample}</code></p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex flex-col border rounded-lg overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between p-3 border-b bg-background">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="font-medium text-sm">Live Preview</span>
            </div>
            <Select value={previewContext} onValueChange={(v) => setPreviewContext(v as any)}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipment">Sample Shipment</SelectItem>
                <SelectItem value="task">Sample Task</SelectItem>
                <SelectItem value="release">Sample Release</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-auto">
            {renderPreview()}
          </div>
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Template Version History</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this template.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No version history available yet.
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <Card key={version.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline">Version {version.version_number}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(version)}
                        >
                          Restore
                        </Button>
                      </div>
                      {version.subject_template && (
                        <p className="text-sm mt-2 truncate">
                          Subject: {version.subject_template}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

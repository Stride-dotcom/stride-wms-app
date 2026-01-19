import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale } from 'lucide-react';

interface LegalLinksSectionProps {
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  onTermsOfServiceUrlChange: (value: string) => void;
  onPrivacyPolicyUrlChange: (value: string) => void;
}

export function LegalLinksSection({
  termsOfServiceUrl,
  privacyPolicyUrl,
  onTermsOfServiceUrlChange,
  onPrivacyPolicyUrlChange,
}: LegalLinksSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Legal & Policy Links
        </CardTitle>
        <CardDescription>
          Links to your organization's legal documents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="terms_url">Terms of Service URL</Label>
          <Input
            id="terms_url"
            type="url"
            placeholder="https://yourcompany.com/terms"
            value={termsOfServiceUrl}
            onChange={(e) => onTermsOfServiceUrlChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privacy_url">Privacy Policy URL</Label>
          <Input
            id="privacy_url"
            type="url"
            placeholder="https://yourcompany.com/privacy"
            value={privacyPolicyUrl}
            onChange={(e) => onPrivacyPolicyUrlChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

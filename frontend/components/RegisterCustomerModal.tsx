'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient, TenantCreate } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface RegisterCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
}

export function RegisterCustomerModal({
  open,
  onOpenChange,
  onRegistered,
}: RegisterCustomerModalProps) {
  const [clientName, setClientName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !contactEmail.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const body: TenantCreate = {
        client_name: clientName.trim(),
        contact_email: contactEmail.trim(),
        site_address: siteAddress.trim() || undefined,
      };
      await apiClient.createTenant(body);
      setClientName('');
      setContactEmail('');
      setSiteAddress('');
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register Continuous Monitoring Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cm-client-name">Customer Name</Label>
            <Input
              id="cm-client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. ACME Corporation"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cm-email">Contact Email</Label>
            <Input
              id="cm-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cm-address">Site Address (optional)</Label>
            <Input
              id="cm-address"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="e.g. 123 Main St"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

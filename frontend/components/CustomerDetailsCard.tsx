'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Edit2, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface CustomerDetailsCardProps {
  tenantName: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  siteAddress: string | null;
  premisesType: string | null;
  tenantId: string | null;
  onUpdate: () => void;
}

export function CustomerDetailsCard({
  tenantName,
  contactPerson,
  contactEmail,
  siteAddress,
  premisesType,
  tenantId,
  onUpdate,
}: CustomerDetailsCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [clientName, setClientName] = useState(tenantName ?? '');
  const [person, setPerson] = useState(contactPerson ?? '');
  const [email, setEmail] = useState(contactEmail ?? '');
  const [address, setAddress] = useState(siteAddress ?? '');
  const [premType, setPremType] = useState(premisesType ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!tenantId || !clientName.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiClient.updateTenant(tenantId, {
        client_name: clientName.trim(),
        contact_person: person.trim() || undefined,
        contact_email: email.trim(),
        site_address: address.trim() || undefined,
        premises_type: premType.trim() || undefined,
      });
      setEditOpen(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  };

  const hasData = tenantName || contactPerson || contactEmail || siteAddress || premisesType;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Customer Details</CardTitle>
          {tenantId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setClientName(tenantName ?? '');
                setPerson(contactPerson ?? '');
                setEmail(contactEmail ?? '');
                setAddress(siteAddress ?? '');
                setPremType(premisesType ?? '');
                setEditOpen(true);
              }}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              No customer assigned. Register a customer to link to this site.
            </p>
            {!tenantId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setClientName('');
                  setPerson('');
                  setEmail('');
                  setAddress('');
                  setPremType('');
                  setEditOpen(true);
                }}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Register Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
              <p className="text-sm font-medium">{tenantName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact Person</p>
              <p className="text-sm">{contactPerson ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="text-sm">{contactEmail ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Site Address</p>
              <p className="text-sm">{siteAddress ?? '—'}</p>
            </div>
            {premisesType && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Premises Type</p>
                <p className="text-sm">{premisesType}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tenantId ? 'Edit Customer Details' : 'Register Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cm-name">Customer Name</Label>
              <Input
                id="cm-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. ACME Corporation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cm-person">Contact Person</Label>
              <Input
                id="cm-person"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cm-email">Contact Email</Label>
              <Input
                id="cm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cm-address">Site Address</Label>
              <Input
                id="cm-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cm-premises">Premises Type</Label>
              <Input
                id="cm-premises"
                value={premType}
                onChange={(e) => setPremType(e.target.value)}
                placeholder="e.g. Office, Retail, Industrial"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tenantId ? 'Save' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

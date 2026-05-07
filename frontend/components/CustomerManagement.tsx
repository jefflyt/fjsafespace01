"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, TenantDetail as TenantDetailType, TenantSummary } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Users } from "lucide-react";

export function CustomerManagement() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetailType | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    client_name: "",
    contact_email: "",
    contact_person: "",
    site_address: "",
  });

  useEffect(() => {
    apiClient
      .getTenants()
      .then(setTenants)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const openDetail = async (tenant: TenantSummary) => {
    try {
      const detail = await apiClient.getTenant(tenant.id);
      setSelectedTenant(detail);
      setEditForm({
        client_name: detail.client_name,
        contact_email: detail.contact_email,
        contact_person: detail.contact_person || "",
        site_address: detail.site_address || "",
      });
      setIsEditing(false);
      setIsDetailOpen(true);
    } catch (err) {
      console.error("Failed to load tenant detail:", err);
    }
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setIsSaving(true);
    try {
      await apiClient.updateTenant(selectedTenant.id, editForm);
      const refreshed = await apiClient.getTenant(selectedTenant.id);
      setSelectedTenant(refreshed);
      setIsEditing(false);
      apiClient.getTenants().then(setTenants);
    } catch (err) {
      console.error("Failed to update tenant:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  return (
    <>
      {tenants.length === 0 ? (
        <div className="rounded-lg border bg-card animate-fade-in">
          <div className="py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="font-heading text-lg font-semibold">No customers yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Upload a CSV scan to create your first customer.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border animate-fade-in">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Site Address</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right font-mono">Scans</TableHead>
                <TableHead className="text-right font-mono">Sites</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(tenant)}
                >
                  <TableCell className="font-medium">{tenant.client_name}</TableCell>
                  <TableCell>{tenant.site_address || "—"}</TableCell>
                  <TableCell>{tenant.contact_person || "—"}</TableCell>
                  <TableCell>{tenant.contact_email}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="font-mono tabular-nums">{tenant.scan_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{tenant.site_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {isEditing ? "Edit Customer" : selectedTenant?.client_name}
            </DialogTitle>
            {!isEditing && (
              <DialogDescription>
                Customer details and recent uploads for {selectedTenant?.client_name}.
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedTenant && !isEditing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Client Name</p>
                  <p className="text-sm font-medium">{selectedTenant.client_name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                  <p className="text-sm">{selectedTenant.contact_email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contact Person</p>
                  <p className="text-sm">{selectedTenant.contact_person || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Site Address</p>
                  <p className="text-sm">{selectedTenant.site_address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Premises Type</p>
                  <p className="text-sm">{selectedTenant.premises_type || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-mono tabular-nums">
                    {new Date(selectedTenant.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {selectedTenant.scan_count} scan{selectedTenant.scan_count !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {selectedTenant.site_count} site{selectedTenant.site_count !== 1 ? "s" : ""}
                </Badge>
              </div>

              {selectedTenant.uploads.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent Uploads</p>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTenant.uploads.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.file_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono tabular-nums">
                            {new Date(u.uploaded_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.parse_status === "COMPLETE" ? "default" : "secondary"}>
                              {u.parse_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </div>
            </div>
          )}

          {selectedTenant && isEditing && (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-client-name">Client Name *</Label>
                  <Input
                    id="edit-client-name"
                    value={editForm.client_name}
                    onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contact">Contact Person</Label>
                  <Input
                    id="edit-contact"
                    value={editForm.contact_person}
                    onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-address">Site Address</Label>
                  <Input
                    id="edit-address"
                    value={editForm.site_address}
                    onChange={(e) => setEditForm({ ...editForm, site_address: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !editForm.client_name || !editForm.contact_email}>
                  <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

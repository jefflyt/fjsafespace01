"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X } from "lucide-react";

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
      // Refresh list
      apiClient.getTenants().then(setTenants);
    } catch (err) {
      console.error("Failed to update tenant:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading customers...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Site Address</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Scans</TableHead>
              <TableHead className="text-right">Sites</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No customers yet. Upload a CSV to create your first customer.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
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
                    <Badge variant="secondary">{tenant.scan_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{tenant.site_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Customer" : selectedTenant?.client_name}
            </DialogTitle>
          </DialogHeader>

          {selectedTenant && !isEditing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client Name</Label>
                  <p className="font-medium">{selectedTenant.client_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedTenant.contact_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Person</Label>
                  <p>{selectedTenant.contact_person || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Site Address</Label>
                  <p>{selectedTenant.site_address || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Premises Type</Label>
                  <p>{selectedTenant.premises_type || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{new Date(selectedTenant.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <Badge variant="secondary">
                  {selectedTenant.scan_count} scan{selectedTenant.scan_count !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {selectedTenant.site_count} site{selectedTenant.site_count !== 1 ? "s" : ""}
                </Badge>
              </div>

              {selectedTenant.uploads.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Recent Uploads</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTenant.uploads.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.file_name}</TableCell>
                          <TableCell>{new Date(u.uploaded_at).toLocaleDateString()}</TableCell>
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
            <div className="space-y-4">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

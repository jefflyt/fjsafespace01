"use client";

import { CustomerManagement } from "@/components/CustomerManagement";

export default function AdminCustomersPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage adhoc customers and their scan history. Customers with multiple
          scans can be converted to continuous monitoring in R2.
        </p>
      </div>

      <CustomerManagement />
    </div>
  );
}

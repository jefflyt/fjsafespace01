"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { apiClient, TenantSearchResult } from "@/lib/api";

interface CustomerLookupProps {
  onTenantSelected: (tenantId: string, clientName: string) => void;
  onRegisterNew: () => void;
}

export function CustomerLookup({ onTenantSelected, onRegisterNew }: CustomerLookupProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient.searchTenants(q);
      setResults(data);
    } catch (err) {
      console.error("Tenant search failed:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (tenant: TenantSearchResult) => {
    onTenantSelected(tenant.id, tenant.client_name);
    setShowDropdown(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by client name, contact person, or location..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          className="pl-10"
        />
      </div>

      {showDropdown && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-64 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <>
              {results.map((tenant) => (
                <button
                  key={tenant.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
                  onClick={() => handleSelect(tenant)}
                >
                  <div className="font-medium">
                    {tenant.client_name}
                    {tenant.site_address && (
                      <span className="text-muted-foreground font-normal">
                        {" "}· {tenant.site_address}
                      </span>
                    )}
                  </div>
                  {tenant.contact_person && (
                    <div className="text-sm text-muted-foreground">
                      {tenant.contact_person}
                    </div>
                  )}
                </button>
              ))}
              <button
                className="w-full text-left px-4 py-3 hover:bg-primary/5 text-primary"
                onClick={() => {
                  setShowDropdown(false);
                  onRegisterNew();
                }}
              >
                <UserPlus className="inline h-4 w-4 mr-2" />
                Register new customer
              </button>
            </>
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No matches found.
              </p>
              <button
                className="text-sm text-primary mt-1 hover:underline"
                onClick={() => {
                  setShowDropdown(false);
                  onRegisterNew();
                }}
              >
                Register new customer?
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

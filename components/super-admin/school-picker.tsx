"use client";

// Real school selector for platform config pages (Super Admin SA-4L). Reads the
// live Schools API (GET /api/super-admin/schools) — never db.saas.tenants. On
// first load it auto-selects the first school so the parent always resolves a
// real School → Tenant server-side.
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";

export function SchoolPicker({
  value,
  onChange,
  label = "School",
}: {
  value: string;
  onChange: (schoolId: string) => void;
  label?: string;
}) {
  const { data, loading, error } = useSchoolList({ page: 1, pageSize: 100, sort: "name", order: "asc" });

  useEffect(() => {
    if (!value && data.length > 0) onChange(data[0].id);
  }, [value, data, onChange]);

  if (loading) return <div className="h-9 w-56 animate-pulse rounded-md bg-surface-secondary" aria-hidden />;
  if (error) return <p className="text-xs text-error">Could not load schools: {error}</p>;
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No schools yet.</p>;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {data.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

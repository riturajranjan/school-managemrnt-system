"use client";

// Real PostgreSQL/API cutover (Phase 9F) — POSTs to /api/fees/structures.
// Real Class IDs (useClasses), real FeeCategory IDs (useFeeCategories) — no
// class-name/label authority, no tax/proration/installment-split UI (see the
// structures list page's scoping note).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClasses } from "@/lib/hooks/api/use-academics-foundation";
import { createFeeStructureRequest, useFeeCategories } from "@/lib/hooks/api/use-fees-api";
import { formatCurrency } from "@/lib/utils";

type ItemDraft = { categoryId: string; name: string; amount: string; dueDate: string };

export default function NewFeeStructurePage() {
  const router = useRouter();
  const { data: classes } = useClasses();
  const { data: categories } = useFeeCategories();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ItemDraft[]>([{ categoryId: "", name: "", amount: "", dueDate: "" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function toggleClass(id: string) {
    setClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setErrors([]);
    if (!name.trim()) return setErrors(["Structure name is required."]);
    if (classIds.size === 0) return setErrors(["Select at least one class."]);
    const parsedItems = items.filter((i) => i.categoryId && i.amount && i.dueDate);
    if (parsedItems.length === 0) return setErrors(["Add at least one fee item."]);

    setSaving(true);
    const res = await createFeeStructureRequest({
      name: name.trim(),
      description: description.trim() || undefined,
      classIds: [...classIds],
      items: parsedItems.map((i, idx) => ({ categoryId: i.categoryId, name: i.name.trim() || undefined, amount: Number(i.amount), dueDate: i.dueDate, order: idx })),
    });
    setSaving(false);
    if (!res.success) return setErrors([res.error.message]);
    router.push(`/fees/structures/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New fee structure</h1>
        <p className="text-xs text-muted-foreground">Define fee items and the classes they apply to</p>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/8 p-sm text-xs text-error">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-3.5" /> Fix these before saving
          </p>
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Details</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="structure-name">Name</Label>
            <Input id="structure-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 5 — Annual Fee Plan" />
          </div>
          <div>
            <Label htmlFor="structure-desc">Description</Label>
            <Input id="structure-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Applicable classes</h2>
        <div className="flex flex-wrap gap-xs">
          {classes.map((c) => (
            <label key={c.id} className={`flex items-center gap-1.5 rounded-md border px-sm py-1.5 text-sm ${classIds.has(c.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"}`}>
              <Checkbox checked={classIds.has(c.id)} onCheckedChange={() => toggleClass(c.id)} />
              {c.name}
            </label>
          ))}
          {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes found for the current session.</p>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Fee items</h2>
          <Badge tone="neutral">Total {formatCurrency(total)}</Badge>
        </div>
        <div className="flex flex-col gap-sm">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 gap-xs rounded-md border border-border p-sm sm:grid-cols-[1.5fr_1fr_0.8fr_1fr_auto]">
              <Select value={item.categoryId} onValueChange={(v) => updateItem(index, { categoryId: v })}>
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} placeholder="Label (optional)" />
              <Input type="number" min={0} value={item.amount} onChange={(e) => updateItem(index, { amount: e.target.value })} placeholder="Amount" />
              <Input type="date" value={item.dueDate} onChange={(e) => updateItem(index, { dueDate: e.target.value })} />
              <Button variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} disabled={items.length === 1}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-sm" onClick={() => setItems((prev) => [...prev, { categoryId: "", name: "", amount: "", dueDate: "" }])}>
          <Plus className="size-3.5" />
          Add item
        </Button>
      </div>

      <div className="sticky bottom-16 left-0 right-0 flex justify-end gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button variant="outline" onClick={() => router.push("/fees/structures")}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={handleSave}>
          Save structure
        </Button>
      </div>
    </div>
  );
}

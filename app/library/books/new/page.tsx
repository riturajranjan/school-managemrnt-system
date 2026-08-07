"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useSisStore } from "@/lib/hooks/use-store";
import {
  addCopy,
  createBook,
  findDuplicateIsbn,
} from "@/lib/services/book-service";
import { moneyFromMajor } from "@/lib/finance/money";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewBookPage() {
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();

  const [title, setTitle] = useState("");
  const [isbn, setIsbn] = useState("");
  const [accession, setAccession] = useState("");
  const [authorId, setAuthorId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [language, setLanguage] = useState("English");
  const [replacement, setReplacement] = useState("300");
  const [copies, setCopies] = useState("2");
  const [referenceOnly, setReferenceOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDupe, setConfirmDupe] = useState(false);

  if (!can("library.manageCatalogue"))
    return (
      <PermissionDenied
        action="add books to the catalogue"
        role={roleLabels[role]}
      />
    );

  const dupe = isbn.trim() ? findDuplicateIsbn(isbn) : undefined;

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (!accession.trim()) return setError("Accession number is required.");
    if (dupe && !confirmDupe)
      return setError(
        `A book with this ISBN already exists: "${dupe.title}". Confirm to add anyway.`,
      );

    const result = createBook(
      {
        libraryId: db.libraries[0]?.id ?? "lib-main",
        title: title.trim(),
        isbn: isbn.trim() || undefined,
        accessionNumber: accession.trim(),
        authorId: authorId || undefined,
        coAuthorIds: [],
        categoryId: categoryId || undefined,
        language,
        keywords: [],
        referenceOnly,
        replacementCost: moneyFromMajor(Number(replacement) || 0, "INR"),
      },
      { name: "Librarian", role: roleLabels[role] },
      { allowDuplicateIsbn: confirmDupe },
    );
    if (!result.ok) return setError(result.error);
    const copyCount = Math.max(0, Math.min(50, Number(copies) || 0));
    for (let i = 0; i < copyCount; i++) {
      addCopy(
        { bookId: result.book!.id, libraryId: result.book!.libraryId },
        { name: "Librarian", role: roleLabels[role] },
      );
    }
    router.push(`/library/books/${result.book!.id}`);
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button
          asChild
          size="icon"
          variant="ghost"
          aria-label="Back to catalogue">
          <Link href="/library/catalog">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Add book</h1>
          <p className="text-xs text-muted-foreground">
            Create a catalogue record, then add physical copies
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Malgudi Days"
          />
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="isbn">ISBN</Label>
            <Input
              id="isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="978-…"
            />
            {dupe && (
              <p className="text-xs text-warning">
                Possible duplicate: “{dupe.title}”
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accession">Accession number *</Label>
            <Input
              id="accession"
              value={accession}
              onChange={(e) => setAccession(e.target.value)}
              placeholder="ACC-00001"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Author</Label>
            <Select value={authorId} onValueChange={setAuthorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select author" />
              </SelectTrigger>
              <SelectContent>
                {db.authors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {db.bookCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replacement">Replacement cost (₹)</Label>
            <Input
              id="replacement"
              type="number"
              inputMode="numeric"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="copies">Initial copies</Label>
            <Input
              id="copies"
              type="number"
              inputMode="numeric"
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
          <span className="text-sm text-foreground">
            Reference only (not for lending)
          </span>
          <Switch checked={referenceOnly} onCheckedChange={setReferenceOnly} />
        </label>

        {dupe && (
          <label className="flex items-center justify-between gap-sm rounded-md border border-warning/40 bg-warning/8 p-sm">
            <span className="text-sm text-warning">
              Add despite the possible ISBN duplicate
            </span>
            <Switch checked={confirmDupe} onCheckedChange={setConfirmDupe} />
          </label>
        )}

        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-xs">
          <Button asChild variant="outline">
            <Link href="/library/catalog">Cancel</Link>
          </Button>
          <Button onClick={submit}>
            <BookPlus className="size-4" /> Create book
          </Button>
        </div>
      </div>
    </div>
  );
}

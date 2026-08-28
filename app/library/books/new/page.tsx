"use client";

// Add book (Phase 9N) — real PostgreSQL/API cutover.
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createLibraryBookRequest } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";

const schema = z.object({
  title: z.string().trim().min(1, "Required"),
  subtitle: z.string().trim().optional(),
  author: z.string().trim().min(1, "Required"),
  isbn: z.string().trim().optional(),
  publisher: z.string().trim().optional(),
  publicationYear: z.number().int().optional(),
  category: z.string().trim().optional(),
  language: z.string().trim().optional(),
  description: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewBookPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!capabilitiesLoading && !hasServerPermission("library.manage")) {
    return (
      <PermissionDenied
        action="add books to the catalogue"
        role={roleLabels[role]}
        backHref="/library/books"
      />
    );
  }

  async function onSubmit(values: FormValues) {
    const res = await createLibraryBookRequest({
      title: values.title,
      subtitle: values.subtitle || undefined,
      author: values.author,
      isbn: values.isbn || undefined,
      publisher: values.publisher || undefined,
      publicationYear: values.publicationYear,
      category: values.category || undefined,
      language: values.language || undefined,
      description: values.description || undefined,
    });
    if (!res.success) {
      form.setError("root", { message: res.error.message });
      return;
    }
    router.push(`/library/books/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <Link
        href="/library/books"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" />
        Back to catalogue
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">Add book</h1>
        <p className="text-xs text-muted-foreground">
          Title-level catalogue record — physical copies are added on the
          book&apos;s page
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex  flex-col gap-sm">
        {form.formState.errors.root && (
          <p className="text-xs text-error">
            {form.formState.errors.root.message}
          </p>
        )}
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...form.register("title")} />
          <FieldError>{form.formState.errors.title?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input id="subtitle" {...form.register("subtitle")} />
        </div>
        <div>
          <Label htmlFor="author">Author</Label>
          <Input id="author" {...form.register("author")} />
          <FieldError>{form.formState.errors.author?.message}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="isbn">ISBN</Label>
            <Input id="isbn" {...form.register("isbn")} />
          </div>
          <div>
            <Label htmlFor="publisher">Publisher</Label>
            <Input id="publisher" {...form.register("publisher")} />
          </div>
          <div>
            <Label htmlFor="publicationYear">Publication year</Label>
            <Input
              id="publicationYear"
              type="number"
              {...form.register("publicationYear", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...form.register("category")} />
          </div>
          <div>
            <Label htmlFor="language">Language</Label>
            <Input id="language" {...form.register("language")} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" {...form.register("description")} />
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Add book
        </Button>
      </form>
    </div>
  );
}

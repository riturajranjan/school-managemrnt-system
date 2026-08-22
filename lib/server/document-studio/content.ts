// Template content validation (Phase 9V). contentJson is a plain declarative
// structure consumed as-is by the existing TemplateBuilder/DocumentSheet/
// IdCard presentational components — there is no dangerouslySetInnerHTML
// anywhere in that rendering pipeline (React text-interpolation only), so
// there is no HTML-injection surface to sanitize. What IS validated here is a
// defense-in-depth content policy: known section types only, bounded text
// lengths, and a reject-list for obviously malicious markup in free-text
// fields (customText / signatoryName) in case a future renderer ever trusts
// this JSON more literally than today's.
import { HttpError } from "@/lib/server/api/guard";
import { z } from "zod";
import { assertKnownMergeFields, type DocSubjectType } from "./merge-fields";

const SECTION_TYPES = [
  "logo", "school-name", "address", "contact", "photo", "name", "admission-number",
  "employee-id", "class", "section", "dob", "guardian", "blood-group", "validity",
  "qr", "signature", "seal", "document-number", "custom-text", "footer", "body", "subject", "recipient",
] as const;

const PAPER_SIZES = ["cr80", "a4", "a5", "letter", "legal", "cert-portrait", "cert-landscape", "thermal", "custom-card"] as const;
const ID_CARD_STYLES = ["campus-modern", "classic-school", "minimal-institutional", "premium-teal", "junior-friendly"] as const;

const UNSAFE_PATTERN = /<script|<iframe|javascript:|on\w+\s*=/i;

const safeText = (max: number) =>
  z.string().trim().max(max).refine((v) => !UNSAFE_PATTERN.test(v), { message: "Unsafe markup is not allowed" });

export const templateSectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  label: z.string().trim().max(60),
  show: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  fontSize: z.enum(["xs", "sm", "base", "lg", "xl"]),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]),
  color: z.string().trim().max(20).optional(),
  order: z.number().int().min(0),
  customText: safeText(500).optional(),
});

export const contentJsonSchema = z.object({
  paperSize: z.enum(PAPER_SIZES),
  orientation: z.enum(["portrait", "landscape"]),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Accent must be a #RRGGBB hex color"),
  style: z.enum(ID_CARD_STYLES).optional(),
  sections: z.array(templateSectionSchema).max(30),
  variables: z.array(z.string().min(1)).max(20),
  signatoryName: safeText(120).optional(),
});

export type ContentJson = z.infer<typeof contentJsonSchema>;

/** Full template-content validation: structural (zod) + merge-field allowlist
 * (must be known and applicable to subjectType) + at least one visible
 * section. Used on every create/update, and again before activation. */
export function validateTemplateContent(subjectType: DocSubjectType, raw: unknown): ContentJson {
  const content = contentJsonSchema.parse(raw);
  if (!content.sections.some((s) => s.show)) throw new HttpError("UNSAFE_TEMPLATE_CONTENT", "Template has no visible sections");
  assertKnownMergeFields(subjectType, content.variables);
  return content;
}

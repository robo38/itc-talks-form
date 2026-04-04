import { z } from "zod";

const genericTripettoSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  submission: z.record(z.string(), z.unknown()).optional(),
  answers: z.array(z.unknown()).optional(),
  respondent: z.record(z.string(), z.unknown()).optional(),
  fullName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
}).passthrough();

export interface ExtractedTripettoFields {
  fullName: string;
  email: string;
  phone: string | null;
  customFields: Record<string, string>;
  rawAnswers: Array<{ key: string; value: string }>;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getNested(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, segment) => {
    if (typeof cursor === "object" && cursor !== null && !Array.isArray(cursor)) {
      return (cursor as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function getFirst(source: unknown, candidates: string[]): string | null {
  for (const path of candidates) {
    const found = asString(getNested(source, path));
    if (found) {
      return found;
    }
  }

  return null;
}

function extractAnswerPairs(payload: unknown): Array<{ key: string; value: string }> {
  const answerCandidates = [
    getNested(payload, "data.answers"),
    getNested(payload, "submission.answers"),
    getNested(payload, "answers"),
  ];

  const firstArray = answerCandidates.find((entry) => Array.isArray(entry));
  if (!Array.isArray(firstArray)) {
    return [];
  }

  return firstArray
    .map((item): { key: string; value: string } | null => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const objectItem = item as Record<string, unknown>;
        const key =
          getFirst(objectItem, ["question.label", "question.name", "label", "name", "key"]) ??
          "field";

        const rawValue =
          objectItem.value ?? objectItem.answer ?? objectItem.text ?? objectItem.choice ?? objectItem.result;

        if (Array.isArray(rawValue)) {
          const merged = rawValue.map((part) => asString(part)).filter((part): part is string => Boolean(part)).join(", ");
          return merged ? { key, value: merged } : null;
        }

        const value = asString(rawValue) ?? (rawValue ? JSON.stringify(rawValue) : null);
        return value ? { key, value } : null;
      }

      const flat = asString(item);
      if (!flat) {
        return null;
      }

      return { key: "field", value: flat };
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
}

function collectCustomFields(payload: unknown, rawAnswers: Array<{ key: string; value: string }>): Record<string, string> {
  const customFields: Record<string, string> = {};

  for (const answer of rawAnswers) {
    const normalized = answer.key.trim().toLowerCase();
    if (["email", "e-mail", "full name", "name", "phone", "telephone"].includes(normalized)) {
      continue;
    }

    customFields[answer.key] = answer.value;
  }

  const dataRecord = toRecord(getNested(payload, "data.custom"));
  for (const [key, value] of Object.entries(dataRecord)) {
    const parsed = asString(value) ?? JSON.stringify(value);
    if (parsed) {
      customFields[key] = parsed;
    }
  }

  return customFields;
}

export function extractTripettoFields(payload: unknown): ExtractedTripettoFields {
  const parsed = genericTripettoSchema.parse(payload);

  const fullName =
    getFirst(parsed, [
      "data.respondent.name",
      "submission.respondent.name",
      "respondent.name",
      "data.contact.name",
      "fullName",
      "name",
    ]) ?? "Attendee";

  const email =
    getFirst(parsed, [
      "data.respondent.email",
      "submission.respondent.email",
      "respondent.email",
      "data.contact.email",
      "email",
    ]) ??
    "";

  if (!z.email().safeParse(email).success) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["email"],
        message: "A valid attendee email is required",
      },
    ]);
  }

  const phone =
    getFirst(parsed, [
      "data.respondent.phone",
      "submission.respondent.phone",
      "respondent.phone",
      "data.contact.phone",
      "phone",
    ]) ?? null;

  const rawAnswers = extractAnswerPairs(parsed);
  const customFields = collectCustomFields(parsed, rawAnswers);

  return {
    fullName,
    email,
    phone,
    customFields,
    rawAnswers,
  };
}

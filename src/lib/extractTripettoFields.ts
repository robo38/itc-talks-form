import { z } from "zod";

const genericTripettoSchema = z.object({}).passthrough();

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

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
interface AnswerPair {
  key: string;
  value: string;
}

function extractAnswerPairsFromAnswers(payload: unknown): AnswerPair[] {
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
    .map((item): AnswerPair | null => {
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
    .filter((entry): entry is AnswerPair => Boolean(entry));
}

function asFieldValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const merged = value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry)).join(", ");
    return merged || null;
  }

  return asString(value) ?? (value ? JSON.stringify(value) : null);
}

function extractValueFromTripettoField(field: Record<string, unknown>): string | null {
  const directCandidates: unknown[] = [
    field.value,
    field.string,
    field.text,
    field.email,
    field.number,
    field.numeric,
    field.phone,
    field.boolean,
    field.date,
    field.datetime,
  ];

  const slot = asString(field.slot);
  if (slot && slot in field) {
    directCandidates.unshift(field[slot]);
  }

  for (const candidate of directCandidates) {
    const parsed = asFieldValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const forms = Array.isArray(field.forms) ? field.forms : [];
  for (const form of forms) {
    if (typeof form !== "object" || form === null || Array.isArray(form)) {
      continue;
    }

    const formRecord = form as Record<string, unknown>;
    const value = extractValueFromTripettoField(formRecord);
    if (value) {
      return value;
    }
  }

  return null;
}

function extractAnswerPairsFromFieldsArray(payload: unknown): AnswerPair[] {
  const fieldCandidates = [
    getNested(payload, "fields"),
    getNested(payload, "data.fields"),
    getNested(payload, "submission.fields"),
    getNested(payload, "result.fields"),
    getNested(payload, "data.result.fields"),
  ];

  const firstArray = fieldCandidates.find((entry) => Array.isArray(entry));
  if (!Array.isArray(firstArray)) {
    return [];
  }

  return firstArray
    .map((item, index): AnswerPair | null => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }

      const objectItem = item as Record<string, unknown>;
      const key =
        getFirst(objectItem, ["name", "label", "question.label", "question.name", "slot", "key"]) ??
        `field_${index + 1}`;

      const value = extractValueFromTripettoField(objectItem);
      if (!value) {
        return null;
      }

      return { key, value };
    })
    .filter((entry): entry is AnswerPair => Boolean(entry));
}

function extractTopLevelAnswerPairs(payload: unknown): AnswerPair[] {
  const root = toRecord(payload);
  const ignoredKeys = new Set([
    "id",
    "created",
    "fingerprint",
    "stencil",
    "event",
    "type",
    "submissionId",
    "formId",
    "fields",
    "answers",
    "data",
    "submission",
  ]);

  return Object.entries(root)
    .map(([key, value]): AnswerPair | null => {
      if (ignoredKeys.has(key)) {
        return null;
      }

      const parsed = asFieldValue(value);
      if (!parsed) {
        return null;
      }

      return { key, value: parsed };
    })
    .filter((entry): entry is AnswerPair => Boolean(entry));
}

function mergeAnswerPairs(pairs: AnswerPair[]): AnswerPair[] {
  const seen = new Set<string>();
  const merged: AnswerPair[] = [];

  for (const pair of pairs) {
    const normalized = normalizeKey(pair.key);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(pair);
  }

  return merged;
}

function findByKey(pairs: AnswerPair[], predicate: (normalizedKey: string) => boolean): string | null {
  for (const pair of pairs) {
    if (predicate(normalizeKey(pair.key))) {
      return pair.value;
    }
  }

  return null;
}

function isEmailLikeKey(normalizedKey: string): boolean {
  return normalizedKey.includes("email");
}

function isPhoneLikeKey(normalizedKey: string): boolean {
  return (
    normalizedKey.includes("phone") ||
    normalizedKey.includes("telephone") ||
    normalizedKey.includes("mobile") ||
    normalizedKey.includes("whatsapp")
  );
}

function isFirstNameKey(normalizedKey: string): boolean {
  return normalizedKey.includes("first name") || normalizedKey === "firstname";
}

function isLastNameKey(normalizedKey: string): boolean {
  return normalizedKey.includes("last name") || normalizedKey === "lastname";
}

function isFullNameKey(normalizedKey: string): boolean {
  return (
    normalizedKey === "name" ||
    normalizedKey.includes("full name") ||
    normalizedKey.includes("your name")
  );
}

function isIdentityFieldKey(normalizedKey: string): boolean {
  return (
    isEmailLikeKey(normalizedKey) ||
    isPhoneLikeKey(normalizedKey) ||
    isFirstNameKey(normalizedKey) ||
    isLastNameKey(normalizedKey) ||
    isFullNameKey(normalizedKey)
  );
}

function collectCustomFields(payload: unknown, rawAnswers: AnswerPair[]): Record<string, string> {
  const customFields: Record<string, string> = {};

  for (const answer of rawAnswers) {
    const normalized = normalizeKey(answer.key);
    if (isIdentityFieldKey(normalized)) {
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
  const answerPairsFromAnswers = extractAnswerPairsFromAnswers(parsed);
  const answerPairsFromFields = extractAnswerPairsFromFieldsArray(parsed);
  const topLevelPairs = answerPairsFromAnswers.length === 0 && answerPairsFromFields.length === 0 ? extractTopLevelAnswerPairs(parsed) : [];

  const rawAnswers = mergeAnswerPairs([...answerPairsFromFields, ...answerPairsFromAnswers, ...topLevelPairs]);

  const firstName =
    findByKey(rawAnswers, isFirstNameKey) ??
    getFirst(parsed, ["data.respondent.firstName", "submission.respondent.firstName", "respondent.firstName"]);

  const lastName =
    findByKey(rawAnswers, isLastNameKey) ??
    getFirst(parsed, ["data.respondent.lastName", "submission.respondent.lastName", "respondent.lastName"]);

  const explicitFullName =
    getFirst(parsed, [
      "data.respondent.name",
      "submission.respondent.name",
      "respondent.name",
      "data.contact.name",
      "fullName",
      "name",
    ]) ?? findByKey(rawAnswers, isFullNameKey);

  const combinedName = [firstName, lastName]
    .map((part) => (part ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");

  const fullName = explicitFullName ?? (combinedName || "Attendee");

  const email =
    getFirst(parsed, [
      "data.respondent.email",
      "submission.respondent.email",
      "respondent.email",
      "data.contact.email",
      "email",
    ]) ??
    findByKey(rawAnswers, isEmailLikeKey) ??
    "";

  if (!z.string().email().safeParse(email).success) {
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
    ]) ??
    findByKey(rawAnswers, isPhoneLikeKey) ??
    null;

  const customFields = collectCustomFields(parsed, rawAnswers);

  return {
    fullName,
    email,
    phone,
    customFields,
    rawAnswers,
  };
}

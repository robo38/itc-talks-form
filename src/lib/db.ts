import { connectToDatabase } from "@/lib/mongodb";
import { RegistrationModel, type RegistrationDocument } from "@/lib/models/Registration";

type CheckInStatus = "registered" | "checked_in";

export interface RegistrationRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  registrationId: string;
  ticketToken: string;
  qrValue: string;
  checkInStatus: CheckInStatus;
  checkedInAt: Date | null;
  checkedInBy: string | null;
  tripettoMetadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  customFields: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateRegistrationInput {
  fullName: string;
  email: string;
  phone: string | null;
  registrationId: string;
  ticketToken: string;
  qrValue: string;
  checkInStatus?: CheckInStatus;
  checkedInAt?: Date | null;
  checkedInBy?: string | null;
  tripettoMetadata?: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  customFields?: Record<string, string>;
}

interface UpdateRegistrationInput {
  checkInStatus?: CheckInStatus;
  checkedInAt?: Date | null;
  checkedInBy?: string | null;
}

function toRegistrationRecord(document: RegistrationDocument): RegistrationRecord {
  const payload = document.rawPayload;
  const custom = document.customFields;
  const metadata = document.tripettoMetadata;

  return {
    id: document._id.toString(),
    fullName: document.fullName,
    email: document.email,
    phone: document.phone ?? null,
    registrationId: document.registrationId,
    ticketToken: document.ticketToken,
    qrValue: document.qrValue,
    checkInStatus: document.checkInStatus,
    checkedInAt: document.checkedInAt ?? null,
    checkedInBy: document.checkedInBy ?? null,
    tripettoMetadata: typeof metadata === "object" && metadata ? (metadata as Record<string, unknown>) : {},
    rawPayload: typeof payload === "object" && payload ? (payload as Record<string, unknown>) : {},
    customFields: typeof custom === "object" && custom ? (custom as Record<string, string>) : {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export const db = {
  registration: {
    async create(args: { data: CreateRegistrationInput }): Promise<RegistrationRecord> {
      await connectToDatabase();
      const created = await RegistrationModel.create({
        ...args.data,
        customFields: args.data.customFields ?? {},
        tripettoMetadata: args.data.tripettoMetadata ?? {},
      });

      return toRegistrationRecord(created as unknown as RegistrationDocument);
    },

    async findUnique(args: { where: { ticketToken: string } }): Promise<RegistrationRecord | null> {
      await connectToDatabase();
      const found = await RegistrationModel.findOne({ ticketToken: args.where.ticketToken }).exec();
      return found ? toRegistrationRecord(found as unknown as RegistrationDocument) : null;
    },

    async update(args: { where: { id: string }; data: UpdateRegistrationInput }): Promise<RegistrationRecord> {
      await connectToDatabase();
      const updated = await RegistrationModel.findByIdAndUpdate(args.where.id, args.data, { new: true }).exec();

      if (!updated) {
        throw new Error("Registration not found");
      }

      return toRegistrationRecord(updated as unknown as RegistrationDocument);
    },

    async count(args?: { where?: Partial<Pick<RegistrationRecord, "checkInStatus">> }): Promise<number> {
      await connectToDatabase();
      return RegistrationModel.countDocuments(args?.where ?? {});
    },

    async findMany(args?: { orderBy?: { createdAt?: "asc" | "desc" }; take?: number }): Promise<RegistrationRecord[]> {
      await connectToDatabase();
      const sortDirection = args?.orderBy?.createdAt === "asc" ? 1 : -1;
      const limit = args?.take ?? 0;

      const rows = await RegistrationModel.find({})
        .sort({ createdAt: sortDirection })
        .limit(limit)
        .exec();

      return rows.map((row) => toRegistrationRecord(row as unknown as RegistrationDocument));
    },
  },
};

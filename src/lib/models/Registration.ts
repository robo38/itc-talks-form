import mongoose, { type InferSchemaType, type Model } from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, default: null },
    registrationId: { type: String, required: true, unique: true, index: true },
    ticketToken: { type: String, required: true, unique: true, index: true },
    qrValue: { type: String, required: true },
    checkInStatus: {
      type: String,
      enum: ["registered", "checked_in"],
      default: "registered",
      index: true,
    },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: null },
    tripettoMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

registrationSchema.index({ createdAt: -1 });

export type RegistrationDocument = InferSchemaType<typeof registrationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const RegistrationModel: Model<RegistrationDocument> =
  (mongoose.models.Registration as Model<RegistrationDocument> | undefined) ??
  mongoose.model<RegistrationDocument>("Registration", registrationSchema);

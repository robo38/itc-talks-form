import mongoose from "mongoose";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }

  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const globalCache = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache;
};

const cache = globalCache.__mongooseCache ?? { conn: null, promise: null };
globalCache.__mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const mongoUri = getMongoUri();
    const options: mongoose.ConnectOptions = {
      dbName: process.env.MONGODB_DB_NAME?.trim() || undefined,
      maxPoolSize: 10,
      autoIndex: true,
    };

    cache.promise = mongoose.connect(mongoUri, options);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

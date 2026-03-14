declare module "@prisma/client" {
  export enum AlertCondition {
    ABOVE = "ABOVE",
    BELOW = "BELOW",
    PERCENT_CHANGE = "PERCENT_CHANGE",
  }

  export class PrismaClient {
    user: {
      findUnique: (...args: any[]) => Promise<any>;
      upsert: (...args: any[]) => Promise<any>;
    };
    userPreferences: {
      upsert: (...args: any[]) => Promise<any>;
    };
    priceAlert: {
      findMany: (...args: any[]) => Promise<any[]>;
      create: (...args: any[]) => Promise<any>;
      deleteMany: (...args: any[]) => Promise<{ count: number }>;
    };
    notification: {
      findMany: (...args: any[]) => Promise<any[]>;
      create: (...args: any[]) => Promise<any>;
      updateMany: (...args: any[]) => Promise<{ count: number }>;
    };
    constructor(options?: any);
  }
}

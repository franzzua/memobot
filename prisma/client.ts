import {PrismaClient} from "./client/client.js";
import {Pool} from 'pg'
import {PrismaPg} from '@prisma/adapter-pg'

export function prismaFactory(): PrismaClient {
    const pool = new Pool({connectionString: process.env.DATABASE_URL})
    const adapter = new PrismaPg(pool)
    return new PrismaClient({adapter});
}
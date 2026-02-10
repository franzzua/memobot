import {PrismaClient} from "./client/client";
import {Pool} from 'pg'
import {PrismaPg} from '@prisma/adapter-pg'

export function prismaFactory() {
    const pool = new Pool({connectionString: process.env.DATABASE_URL})
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({adapter});
    return prisma;
}
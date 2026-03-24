import {PrismaClient} from "./client/client.js";
import {Pool} from 'pg'
import {PrismaPg} from '@prisma/adapter-pg'

export function prismaFactory(): PrismaClient {
    const pool = new Pool({
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        database: process.env.DATABASE_DB,
    })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({adapter});
}
export { PrismaClient, type Word, type Chat, type Message, type Prisma } from "./client/client.js";

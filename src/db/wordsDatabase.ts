import {resolve, singleton} from "@cmmn/core";
import {PrismaClient, type Word} from "../../prisma/client";

@singleton()
export class WordsDatabase {
    private prisma = resolve(PrismaClient)

    public async getWord(word: string): Promise<Word> {
        const res = await this.prisma.word.findFirst({
            where: {
                word: {
                    equals: word,
                    mode: "insensitive",
                }
            }
        });
        console.log(res);
        return res;
    }

    public async pickTopForLevel(level: string, n: number): Promise<Word[]> {
        if (n <= 0) return [];
        return this.prisma.$queryRaw<Word[]>`
            SELECT *
            FROM "Word"
            ORDER BY
                "satFrequency" DESC NULLS LAST,
                "frequency"    DESC NULLS LAST,
                CASE WHEN "level" = ${level} THEN 0 ELSE 1 END
            LIMIT ${n}
        `;
    }
}
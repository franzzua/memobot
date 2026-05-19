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

    public async getByIds(ids: string[]): Promise<Map<string, Word>> {
        if (ids.length === 0) return new Map();
        const rows = await this.prisma.word.findMany({where: {id: {in: ids}}});
        return new Map(rows.map(w => [w.id, w]));
    }

    public async setVoice(id: string, voice: Buffer): Promise<void> {
        await this.prisma.word.update({where: {id}, data: {voice}});
    }

    public async setTranscription(id: string, transcription: string): Promise<void> {
        await this.prisma.word.update({where: {id}, data: {transcription}});
    }

    public async setExample(id: string, example: string): Promise<void> {
        await this.prisma.word.update({where: {id}, data: {example}});
    }

    public async setImage(id: string, image: Buffer): Promise<void> {
        await this.prisma.word.update({where: {id}, data: {image}});
    }
}
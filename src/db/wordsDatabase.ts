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
}
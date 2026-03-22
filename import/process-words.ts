import {prismaFactory} from "../prisma/client";

const client = prismaFactory();

const words = await client.word.findMany({
    where: {
        level: null,
        frequency: null
    },
    take: 10
});
console.log(words);
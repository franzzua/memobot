import {PrismaClient, prismaFactory} from './client'
import quizData from "./sat_tests.json";
const prisma = prismaFactory()

export function seedData() {
    return Promise.all([
        seedQuiz()
    ]);
}
export async function seedQuiz() {
    if ((await prisma.quiz.count()) > 0)
        return;
    return prisma.quiz.createMany({
        data: quizData.map(q => ({
            question: q.question,
            answers: q.options,
            attachment: new Buffer(q.addition, 'base64')
        })),
        skipDuplicates: true, // Optional
    })
}

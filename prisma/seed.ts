import {PrismaClient, prismaFactory} from './client'
import quizData from "../sat_tests.json";
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
        data: quizData.map(q => {
            return {
                question: q.question,
                answers: q.options,
                correct: q.correct,
                table_md: q.addition,
                attachment: q.image
                    ? Buffer.from(q.image.split(',')[1], 'base64')
                    : null,
                index: q.index
            };
        }),
        skipDuplicates: true, // Optional
    })
}

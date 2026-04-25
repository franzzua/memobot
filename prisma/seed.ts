import {PrismaClient, prismaFactory} from './client'
import quizData from "../sat_tests.json" with {type: "json"};
import nlp from 'compromise';
const prisma = prismaFactory()

function getInflectedForms(word: string): RegExp {
    const forms = new Set([word.toLowerCase()])
    const doc = nlp(word)

    const conjugated = doc.verbs().conjugate()[0]
    if (conjugated) {
        Object.values(conjugated).forEach(f => f && forms.add((f as string).toLowerCase()))
    }

    const plural = doc.nouns().toPlural().text()
    if (plural) forms.add(plural.toLowerCase())

    const pattern = [...forms]
        .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
    return new RegExp(`\\b(${pattern})\\b`, 'i')
}

export async function seedData() {
    await seedQuiz();
    await seedSatFrequency();
}

export async function seedSatFrequency() {
    const computed = await prisma.word.count({ where: { satFrequency: null } });
    if (computed == 0) return;

    const words = await prisma.word.findMany({ where: { satFrequency: null } });
    const quizzes = await prisma.quiz.findMany();

    await Promise.all(words.map(async (w) => {
        const re = getInflectedForms(w.word);
        let score = 0;

        for (const quiz of quizzes) {
            if (re.test(quiz.question)) score += 1;
            for (const answer of (quiz.answers as string[])) {
                if (re.test(answer)) score += 2;
            }
        }

        await prisma.word.update({ where: { id: w.id }, data: { satFrequency: score } });
    }));
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

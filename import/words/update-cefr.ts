import * as fs from 'fs';
import * as path from 'path';
import {resolve, Fn} from "@cmmn/core";
import {AiModel} from "../../src/services/ai-model";

interface WordEntry {
    index: number;
    word: string;
    description: string;
    level?: string;
    frequency?: number;
}

const LIST_PATH = '/mnt/dev/memobot/import/words/list.json';
const CEFR_CSV_PATH = '/mnt/dev/memobot/import/cefrj-vocabulary-profile-1.5.csv';

function parseCsv(content: string) {
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    const headwordIdx = headers.indexOf('headword');
    const levelIdx = headers.indexOf('CEFR');

    const map = new Map<string, string>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV split (handles basic cases)
        const parts = line.split(',');
        if (parts.length <= Math.max(headwordIdx, levelIdx)) continue;

        const headwords = parts[headwordIdx].split('/');
        const level = parts[levelIdx];

        for (const hw of headwords) {
            const cleanHw = hw.trim().toLowerCase();
            // If multiple levels exist for the same word, we take the first one found
            // or we could implement a priority (A1 < A2 < B1...)
            if (!map.has(cleanHw)) {
                map.set(cleanHw, level);
            }
        }
    }
    return map;
}

function normalizeWord(word: string): string[] {
    const results: string[] = [];
    const base = word.toLowerCase().trim();
    results.push(base);

    // Handle (PRE)SUPPOSITION -> presupposition, supposition
    if (base.includes('(')) {
        results.push(base.replace(/[\(\)]/g, ''));
        results.push(base.replace(/\(.*?\)/g, '').trim());
    }

    // Handle FRUITFUL/FRUITLESS
    if (base.includes('/')) {
        base.split('/').forEach(p => results.push(p.trim()));
    }

    // Handle phrases: GRAPPLE WITH -> grapple
    if (base.includes(' ')) {
        results.push(base.split(' ')[0]);
    }

    return Array.from(new Set(results.filter(r => r.length > 0)));
}

const model = resolve(AiModel);

async function main() {
    const csvContent = fs.readFileSync(CEFR_CSV_PATH, 'utf-8');
    const cefrMap = parseCsv(csvContent);

    const listContent = fs.readFileSync(LIST_PATH, 'utf-8');
    const words: WordEntry[] = JSON.parse(listContent);

    let updatedCount = 0;
    for (const entry of words) {
        if (typeof entry.level === "string")
            continue;``
        const variations = normalizeWord(entry.word.toLocaleLowerCase());
        let foundLevel: string | undefined;

        for (const v of variations) {
            if (cefrMap.has(v)) {
                foundLevel = cefrMap.get(v);
                break;
            }
        }

        if (foundLevel) {
            entry.level = foundLevel;
            updatedCount++;
        } else {
            while (true) {
                const level = await model.prompt(`Return only CEFR level of word '${entry.word}'.`).catch(() => null);
                if(!level){
                    await Fn.asyncDelay(5000);
                    continue;
                }
                console.log(entry.word, level);
                entry.level = level;
                await save(words);
                await Fn.asyncDelay(1000);
                updatedCount++;
                break;
            }
        }
    }

    await save(words);
    console.log(`Updated ${updatedCount} words in list.json`);
}

function save(words) {
    return fs.writeFileSync(LIST_PATH, JSON.stringify(words, null, 2));

}

main().catch(console.error);

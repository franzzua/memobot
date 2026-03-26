import words from "./list.json" with {"type": "json"}
import {mkdir, writeFile} from "node:fs/promises";
import {uuid} from "@cmmn/core";

const migration = [
    'DELETE from "Word" where 1 = 1;',
    'INSERT INTO "Word" ("id", "word", "description", "level", "frequency") VALUES',
    words.map(w =>
    `('${uuid()}', '${w.word}', '${w.description.replace("'", "''")}', '${w.level}', ${w.frequency})`
    ).join(',\n'),
    'ON CONFLICT DO NOTHING;'
].join('\n');

await mkdir('./prisma/migrations/1_seed_words')
await writeFile('./prisma/migrations/1_seed_words/migration.sql', migration);
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../word_cefr_minified.db');
const LIST_PATH = path.join(__dirname, 'list.json');

interface WordEntry {
  index: number;
  word: string;
  description: string;
  level?: number;
  frequency?: number;
}

interface WordPosRow {
  level: number;
  frequency_count: number;
}

function getVariations(word: string): string[] {
  const variations = new Set<string>();

  variations.add(word.toLowerCase());

  // (PRE)SUPPOSITION -> supposition and presupposition
  if (word.includes('(')) {
    const noParens = word.replace(/\(.*?\)/g, '').trim();
    if (noParens) variations.add(noParens.toLowerCase());

    const lettersOnly = word.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly) variations.add(lettersOnly.toLowerCase());
  }

  // FRUITFUL/FRUITLESS -> fruitful, fruitless
  if (word.includes('/')) {
    for (const part of word.split('/')) {
      const cleaned = part.trim();
      if (cleaned) variations.add(cleaned.toLowerCase());
    }
  }

  // GRAPPLE WITH -> grapple
  if (word.includes(' ') && !word.includes('/')) {
    const first = word.split(' ')[0];
    if (first.length > 3) variations.add(first.toLowerCase());
  }

  return [...variations].filter(Boolean);
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const stmt = db.prepare<string[], WordPosRow>(`
    SELECT wp.level, wp.frequency_count
    FROM words w
    JOIN word_pos wp ON w.word_id = wp.word_id
    WHERE LOWER(w.word) IN (${Array(1).fill('?').join(',')})
    ORDER BY wp.frequency_count DESC
    LIMIT 1
  `);

  // Prepare a statement factory since IN clause needs dynamic placeholders
  const lookup = (variations: string[]): WordPosRow | undefined => {
    const placeholders = variations.map(() => '?').join(',');
    const s = db.prepare<string[], WordPosRow>(`
      SELECT wp.level, wp.frequency_count
      FROM words w
      JOIN word_pos wp ON w.word_id = wp.word_id
      WHERE LOWER(w.word) IN (${placeholders})
      ORDER BY wp.frequency_count DESC
      LIMIT 1
    `);
    return s.get(...variations);
  };

  const data: WordEntry[] = JSON.parse(fs.readFileSync(LIST_PATH, 'utf-8'));

  let updated = 0;
  let notFound = 0;

  for (const entry of data) {
    if (!entry.word) continue;

    const variations = getVariations(entry.word);
    const row = lookup(variations);

    if (row) {
      entry.level = row.level;
      entry.frequency = row.frequency_count;
      updated++;
    } else {
      notFound++;
    }
  }

  fs.writeFileSync(LIST_PATH, JSON.stringify(data, null, 2));
  console.log(`Done. Updated: ${updated}, not found: ${notFound}`);

  db.close();
}

main();

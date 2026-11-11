//! Pronunciation scoring with a wav2vec2 model that recognises IPA phonemes
//! (facebook/wav2vec2-lv-60-espeak-cv-ft, ONNX export), scored against the expected
//! phonemes from espeak-ng.
//!
//! How the score works ("goodness of pronunciation"):
//!   1. espeak-ng gives the expected phonemes for the text.
//!   2. The model gives, for every 20ms frame, a probability for each phoneme.
//!   3. The expected phonemes are force-aligned to the frames (CTC Viterbi), so each
//!      expected phoneme gets the stretch of audio where it should have been said.
//!   4. In that stretch, the phoneme's score is the share of the model's (non-blank)
//!      belief that went to the expected phoneme or an accepted variant; the strongest
//!      competitor is reported as what it sounded like instead.
//!
//! Audio decoding and phonemization shell out to ffmpeg and espeak-ng.

use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;

use anyhow::{Context, Result, anyhow, bail};
use ort::session::Session;
use ort::value::Tensor;
use serde::Serialize;

pub const SAMPLE_RATE: u32 = 16000;

/// The model learned its phonemes from many languages, so it often writes an English
/// vowel with a neighbouring symbol (/a/ for /ʌ/, /ɛ/ for an unstressed /ə/) even when
/// the speaker said it right. Belief in these counts toward the expected phoneme.
const VARIANTS: &[(&str, &[&str])] = &[
    ("ʌ", &["a", "ɐ", "ɑ", "ə"]),
    ("ə", &["ɐ", "ɛ", "ɪ", "ʌ", "ɜ", "e", "a", "ʊ"]),
    ("ɚ", &["ɝ", "ə", "ɹ", "ɜː", "ɜ", "ɐ"]),
    ("ɜː", &["ɝ", "ɚ", "ɜ", "ə", "œ"]),
    ("ɪ", &["i", "e", "ɨ", "ə"]),
    ("ᵻ", &["ɪ", "ə", "ɨ", "i", "e", "ɚ"]),
    ("iː", &["i", "ɪ"]),
    ("ɛ", &["e", "æ"]),
    ("æ", &["a", "ɛ"]),
    ("ɑː", &["ɑ", "a", "ɒ"]),
    ("ɔː", &["ɔ", "o", "ɒ", "oː", "ɔːɹ"]),
    ("ʊ", &["u", "uː", "o"]),
    ("uː", &["u", "ʊ"]),
    ("oʊ", &["o", "oː", "əʊ"]),
    ("eɪ", &["e", "eː", "ɛ"]),
    ("ɹ", &["r", "ɾ", "ʁ"]),
    ("ɾ", &["t", "d", "ɹ"]),
    ("t", &["ɾ", "ʔ"]),
];

/// espeak's combined units the model rarely emits as one token.
const SPLIT: &[(&str, &[&str])] = &[("əl", &["ə", "l"])];

const SPECIAL: &[&str] = &["<pad>", "<s>", "</s>", "<unk>"];

#[derive(Serialize)]
pub struct PhonemeScore {
    pub phoneme: String,
    pub score: u32,
    /// What it sounded like, when the expected phoneme scored under 50.
    pub instead: Option<String>,
}

#[derive(Serialize)]
pub struct Assessment {
    pub text: String,
    pub expected: String,
    pub heard: String,
    pub score: u32,
    pub phonemes: Vec<PhonemeScore>,
    pub audio_seconds: f32,
    pub inference_seconds: f32,
}

pub struct Scorer {
    _environment: ort::environment::Environment,
    session: Session,
    vocab: HashMap<String, usize>,
    id_to_token: Vec<String>,
    blank: usize,
}

impl Scorer {
    /// `model_dir` holds vocab.json and the ONNX file named by `model_file`.
    pub fn load(model_dir: &Path, model_file: &str) -> Result<Self> {
        let vocab: HashMap<String, usize> = serde_json::from_str(
            &std::fs::read_to_string(model_dir.join("vocab.json")).context("reading vocab.json")?,
        )?;
        let mut id_to_token = vec![String::new(); vocab.values().max().map_or(0, |m| m + 1)];
        for (t, &i) in &vocab {
            id_to_token[i] = t.clone();
        }
        let blank = *vocab.get("<pad>").ok_or_else(|| anyhow!("vocab has no <pad>"))?;
        let environment = ort::init().build()?;
        let session = Session::builder(&environment)?
            .commit_from_file(model_dir.join(model_file))
            .with_context(|| format!("loading {model_file}"))?;
        Ok(Self { _environment: environment, session, vocab, id_to_token, blank })
    }

    /// Scores `audio` (any format ffmpeg reads, e.g. Telegram's ogg/opus) against `text`.
    pub fn assess(&mut self, audio: &[u8], text: &str) -> Result<Assessment> {
        let samples = decode_audio(audio)?;
        if samples.len() < SAMPLE_RATE as usize / 10 {
            bail!("audio is too short");
        }
        let started = Instant::now();
        let (frames, vocab_size, log_probs) = self.log_probs(&samples)?;
        let inference_seconds = started.elapsed().as_secs_f32();

        let lp = |t: usize, v: usize| log_probs[t * vocab_size + v];
        let special: Vec<usize> = SPECIAL.iter().filter_map(|s| self.vocab.get(*s).copied()).collect();

        // What the model heard, with no knowledge of the expected text.
        let mut heard = Vec::new();
        let mut prev = usize::MAX;
        for t in 0..frames {
            let best = argmax((0..vocab_size).map(|v| lp(t, v)));
            if best != prev && !special.contains(&best) {
                heard.push(self.id_to_token[best].clone());
            }
            prev = best;
        }

        let tokens = self.to_vocab_tokens(&expected_phones(text)?);
        let targets: Vec<usize> = tokens.iter().map(|t| self.vocab[t]).collect();

        let mut phonemes = Vec::new();
        if !targets.is_empty() && frames >= targets.len() {
            let spans = ctc_align(&log_probs, frames, vocab_size, &targets, self.blank);
            for ((tok, &tid), (start, end)) in tokens.iter().zip(&targets).zip(spans) {
                // The frame where the model was most sure some phoneme was being said.
                let frame_probs = |t: usize| -> Vec<f32> {
                    (0..vocab_size)
                        .map(|v| if special.contains(&v) { 0.0 } else { lp(t, v).exp() })
                        .collect()
                };
                let frame = (start..end)
                    .map(frame_probs)
                    .max_by(|a, b| a.iter().sum::<f32>().total_cmp(&b.iter().sum::<f32>()))
                    .unwrap_or_else(|| vec![0.0; vocab_size]);
                let mass: f32 = frame.iter().sum();
                let accepted: Vec<usize> = std::iter::once(tid)
                    .chain(variants(tok).iter().filter_map(|v| self.vocab.get(*v).copied()))
                    .collect();
                let score = if mass > 0.0 {
                    accepted.iter().map(|&i| frame[i]).sum::<f32>() / mass
                } else {
                    0.0
                };
                let rival = (0..vocab_size)
                    .filter(|i| !accepted.contains(i))
                    .max_by(|&a, &b| frame[a].total_cmp(&frame[b]))
                    .unwrap();
                phonemes.push(PhonemeScore {
                    phoneme: tok.clone(),
                    score: (100.0 * score).round() as u32,
                    instead: (score < 0.5).then(|| self.id_to_token[rival].clone()),
                });
            }
        }

        let score = if phonemes.is_empty() {
            0
        } else {
            (phonemes.iter().map(|p| p.score as f32).sum::<f32>() / phonemes.len() as f32).round() as u32
        };
        Ok(Assessment {
            text: text.to_string(),
            expected: tokens.join(" "),
            heard: heard.join(" "),
            score,
            phonemes,
            audio_seconds: samples.len() as f32 / SAMPLE_RATE as f32,
            inference_seconds,
        })
    }

    /// Runs the model; returns (frames, vocab size, row-major log-softmax).
    fn log_probs(&mut self, samples: &[f32]) -> Result<(usize, usize, Vec<f32>)> {
        // Wav2Vec2FeatureExtractor with do_normalize: zero mean, unit variance.
        let n = samples.len() as f32;
        let mean = samples.iter().sum::<f32>() / n;
        let var = samples.iter().map(|x| (x - mean).powi(2)).sum::<f32>() / n;
        let std = (var + 1e-7).sqrt();
        let input: Vec<f32> = samples.iter().map(|x| (x - mean) / std).collect();

        let tensor = Tensor::from_array(([1usize, input.len()], input))?;
        let outputs = self.session.run(ort::inputs!["input_values" => tensor])?;
        let (shape, logits) = outputs["logits"].try_extract_tensor::<f32>()?;
        let (frames, vocab_size) = (shape[1] as usize, shape[2] as usize);
        let mut out = Vec::with_capacity(logits.len());
        for row in logits.chunks(vocab_size) {
            let max = row.iter().copied().fold(f32::NEG_INFINITY, f32::max);
            let log_sum = row.iter().map(|x| (x - max).exp()).sum::<f32>().ln() + max;
            out.extend(row.iter().map(|x| x - log_sum));
        }
        Ok((frames, vocab_size, out))
    }

    /// espeak and the model's vocabulary mostly agree; split the few that don't
    /// (e.g. a syllabic cluster) into the longest vocabulary pieces.
    fn to_vocab_tokens(&self, phones: &[String]) -> Vec<String> {
        let mut tokens = Vec::new();
        for phone in phones {
            let pieces: Vec<String> = match SPLIT.iter().find(|(p, _)| p == phone) {
                Some((_, parts)) => parts.iter().map(|s| s.to_string()).collect(),
                None => vec![phone.clone()],
            };
            for piece in pieces {
                if self.vocab.contains_key(&piece) {
                    tokens.push(piece);
                    continue;
                }
                let chars: Vec<char> = piece.chars().collect();
                let mut i = 0;
                while i < chars.len() {
                    let found = (i + 1..=chars.len()).rev().find(|&j| {
                        self.vocab.contains_key(&chars[i..j].iter().collect::<String>())
                    });
                    match found {
                        Some(j) => {
                            tokens.push(chars[i..j].iter().collect());
                            i = j;
                        }
                        None => i += 1, // a mark the model has no token for, e.g. a length sign
                    }
                }
            }
        }
        tokens
    }
}

fn variants(token: &str) -> &'static [&'static str] {
    VARIANTS.iter().find(|(t, _)| *t == token).map_or(&[], |(_, v)| v)
}

fn argmax(values: impl Iterator<Item = f32>) -> usize {
    values
        .enumerate()
        .max_by(|a, b| a.1.total_cmp(&b.1))
        .map_or(0, |(i, _)| i)
}

/// Telegram voice messages are 48kHz ogg/opus; the model wants 16kHz mono floats.
fn decode_audio(audio: &[u8]) -> Result<Vec<f32>> {
    let mut child = Command::new("ffmpeg")
        .args(["-v", "error", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "f32le", "pipe:1"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("running ffmpeg")?;
    let mut stdin = child.stdin.take().unwrap();
    let input = audio.to_vec();
    let writer = std::thread::spawn(move || stdin.write_all(&input));
    let output = child.wait_with_output()?;
    writer.join().map_err(|_| anyhow!("ffmpeg stdin writer panicked"))??;
    if !output.status.success() {
        bail!("ffmpeg failed: {}", String::from_utf8_lossy(&output.stderr));
    }
    Ok(output
        .stdout
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect())
}

fn expected_phones(text: &str) -> Result<Vec<String>> {
    let output = Command::new("espeak-ng")
        .args(["-q", "--ipa", "--sep= ", "-v", "en-us", text])
        .output()
        .context("running espeak-ng")?;
    if !output.status.success() {
        bail!("espeak-ng failed: {}", String::from_utf8_lossy(&output.stderr));
    }
    Ok(String::from_utf8(output.stdout)?
        .replace(['ˈ', 'ˌ'], "")
        .split_whitespace()
        .map(str::to_string)
        .collect())
}

/// Viterbi alignment of `targets` to frames. Returns [start, end) per target; each
/// target owns the frames from its first frame until the next target starts, so
/// trailing blanks (where CTC parks between peaks) count toward it.
fn ctc_align(log_probs: &[f32], frames: usize, vocab_size: usize, targets: &[usize], blank: usize) -> Vec<(usize, usize)> {
    let mut ext = vec![blank];
    for &t in targets {
        ext.push(t);
        ext.push(blank);
    }
    let s_len = ext.len();
    let lp = |t: usize, v: usize| log_probs[t * vocab_size + v];
    let mut dp = vec![f32::NEG_INFINITY; frames * s_len];
    let mut back = vec![0usize; frames * s_len];
    dp[0] = lp(0, ext[0]);
    if s_len > 1 {
        dp[1] = lp(0, ext[1]);
    }
    for t in 1..frames {
        for s in 0..s_len {
            let prev = |s: usize| dp[(t - 1) * s_len + s];
            let (mut best, mut arg) = (prev(s), s);
            if s >= 1 && prev(s - 1) > best {
                (best, arg) = (prev(s - 1), s - 1);
            }
            if s >= 2 && ext[s] != blank && ext[s] != ext[s - 2] && prev(s - 2) > best {
                (best, arg) = (prev(s - 2), s - 2);
            }
            dp[t * s_len + s] = best + lp(t, ext[s]);
            back[t * s_len + s] = arg;
        }
    }
    let last = (frames - 1) * s_len;
    let mut s = if s_len == 1 || dp[last + s_len - 1] >= dp[last + s_len - 2] { s_len - 1 } else { s_len - 2 };
    let mut path = vec![0usize; frames];
    for t in (0..frames).rev() {
        path[t] = s;
        s = back[t * s_len + s];
    }
    let mut starts = vec![usize::MAX; targets.len()];
    for (t, &s) in path.iter().enumerate() {
        if s % 2 == 1 && starts[s / 2] == usize::MAX {
            starts[s / 2] = t;
        }
    }
    (0..starts.len())
        .map(|k| (starts[k], starts.get(k + 1).copied().unwrap_or(frames)))
        .collect()
}

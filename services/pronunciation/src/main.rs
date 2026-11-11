//! pronunciation <audio file> <expected text> [--json]   score one recording
//! pronunciation serve                                   HTTP service for Cloud Run
//!
//! Env: MODEL_DIR (default "models"), MODEL_FILE (default "model_fp16.onnx"),
//!      PORT (default 8080).
//!
//! HTTP: POST /score?text=<expected text>, body = raw audio bytes (e.g. Telegram's
//! ogg/opus voice file). Returns the Assessment as JSON.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use anyhow::{Result, bail};
use axum::Router;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use pronunciation::Scorer;
use serde::Deserialize;

fn load_scorer() -> Result<Scorer> {
    let dir = PathBuf::from(std::env::var("MODEL_DIR").unwrap_or_else(|_| "models".into()));
    let file = std::env::var("MODEL_FILE").unwrap_or_else(|_| "model_fp16.onnx".into());
    Scorer::load(&dir, &file)
}

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("serve") => serve().await,
        Some(_) => check(args),
        None => bail!("usage: pronunciation <audio file> <expected text> [--json] | pronunciation serve"),
    }
}

fn check(args: Vec<String>) -> Result<()> {
    let json = args.iter().any(|a| a == "--json");
    let args: Vec<&String> = args.iter().filter(|a| *a != "--json").collect();
    if args.len() < 2 {
        bail!("usage: pronunciation <audio file> <expected text> [--json]");
    }
    let text = args[1..].iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" ");
    let started = Instant::now();
    let mut scorer = load_scorer()?;
    let load_seconds = started.elapsed().as_secs_f32();
    let r = scorer.assess(&std::fs::read(args[0])?, &text)?;
    if json {
        println!("{}", serde_json::to_string_pretty(&r)?);
        return Ok(());
    }
    println!("Expected: /{}/", r.expected);
    println!("Heard:    /{}/", r.heard);
    println!("Score:    {}/100", r.score);
    for p in &r.phonemes {
        let hint = p.instead.as_ref().map(|i| format!("  sounded like /{i}/")).unwrap_or_default();
        println!("  /{}/ {:>3}{hint}", p.phoneme, p.score);
    }
    println!(
        "\n{:.2}s of audio · model load {load_seconds:.1}s · inference {:.2}s",
        r.audio_seconds, r.inference_seconds
    );
    Ok(())
}

#[derive(Deserialize)]
struct ScoreQuery {
    text: String,
}

async fn serve() -> Result<()> {
    let scorer = Arc::new(Mutex::new(load_scorer()?));
    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/score", post(score))
        .with_state(scorer);
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    eprintln!("listening on :{port}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn score(
    State(scorer): State<Arc<Mutex<Scorer>>>,
    Query(q): Query<ScoreQuery>,
    body: Bytes,
) -> impl IntoResponse {
    // Inference is CPU-bound; keep it off the async workers.
    let result = tokio::task::spawn_blocking(move || scorer.lock().unwrap().assess(&body, &q.text)).await;
    match result {
        Ok(Ok(r)) => Json(r).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

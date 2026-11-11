FROM rust:1-trixie AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo build --release

FROM debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg espeak-ng ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# The model is baked into the image so a cold start only has to load it from disk.
ARG MODEL_URL=https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/main
RUN mkdir /models \
    && curl -fsSL -o /models/vocab.json $MODEL_URL/vocab.json \
    && curl -fsSL -o /models/model_fp16.onnx $MODEL_URL/onnx/model_fp16.onnx
COPY --from=build /src/target/release/pronunciation /usr/local/bin/pronunciation
ENV MODEL_DIR=/models MODEL_FILE=model_fp16.onnx PORT=8080
CMD ["pronunciation", "serve"]

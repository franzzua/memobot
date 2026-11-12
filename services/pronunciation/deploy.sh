#!/usr/bin/env bash
# Builds the image with Cloud Build and deploys the private `pronunciation` Cloud Run service.
#
# One instance at most: requests beyond the one being scored wait inside it (the scorer
# is behind a mutex), rather than Cloud Run starting more 4GiB instances or answering 429.
# 4Gi because the fp16 model peaks at ~2.2GB RAM while loading.
#
# Usage: ./deploy.sh <tag>      e.g. ./deploy.sh v2
set -euo pipefail
cd "$(dirname "$0")"

TAG=${1:?usage: ./deploy.sh <tag>}
PROJECT=spixmemo
REGION=europe-west1
IMAGE=$REGION-docker.pkg.dev/$PROJECT/pronunciation/pronunciation:$TAG

# The global pool: europe-west1 doesn't allow e2-highcpu-8 builds on this project.
gcloud builds submit --project $PROJECT --machine-type e2-highcpu-8 --tag "$IMAGE" .

gcloud run deploy pronunciation --project $PROJECT --region $REGION --image "$IMAGE" \
    --memory 4Gi --cpu 2 --cpu-boost \
    --min-instances 0 --max-instances 1 --concurrency 80 --timeout 120 \
    --no-allow-unauthenticated

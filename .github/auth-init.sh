#!/bin/bash

gcloud iam service-accounts create "github" --project "spix-425421"

gcloud projects add-iam-policy-binding spix-425421 \
  --role="roles/cloudfunctions.admin" \
  --member="serviceAccount:github@spix-425421.iam.gserviceaccount.com"
    
gcloud projects add-iam-policy-binding spix-425421 \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:github@spix-425421.iam.gserviceaccount.com"
  
gcloud projects add-iam-policy-binding spix-425421 \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:github@spix-425421.iam.gserviceaccount.com"

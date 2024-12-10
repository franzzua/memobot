#!/bin/bash

gcloud iam service-accounts create "github" --project "steel-topic-444112-i8"

gcloud projects add-iam-policy-binding steel-topic-444112-i8 \
  --role="roles/cloudfunctions.admin" \
  --member="serviceAccount:github@steel-topic-444112-i8.iam.gserviceaccount.com"
    
gcloud projects add-iam-policy-binding steel-topic-444112-i8 \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:github@steel-topic-444112-i8.iam.gserviceaccount.com"
  
gcloud projects add-iam-policy-binding steel-topic-444112-i8 \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:github@steel-topic-444112-i8.iam.gserviceaccount.com"

gcloud iam workload-identity-pools create "github" --project="steel-topic-444112-i8" --location="global" --display-name="GitHub Actions Pool"
gcloud iam workload-identity-pools describe "github" --project="steel-topic-444112-i8" --location="global" --format="value(name)"

gcloud iam workload-identity-pools providers create-oidc "my-repo" \
  --project="steel-topic-444112-i8"  \
  --location="global"  \
  --workload-identity-pool="github"  \
  --display-name="My GitHub repo Provider"  \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"  \
  --attribute-condition="assertion.repository_owner == 'AwtorGit'"  \
  --issuer-uri="https://token.actions.githubusercontent.com"
  
  
gcloud iam workload-identity-pools providers describe "my-repo" \
  --project="steel-topic-444112-i8" \
  --location="global" \
  --workload-identity-pool="github" \
  --format="value(name)"

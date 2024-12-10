#!/bin/bash

export project='steel-topic-444112-i8'
export repo_owner='franzzua'
export repo_name='memobot'
export deployer_name=github
export runner_name=app-runner

export deployer=${deployer_name}@${project}.iam.gserviceaccount.com
export runner=${runner_name}@${project}.iam.gserviceaccount.com

gcloud config set project ${project}

gcloud iam service-accounts create "${deployer_name}" --project "${project}"
gcloud iam service-accounts create "${runner_name}" --project "${project}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/cloudfunctions.admin" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:${deployer}"

gcloud iam workload-identity-pools create "github" --project="${project}" --location="global" --display-name="GitHub Actions Pool"
export pool=$(gcloud iam workload-identity-pools describe "github" --project="${project}" --location="global" --format="value(name)")

gcloud iam workload-identity-pools providers create-oidc "github" \
  --project="${project}"  \
  --location="global"  \
  --workload-identity-pool="github"  \
  --display-name="My GitHub repo Provider"  \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"  \
  --attribute-condition="assertion.repository_owner == '${repo_owner}'"  \
  --issuer-uri="https://token.actions.githubusercontent.com"


gcloud iam workload-identity-pools providers describe "github" \
  --project="${project}" \
  --location="global" \
  --workload-identity-pool="github" \
  --format="value(name)"

gcloud iam service-accounts add-iam-policy-binding "${deployer}" \
  --project="${project}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${pool}/attribute.repository/${repo_owner}/${repo_name}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/artifactregistry.repoAdmin" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/run.admin" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:${deployer}"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/storage.admin" \
  --member="serviceAccount:${deployer}"



gcloud projects add-iam-policy-binding ${project} \
  --role="roles/aiplatform.serviceAgent" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/aiplatform.user" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"


gcloud projects add-iam-policy-binding ${project} \
  --role="roles/datastore.owner" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/datastore.user" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${project} \
  --role="roles/secretmanager.secretAccessor" \
  --member="serviceAccount:app-runner@${project}.iam.gserviceaccount.com"


gcloud services enable aiplatform.googleapis.com
gcloud services enable analytics.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable iamcredentials.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable translate.googleapis.com
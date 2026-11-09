#!/usr/bin/env bash
# One-time creation of production on Google Cloud. Later releases are deployed by CI.
# Prerequisites: gcloud logged in, Docker running, Terraform >= 1.9, the project and its
# state bucket created (see README, "Production on Google Cloud").
# Run from the repository root in Git Bash:  bash infra/first-deploy.sh
set -euo pipefail

cd "$(dirname "$0")/terraform"
PROJECT=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' production.tfvars)
REGION=$(sed -n 's/^region *= *"\(.*\)"/\1/p' production.tfvars)
TAG=$(git rev-parse --short HEAD)
REGISTRY="$REGION-docker.pkg.dev/$PROJECT/crud"
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "==> Terraform state in gs://$PROJECT-tfstate"
terraform init -input=false -reconfigure -backend-config="bucket=$PROJECT-tfstate"

echo "==> 1/3 Image registry"
terraform apply -var-file=production.tfvars -var "image_tag=$TAG" \
  -target=google_artifact_registry_repository.images

echo "==> 2/3 Build and push release candidate $TAG"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
for part in frontend backend; do
  docker build -t "$REGISTRY/crud-$part:$TAG" "../../$part"
  docker push "$REGISTRY/crud-$part:$TAG"
done

echo "==> 3/3 Service, identities and permissions"
terraform apply -var-file=production.tfvars -var "image_tag=$TAG"

echo
echo "Production: $(terraform output -raw url)"

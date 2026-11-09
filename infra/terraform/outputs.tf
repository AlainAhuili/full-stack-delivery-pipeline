output "url" {
  description = "Public HTTPS address of production."
  value       = google_cloud_run_v2_service.app.uri
}

output "registry" {
  description = "Artifact Registry path for the release candidate images."
  value       = local.registry
}

# Store these as variables of the GitHub "production" environment (see README).
output "github_environment_variables" {
  value = {
    GCP_PROJECT_ID                 = var.project_id
    GCP_REGION                     = var.region
    CLOUD_RUN_SERVICE              = google_cloud_run_v2_service.app.name
    GCP_SERVICE_ACCOUNT            = google_service_account.deployer.email
    GCP_WORKLOAD_IDENTITY_PROVIDER = google_iam_workload_identity_pool_provider.github.name
  }
}

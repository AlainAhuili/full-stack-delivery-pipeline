variable "project_id" {
  description = "Google Cloud project that hosts production."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Artifact Registry."
  type        = string
  default     = "europe-west3" # Frankfurt
}

variable "service_name" {
  description = "Name of the Cloud Run service."
  type        = string
  default     = "crud-production"
}

variable "image_tag" {
  description = <<-EOT
    Release candidate tag (short commit SHA) used when Terraform creates the service. Later
    releases are deployed by the CI production stage, so Terraform ignores image changes.
  EOT
  type        = string
}

variable "max_instances" {
  description = <<-EOT
    Upper bound for Cloud Run instances. Items are kept in the backend's memory, so more than one
    instance would give each visitor a different list; raise it once the API uses a database.
  EOT
  type        = number
  default     = 1
}

variable "github_repository" {
  description = "owner/name of the repository whose production environment may deploy."
  type        = string
  default     = "AlainAhuili/full-stack-delivery-pipeline"
}

variable "github_oidc_subject_prefix" {
  description = <<-EOT
    Subject prefix of the repository's GitHub OIDC tokens. The repository uses immutable subjects
    (owner@id/name@id); `gh api repos/OWNER/REPO/actions/oidc/customization/sub` shows it.
  EOT
  type        = string
  default     = "repo:AlainAhuili@85407672/full-stack-delivery-pipeline@1252353710"
}

variable "github_environment" {
  description = "GitHub environment whose jobs may act as the deployer."
  type        = string
  default     = "production"
}

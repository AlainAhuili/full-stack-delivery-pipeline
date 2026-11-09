terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # State lives in a GCS bucket created once by hand (see README). The bucket name is passed at
  # init time: terraform init -backend-config="bucket=<project-id>-tfstate"
  backend "gcs" {
    prefix = "production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

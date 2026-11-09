# Production on Google Cloud: one Cloud Run service running the release candidate's frontend
# (nginx, the only public entry point) with the backend beside it, the same pairing as
# docker-compose.production.yml. Cloud Run provides HTTPS, the public URL and scaling.

locals {
  registry = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---- Images ------------------------------------------------------------------------------
resource "google_artifact_registry_repository" "images" {
  repository_id = "crud"
  location      = var.region
  format        = "DOCKER"
  description   = "Release candidate images, tagged with the short commit SHA."

  # Keep the last 20 release candidates per image.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 20
    }
  }
  cleanup_policies {
    id     = "delete-older"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.apis]
}

# ---- Runtime identity: the service runs as an account with no project roles ----------------
resource "google_service_account" "runtime" {
  account_id   = "crud-runtime"
  display_name = "CRUD production runtime"
  depends_on   = [google_project_service.apis]
}

# ---- Service -------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    # Ingress container: serves the UI and proxies /api/ to the backend on localhost.
    containers {
      name       = "frontend"
      image      = "${local.registry}/crud-frontend:${var.image_tag}"
      depends_on = ["backend"]

      ports {
        container_port = 8080
      }
      env {
        name  = "BACKEND_URL"
        value = "http://127.0.0.1:3000"
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        cpu_idle = true
      }
    }

    # Backend: not reachable from outside the instance.
    containers {
      name  = "backend"
      image = "${local.registry}/crud-backend:${var.image_tag}"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
      startup_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        period_seconds    = 2
        failure_threshold = 30
      }
      liveness_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        period_seconds = 30
      }
    }
  }

  lifecycle {
    # The CI production stage rolls out new images; Terraform owns everything else.
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[1].image,
      template[0].revision,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.apis]
}

# Public website: anyone may call the service (only the frontend container listens publicly).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

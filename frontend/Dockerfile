# Static files served by nginx (non-root), which also proxies /api/ to the backend.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Overridden per environment in the compose files.
ENV BACKEND_URL=http://backend:3000

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY src/ /usr/share/nginx/html/

EXPOSE 8080

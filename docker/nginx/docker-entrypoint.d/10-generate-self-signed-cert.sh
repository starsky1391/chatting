#!/bin/sh
set -eu

mkdir -p /etc/nginx/ssl

if [ ! -s /etc/nginx/ssl/nginx.crt ] || [ ! -s /etc/nginx/ssl/nginx.key ]; then
  openssl req \
    -x509 \
    -nodes \
    -days "${NGINX_SELF_SIGNED_DAYS:-3650}" \
    -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "${NGINX_SELF_SIGNED_SUBJECT:-/CN=localhost}" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

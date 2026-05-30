#!/bin/sh
set -eu

mkdir -p /etc/nginx/ssl

SSL_MODE="${NGINX_SSL_MODE:-auto}"
CERT_TARGET="/etc/nginx/ssl/nginx.crt"
KEY_TARGET="/etc/nginx/ssl/nginx.key"
CERT_FILE="${NGINX_SSL_CERT_FILE:-$CERT_TARGET}"
KEY_FILE="${NGINX_SSL_KEY_FILE:-$KEY_TARGET}"

link_custom_cert_paths() {
  if [ "$CERT_FILE" != "$CERT_TARGET" ]; then
    ln -sf "$CERT_FILE" "$CERT_TARGET"
  fi

  if [ "$KEY_FILE" != "$KEY_TARGET" ]; then
    ln -sf "$KEY_FILE" "$KEY_TARGET"
  fi
}

if [ "$SSL_MODE" = "provided" ]; then
  if [ ! -s "$CERT_FILE" ] || [ ! -s "$KEY_FILE" ]; then
    echo "NGINX_SSL_MODE=provided but certificate files are missing:"
    echo "  cert: $CERT_FILE"
    echo "  key:  $KEY_FILE"
    exit 1
  fi
  link_custom_cert_paths
  exit 0
fi

if [ ! -s "$CERT_TARGET" ] || [ ! -s "$KEY_TARGET" ]; then
  openssl req \
    -x509 \
    -nodes \
    -days "${NGINX_SELF_SIGNED_DAYS:-3650}" \
    -newkey rsa:2048 \
    -keyout "$KEY_TARGET" \
    -out "$CERT_TARGET" \
    -subj "${NGINX_SELF_SIGNED_SUBJECT:-/CN=localhost}" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

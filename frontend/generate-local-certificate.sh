#!/bin/sh
set -eu

cert_dir=/etc/nginx/local-tls
if [ ! -s "$cert_dir/localhost.crt" ] || [ ! -s "$cert_dir/localhost.key" ]; then
    umask 077
    openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
        -keyout "$cert_dir/localhost.key.tmp" \
        -out "$cert_dir/localhost.crt.tmp" \
        -subj '/CN=localhost' \
        -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
    mv "$cert_dir/localhost.key.tmp" "$cert_dir/localhost.key"
    mv "$cert_dir/localhost.crt.tmp" "$cert_dir/localhost.crt"
fi

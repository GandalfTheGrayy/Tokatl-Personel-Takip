#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  db_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 48)"
  god_password="$(openssl rand -base64 24 | tr -d '\n')"
  cat > .env <<ENV
DB_PASSWORD=$db_password
JWT_SECRET=$jwt_secret
GOD_USERNAME=muharrem
GOD_NAME=Muharrem
GOD_PASSWORD=$god_password
SITE_ADDRESS=localhost
ENV
  printf 'Güvenli .env oluşturuldu. Alan adınız varsa SITE_ADDRESS değerini düzenleyin.\n'
fi
docker compose up -d --build
attempt=0
until docker compose exec -T server test -f /data/ilk-hesaplar.txt 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    printf 'İlk hesap dosyası henüz hazır değil. docker compose logs server çıktısını kontrol edin.\n' >&2
    exit 1
  fi
  sleep 2
done
docker compose exec -T server cat /data/ilk-hesaplar.txt > ilk-hesaplar.txt
chmod 600 ilk-hesaplar.txt
printf 'İlk hesaplar: %s/ilk-hesaplar.txt\n' "$(pwd)"

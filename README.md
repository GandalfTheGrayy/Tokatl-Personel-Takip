# Kurumsal Personel Yoklama Sistemi

React + TypeScript + Tailwind CSS arayüzü, Express + Prisma API ve PostgreSQL veritabanı. Türkçe, mobil uyumlu PWA. Varsayılan kurulum 1 yönetici, 3 amir ve 20 personel üretir.

## Gereksinimler

Docker Engine + Docker Compose v2, 80/443 TCP açık bir sunucu ve güvenilir HTTPS için sunucu IP'sine yönlenen alan adı. Kurulum betiği için OpenSSL gerekir. Kurumsal kullanımda alan adını ve düzenli sunucu yedeğini ayarlayın.

## Kurulum

```sh
cd yoklama
./scripts/setup.sh
```

Betiğin oluşturduğu `.env` dosyasındaki `SITE_ADDRESS=localhost` değerini alan adınızla değiştirip `docker compose up -d` çalıştırın. Caddy alan adı için otomatik HTTPS sertifikası alır. Alan adı tanımlanmamışsa localhost için Caddy'nin yerel sertifikası tarayıcı tarafından güvenilir sayılmayabilir; doğrudan IP adresiyle güvenilir HTTPS garantisi yoktur. Sunucu güvenlik duvarında yalnızca 80 ve 443 bağlantı noktalarını açın. PostgreSQL ve API dışarıya açılmaz.

İlk giriş bilgileri sunucuda `yoklama/ilk-hesaplar.txt` dosyasında 0600 izinleriyle yer alır. Bu dosyayı gizli tutun. Her hesabın geçici şifresi benzersiz ve rastgele üretilir; ilk girişte değişim zorunludur. Şifre unutulursa yönetici panelinde kullanıcı şifresi sıfırlanır. Yönetici hesabı da kaybedilirse sunucu operatörünün veritabanı düzeyinde kurtarma yapması gerekir.

`docker compose logs -f server` günlükleri gösterir. `docker compose down` uygulamayı kapatır; veritabanı hacimleri korunur. Güncellemede kodu yenileyip `docker compose up -d --build` çalıştırın. Veritabanı şemasında üretim ortamı için kontrollü Prisma migration süreci tercih edilir; bu sürüm ilk kurulumda `prisma db push` kullanır.

## İş akışları

Personel “Bugün Görevdeyim” ile sunucu saatini kaydeder, açıklama ekleyebilir ve amir kararına dek açıklamayı düzenleyebilir. “Bugün Gelemeyeceğim” ile aynı gün için izin kategorisi seçer. İkisi aynı gün birlikte girilemez. Amir ve yönetici bekleyen kayıtları onaylar veya gerekçe yazarak reddeder. Yönetici hesapları, rolleri, mesai, kurum adı ve logoyu düzenler; raporları XLSX/PDF olarak indirir ve PostgreSQL özel biçiminde yedek alır. Takvim ve geçmiş kayıtları role göre filtrelenir.

Gün hesabı `Europe/Istanbul` saat dilimindedir. Geç kalma sınırı mesai başlangıcı + tolerans; “Çok Geç” eşiği ayrıca ayarlanır. Onay bekleyen kayıtlar gösterge istatistiklerindeki “Gelen/İzinli” sayılarına katılmaz. “Gelmeyen” kutusu toplam personelden onaylı gelen ve izinlileri çıkarır; bekleyen kişiler de bu sayıya dahil olur. Devamsızlık raporunda hafta sonları ve gelecekteki günler dışarıda bırakılır; resmî tatil takvimi bu sürümde yoktur. Saatlik izin kategorisi tam günlük talep olarak işlenir; saat aralığı modeli yoktur.

Güvenlik: bcrypt (12 tur), 12 saatlik JWT, HTTP-only SameSite=Strict cookie, üretimde Secure cookie, CSRF token + Origin kontrolü, güvenlik başlıkları, giriş rate limiting, Prisma parametreli sorgular, rol ve sahiplik kontrolleri, otomatik audit log. TLS sonlandırması Caddy üzerinden yapılır. Hassas dışa aktarımlar yalnızca yöneticiye açıktır. Üretimde kurumsal yedek saklama ve erişim denetimi ayrıca yapılandırılmalıdır.

## Geliştirme

Node 22 ve PostgreSQL 15 gerekir. `server` içinde `npm install`, `npx prisma db push`, `npm run seed`, `npm run dev`; `client` içinde `npm install`, `npm run dev`. Sunucu `.env` dosyasında `DATABASE_URL` ve en az 32 karakterlik `JWT_SECRET` bulunmalıdır. Vite geliştirme sunucusu `/api` isteklerini 3000 numaralı porta yönlendirir. Yerel geliştirmede `NODE_ENV=production` kullanılmaz.

## API özeti

`/api/auth/login`, `/api/auth/me`, `/api/auth/password`; `/api/my/today`, `/api/my/attendance`, `/api/my/leave`, `/api/my/history`; `/api/approvals`, `/api/calendar`; yönetici için `/api/dashboard`, `/api/users`, `/api/settings`, `/api/reports`, `/api/reports/xlsx`, `/api/reports/pdf`, `/api/backup`, `/api/audit`.

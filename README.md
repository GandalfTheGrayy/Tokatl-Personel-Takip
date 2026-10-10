# Tokatlı Next Gen

React + TypeScript + Tailwind CSS arayüzü, Express + Prisma API ve PostgreSQL veritabanından oluşan Türkçe, mobil öncelikli personel ve mahalle çıkış takip PWA'sı. Herkes açık kayıt ekranından Üye hesabı oluşturabilir.

## Ana iş akışı

- Üye, mahalleye çıkarken **Çıktım** kaydı oluşturur; kayıt yetkili onayına düşer.
- Yetkili kaydı onaylar veya gerekçeli olarak reddeder. Kullanıcı kendi kaydını onaylayamaz.
- Üye döndüğünde **Döndüm** der; sistem dışarıda geçen süreyi hesaplar.
- Normal çıkış veya Tanrı'nın tanımladığı kategorilerden bir izin türü seçilebilir.
- Tanrı izin türlerini, akşam başlangıç saatini, seri için asgari süreyi, sıralama dönemini ve azami açık kayıt süresini belirler.
- İzin verilmişse bu yıla ait geçmiş çıkışlar tarih/saat aralığıyla girilebilir; bunlar da yetkili onayı bekler.
- Kullanıcılara ikinci katman olarak **Academy** veya **Lord** sınıfı atanabilir.
- Tier List; dışarıda kalma süresi, çıkış günü, akşam çıkışları, gün serisi ve izin adedini Academy/Lord filtresiyle sıralar. Yalnızca onaylanmış kayıtlar puana katılır.

## Yetkiler ve canlı durum

Tanrı tüm sistem kurallarına ve kullanıcı yönetimine sahiptir. Kullanıcı adı, görünen ad, profil fotoğrafı, rol, Academy/Lord sınıfı, parola ve hesap durumunu düzenleyebilir; başka hesapları ilişkili verileriyle kalıcı olarak silebilir. Tanrı hesabı başka rollerce değiştirilemez veya silinemez.

Tanrı, **Rol Mimarisi** ekranından özel roller oluşturabilir. Panel görüntüleme, canlı durum, çıkış açma, geçmiş kayıt, onay/red, kullanıcı bilgilerinin ayrı ayrı düzenlenmesi, ayarlar, rapor, audit ve yedek izinleri rol bazında tek tek seçilebilir. Özel rol atanmış bir kullanıcı yalnızca bu matriste verilen izinleri alır.

**Canlı Durum** ekranı son iki dakika içinde etkin olan kullanıcıları online gösterir; açık çıkış kaydına göre mahallede veya dışarıda olanları ayrı filtrelerle sunar. İstemci etkinliği 45 saniyede bir, ekran verisi 15 saniyede bir yenilenir.

## Kurulum

Docker Engine + Docker Compose v2 gerekir. 80/443 TCP açık olmalı; güvenilir HTTPS için sunucu IP'sine yönlenen bir alan adı kullanılmalıdır.

```sh
./scripts/setup.sh
```

Betiğin oluşturduğu `.env` dosyasında `SITE_ADDRESS`, `GOD_USERNAME`, `GOD_NAME` ve `GOD_PASSWORD` değerlerini ayarlayın, ardından `docker compose up -d` çalıştırın. İlk hesap bilgileri `ilk-hesaplar.txt` dosyasında 0600 izinleriyle tutulur; bu dosyayı gizli tutun. PostgreSQL ve API doğrudan internete açılmaz, TLS Caddy tarafından sonlandırılır.

Veritabanı şemasında üretim için kontrollü Prisma migration süreci tercih edilir; ilk kurulum betiği `prisma db push` kullanır.

## Geliştirme

Node 22 ve PostgreSQL 15 gerekir. `server` içinde `npm install`, `npx prisma db push`, `npm run seed`, `npm run dev`; `client` içinde `npm install`, `npm run dev` çalıştırılır. Sunucu `.env` dosyasında `DATABASE_URL`, en az 32 karakterlik `JWT_SECRET` ve en az 8 karakterlik `GOD_PASSWORD` bulunmalıdır. Vite geliştirme sunucusu `/api` isteklerini 3000 numaralı porta yönlendirir.

## API özeti

Kimlik: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/password`.

Çıkış: `/api/outings/me`, `/api/outings/start`, `/api/outings/historical`, `/api/outings/:id/return`, `/api/outings/:id`.

Yönetim: `/api/outings/manage`, `/api/outings/:id/decision`, `/api/outings/overview`, `/api/users`, `/api/roles`, `/api/role-options`, `/api/settings`, `/api/audit`.

Sıralama ve canlı durum: `/api/rankings`, `/api/presence`, `/api/presence/ping`.

## Güvenlik

bcrypt (12 tur), 12 saatlik JWT, HTTP-only SameSite=Strict cookie, üretimde Secure cookie, CSRF token ve Origin kontrolü, güvenlik başlıkları, giriş hız sınırlaması, Prisma parametreli sorgular, rol/sahiplik kontrolleri ve audit log kullanılır. Hassas parolalar ve üretim `.env` dosyaları repoya eklenmemelidir.

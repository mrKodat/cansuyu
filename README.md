# Can Suyu Yardım — Yönetim Paneli

Yardım kuruluşu için Firebase tabanlı yönetim paneli. Vue 3 + PrimeVue + Firebase (Auth, Firestore, Storage).

Statik olarak build edilir ve Hostinger benzeri paylaşımlı sunucuda yayınlanır. Ayrı bir API servisi yoktur — tüm veri akışı doğrudan Firebase SDK üzerinden gerçekleşir.

## Özellikler

- **Gösterge Paneli** — KPI kartları, son yardımlar, düşük stok uyarıları, yeni başvurular
- **Muhtaçlar** — isim / TC / telefon / adres üzerinde geniş arama, detaylı profil, yardım geçmişi, gelir & devlet destekleri & diğer kuruluş kayıtları
- **Bağışçılar** — bireysel / kurumsal kayıt, arama
- **Yardımlar** — nakdi ve ayni yardım; envanter bağlantılı kalem yönetimi, otomatik stok düşümü
- **Envanter** — stok kalemleri, giriş/çıkış hareketleri, düşük stok uyarısı
- **Temsilciler** — rol bazlı yetkilendirme (`admin`, `manager`, `representative`, `viewer`)
- **Başvurular** — web formu için hazır `applications` koleksiyonu; incele → onayla → muhtaç kaydına dönüştür iş akışı

## Kurulum

```bash
npm install

# Firebase config
cp .env.example .env.local
# .env.local dosyasını Firebase Console > Proje Ayarları > Web Uygulamanız değerleriyle doldurun

npm run dev     # http://localhost:5173
npm run build   # dist/ klasörü oluşur — Hostinger'a FTP ile yükleyin
```

## Firebase İlk Kurulum

1. [Firebase Console](https://console.firebase.google.com/) → Yeni Proje
2. **Authentication** → Sign-in method → E-posta/Parola etkinleştir
3. **Firestore Database** → Create (production mode)
4. **Storage** → Create (opsiyonel, belge yüklemeleri için)
5. **Project Settings** → Web App ekle, config'i `.env.local`'e kopyala
6. İlk admin kullanıcısı:
   - Authentication → Add user (e-posta + parola)
   - Firestore → `users` koleksiyonu → Doküman ID = Firebase UID:
     ```json
     {
       "uid": "<FIREBASE_UID>",
       "email": "admin@kurum.org",
       "fullName": "Ad Soyad",
       "role": "admin",
       "active": true
     }
     ```
7. Güvenlik kuralları: `firebase deploy --only firestore:rules` (bkz. `firestore.rules`)

## Hostinger Yayınlama

`npm run build` sonrası `dist/` içeriğini `public_html/`'e yükleyin. SPA için `public_html/.htaccess`:

```
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Roller

| Rol | Yetki |
| --- | ----- |
| `admin` | Tüm modüllerde tam yetki, temsilci yönetimi |
| `manager` | Modüllerde geniş yetki, temsilci yönetimi yok |
| `representative` | Muhtaç/yardım ekleme, envanter okuma |
| `viewer` | Yalnızca okuma |

## Firestore Koleksiyonları

- `users` — temsilciler (doc id = Firebase UID)
- `beneficiaries` — muhtaçlar (searchTokens arama için)
- `donors` — bağışçılar
- `aids` — yardımlar (muhtaç ile denormalize)
- `inventory`, `inventoryMovements` — envanter ve hareketler
- `applications` — web başvuruları (public create, yetkili read)

## İleri Adımlar

- Web başvuru formu ayrı bir statik sitede veya ana site içinde bu Firebase projesine yazacak şekilde kurulabilir.
- reCAPTCHA + Firebase App Check ile başvuru spam koruması.
- Depo bazlı envanter için `warehouseId`, temsilci bazlı muhtaç erişimi için `assignedRepId` alanları eklenebilir.

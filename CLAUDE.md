# CLAUDE.md

Claude Code için proje rehberi.

## Proje Özeti

**Can Suyu Yardım** — yardım kuruluşu yönetim paneli.

- **Stack**: Vue 3 (Composition API) + PrimeVue (Aura) + Pinia + Firebase (Auth, Firestore, Storage)
- **Dağıtım**: Vite statik build → Hostinger paylaşımlı sunucu. Ayrı API servisi yoktur; tüm veri Firebase SDK üzerinden.
- **Dil**: Arayüz Türkçe.

## Komutlar

```bash
npm install
npm run dev        # localhost:5173
npm run build      # dist/
npm run typecheck
```

## Dizin Yapısı

```
src/
├── firebase/        # Firebase init
├── types/           # Domain types (Beneficiary, Aid, Donor, ...)
├── services/        # Firestore CRUD (collection başına bir dosya)
├── stores/          # Pinia (auth)
├── utils/           # search (TC doğrulama, token), format
├── router/          # rol & modül bazlı guard
├── layouts/         # MainLayout (sidebar + header)
├── features/        # beneficiaries, aids, donors, inventory, representatives, applications, backup, dashboard, auth
└── assets/styles/   # SCSS değişkenler & mixin'ler
```

## Veri Modeli

Firestore koleksiyonları: `users`, `beneficiaries`, `donors`, `aids`, `inventory`, `inventoryMovements`, `applications`.

Arama için `beneficiaries` ve `donors` dokümanlarında `searchTokens: string[]` tutulur (Türkçe karakter ASCII'ye indirgenir, prefix indeksleri oluşturulur — bkz. `src/utils/search.ts`).

## Yetkilendirme

Roller: `admin`, `manager`, `representative`, `viewer`. Eylem matrisi `src/types/index.ts`'deki `RolePermissions`'da. Auth store `can(module, action)` sağlar. Router `meta.module`/`meta.adminOnly` ile sayfa düzeyinde, şablonlar buton düzeyinde kontrol eder. Aynı kurallar `firestore.rules`'ta server-side uygulanır.

## Yeni Modül Ekleme

1. `src/types/index.ts`'e tip ekle, gerekirse `RolePermissions`'a modülü ekle.
2. `src/services/<modül>.ts` — Firestore CRUD.
3. `src/features/<modül>/` altında sayfaları oluştur.
4. `src/router/index.ts`'ye route'u `meta.module` ile ekle.
5. `src/layouts/MainLayout.vue`'deki `menuItems`'a ekle.

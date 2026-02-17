# Rentium - Stripe Setup rapide

## 1) Installer les dependances

```powershell
npm install
```

## 2) Configurer l'environnement

Copier `.env.example` vers `.env`, puis renseigner:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ESSENTIAL`
- `STRIPE_PRICE_PRO`
- `APP_URL` (ex: `http://localhost:4242`)

## 3) Lancer l'app

```powershell
npm run dev
```

Ouvrir `http://localhost:4242`.

## 4) Lancer le webhook Stripe en local

```powershell
stripe listen --forward-to http://localhost:4242/api/stripe/webhook
```

Recuperer le `whsec_...` et le coller dans `.env` (`STRIPE_WEBHOOK_SECRET`).

## 5) Test paiement

- Cliquer `Voir les plans`
- Cliquer `Choisir Essentiel` ou `Choisir Pro`
- Finaliser le checkout Stripe
- Retour app: plan active automatiquement

## Notes

- Le plan est stocke localement dans `data/plans.json` (mode demo).
- En production, brancher une vraie base de donnees et une authentification utilisateur.

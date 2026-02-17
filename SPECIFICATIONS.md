# Project Codex - Rentium (Version Essentiel)

## Objectif du projet

Créer un simulateur web de rentabilité locative accessible, rapide et utile, permettant à un investisseur immobilier ou à un particulier de :

- calculer la rentabilité locative d'un bien ;
- visualiser le cash-flow ;
- comparer plusieurs scénarios ;
- sauvegarder / exporter les résultats.

Le MVP est ciblé à 30 EUR-49 EUR en paiement unique (freemium simple), avec une phase gratuite puis des fonctionnalités payantes.

## Fonctionnalités indispensables - Version Essentiel

### Entrées utilisateur

L'utilisateur doit pouvoir saisir directement :

- Prix d'achat du bien
- Frais de notaire
- Travaux et ameublement
- Apport initial
- Taux du crédit
- Durée du crédit
- Assurance (pourcentage annuel)
- Loyer mensuel
- Vacance locative (pourcentage)
- Charges mensuelles non récupérables
- Taxe foncière annuelle
- Gestion locative (pourcentage)
- Entretien annuel

Cette saisie reproduit l'essentiel des simulateurs immobiliers existants (prix, loyer, charges, cash-flow).

### Résultats à afficher

Le simulateur doit calculer et afficher :

- Emprunt estimé
- Mensualité crédit (hors assurance)
- Assurance mensuelle
- Loyer annuel encaissé
- Charges annuelles
- Cashflow mensuel
- Rendement brut
- Rendement net

Ces métriques correspondent aux indicateurs principaux utilisés pour décider d'un achat locatif.

## Fonctionnalités Freemium - ESSENTIEL

### Version gratuite

- Simulation complète et résultats instantanés
- UI moderne (dark champagne)

### Version Essentiel payante (29 EUR)

- Export PDF professionnel
- Comparaison de 2 à 3 biens côte à côte
- Sauvegarde illimitée de scénarios
- Copier/partager un lien avec paramètres

## Interface / UI - règles clés

### Style visuel

- Thème dark + champagne
- Typographie sobre, icônes subtiles
- Résultats lisibles d'un coup d'oeil

### UX

- Formulaire structuré
- Mises à jour instantanées des résultats
- Résumé des indicateurs principaux bien visibles
- Lien partageable des paramètres

## Calculs - logique attendue

### Formules principales

- Rendement brut = (loyer x 12) / prix total
- Rendement net = (loyer annuel encaissé - charges annuelles) / prix total
- Cashflow annuel = loyer annuel encaissé - charges annuelles - crédit annuel

Ces métriques sont utilisées par la majorité des simulateurs immobiliers sur le marché.

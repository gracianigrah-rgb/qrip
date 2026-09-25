# Connexion simplifiée et ajout flexible des opérations

## Résultat attendu
- Mémoriser le numéro du dernier compte utilisé sur l’appareil afin qu’un membre déjà inscrit arrive directement au clavier de son code secret.
- Garder une option claire pour changer de numéro si une autre personne utilise l’appareil.
- Accepter les factures en photo, en image ou en PDF, puis conserver la vérification et la correction avant validation.
- Ajouter une saisie manuelle Achat/Vente avec les informations essentielles modifiables avant l’enregistrement.
- Remplacer l’ouverture actuelle par le seul logo fourni, sur un fond clair assorti.

## Écrans et parcours
- **Ouverture** : logo qrip seul, centré, puis redirection automatique.
- **Retour d’un membre** : code secret directement si son numéro est mémorisé ; lien « Changer de numéro » disponible.
- **Ajout** : depuis Achat ou Vente, choix entre photo, image/PDF et saisie manuelle.
- **Saisie manuelle** : type, montant, client/fournisseur, date et note ; tout reste modifiable jusqu’au bouton de validation.
- **Document importé** : aperçu pour une image, indication claire pour un PDF, suggestion automatique puis correction libre avant validation.

## Détails techniques
- Stocker uniquement le numéro normalisé sur l’appareil, jamais le code secret.
- Adapter l’analyse existante au format PDF attendu par le service d’analyse, avec validation du type et de la taille du fichier.
- Enregistrer les PDF dans l’espace privé des factures avec leur type de fichier réel.
- Réutiliser les protections et les règles d’accès actuelles pour les nouvelles opérations.

## Vérification
- Tester le retour direct au code et le changement de numéro.
- Tester une image, un PDF et une saisie manuelle Achat/Vente.
- Vérifier la correction avant validation, l’enregistrement et la mise à jour de la trésorerie.
- Contrôler visuellement l’écran d’ouverture sur mobile et ordinateur.

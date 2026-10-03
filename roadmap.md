# Roadmap

- [x] Construire l’accueil et l’importation de notes
- [x] Ajouter le créateur de leçon et les options d’animation
- [x] Ajouter le lecteur, les sous-titres et les chapitres
- [x] Ajouter le guide, le corrigé et le quiz
- [x] Ajouter le thème automatique avec modes clair et sombre
- [x] Vérifier l’affichage et les interactions
- [x] Remplacer l’ancien accueil par l’espace de dossiers orienté documents
- [x] Recomposer le cahier en éditeur tablette avec pages, outils et panneau d’analyse
- [x] Conserver les anciennes leçons dans un espace séparé
- [x] Rendre l’animation tableau blanc visible avec une main qui dessine
- [x] Déplacer les sous-titres sous l’image pour ne plus masquer la leçon
- [x] Ajouter une identité scolaire multicolore jaune, verte et violette
- [x] Remplacer l’icône par une vraie main au marqueur
- [x] Faire évoluer le tableau avec la narration sans boucle répétitive
- [x] Étendre la palette scolaire à l’ensemble du site
- [x] Calibrer les projecteurs après la création réelle de chaque illustration
- [x] Masquer tout projecteur dont l’objet n’est pas localisé avec certitude
- [x] Remplacer les images plates par un tableau blanc composé (bibliothèque de dessins, écriture, flèches) synchronisé sur la voix
- [x] Remplacer la professeure par l’illustration validée (accueil + pouce levé)
- [x] Robustesse réseau : réessais automatiques + reprise après changement d’onglet (plus de « Load failed » brut)
- [x] Dépôt multi-documents (jusqu’à 6 fichiers : PDF, texte, photos) avec aperçu, retrait ✕ et limites claires (25 Mo)
- [x] Choix de la durée de la vidéo (Auto / 3 / 5 / 8 / 10 min) et niveau d’explication (Essentiel → Examen)
- [x] Lecteur : recul/avance de 10 s, vitesse 0.75×–1.5×
- [x] Scènes latérales cliquables pour sauter à une scène
- [x] Tableau de bord : skeleton loader + confirmation avant suppression
- [x] Défilement automatique mobile vers l’exercice sélectionné
- [x] Moteur deux couches — couche 1 : dispositions procédurales (frise, cycle, diagramme à barres), badges symboliques et bulles d'explication, synchronisés sur la narration
- [x] Moteur deux couches — couche 2 (directeur) : le schéma de génération choisit les structures procédurales et demande une illustration seulement si pertinent
- [x] Catalogue local de personnages/poses (vérifier le cache avant toute génération externe)
- [x] Intégration Recraft + bibliothèque admin privée (/admin) : dessiner, approuver, refaire
- [x] Afficher dans l’Admin les vrais dessins préfabriqués colorés utilisés par le tableau blanc
- [ ] Dessiner les 505 concepts uniques sans réutiliser un dessin générique sous plusieurs noms (258 dessins distincts disponibles)
- [x] Permettre de masquer puis restaurer une icône depuis l’Admin, sans casser les anciennes leçons
- [ ] Brancher les illustrations approuvées dans les leçons générées
- [ ] Vérifier les pointages des deux leçons sur téléphone

- [ ] Générer une leçon réelle avec plusieurs documents pour valider le bout en bout
- [ ] Téléchargement MP4 (plus tard)

## Refonte du cahier selon les critiques du PDF

- [x] Centrer la page de notes dans l’espace de travail, avec un affichage adapté à la largeur et à la page entière
- [x] Rendre la barre d’outils personnalisable sans dupliquer les outils déjà présents
- [x] Ajouter favoris, règle, émoticônes, autocollants, ajout de page et marque-pages
- [x] Enrichir stylo, surligneur, formes, couleurs et épaisseurs
- [x] Remplacer le menu « … » par des actions complètes de page, partage, export et réglages
- [x] Ajouter une multivue navigable des pages
- [x] Corriger la latence et la fiabilité du stylet
- [x] Comptes + stockage en ligne (cours, dossiers, fichiers, annotations, médias, calendrier, notifications)
- [x] Nouvelle navigation : Tableau de bord, Cours, Dossiers, Bibliothèque, Notes, Calendrier, recherche, notifications
- [x] Enregistrer en ligne les pages ajoutées dans le cahier (page blanche/photo ajoutées dans un document existant)
- [x] Compter les fichiers des sous-dossiers et limiter l’imbrication à deux niveaux
- [x] Ajouter zoom personnalisable, pincement, choix du stylet persistant et défilement horizontal par défaut
- [x] Accélérer l’ouverture des documents sans laisser apparaître la page d’exemple
- [x] Retirer définitivement la page d’exemple du cahier vide
- [x] Ouvrir le chat sans renvoyer la dernière question sélectionnée
- [x] Simplifier le réglage « Stylet uniquement » en un seul interrupteur
- [x] Retirer la carte « Explorer un exemple » du tableau de bord
- [x] Ne plus forcer le mode stylet à l’usage du stylet : le réglage reste jusqu’à ce que tu le changes
- [x] Gommer avec le bouton latéral du stylet, même en cours de tracé, sans ouvrir le menu du navigateur

- [ ] Rappels par e-mail (hors application ouverte)

## Moteur d'animation sur le document
- [x] Table `animations` + clé OpenAI sécurisée
- [x] Analyse de page (zones animables / non animables) via OpenAI vision
- [x] Script d'explication en français (étapes : narration + zone + note)
- [x] Narration audio OpenAI TTS stockée dans le compte
- [x] Lecteur sur la page : surlignage progressif, pointeur, notes dessinées, sous-titres, synchronisés sur la voix
- [x] Animations enregistrées dans le cahier et dans la page du cours
- [ ] Test réel de bout en bout — bloqué : compte OpenAI sans crédits (à retester après rechargement des crédits)

- [x] Adapter Clario au rôle de tuteur académique et détecter les questions sur l’application
- [x] Demander confirmation avant transfert ; la demande arrive dans la boîte « Messages & Support » de l’espace Admin (courriel vers Lsephora67@gmail.com en attente d’un domaine d’expédition)
- [x] Vérifier le parcours complet et les erreurs (réponse graduée → confirmation → message dans l’Admin)

## Lot 1 (30 sept.)
- [x] Toute l’IA (chat, lecture de sélection, vidéos + voix) passe par la clé OpenAI de la propriétaire
- [x] Une seule barre en haut du cahier
- [x] Bouton vidéo agrandi
- [x] Icône qui change selon le stylo / surligneur choisi
- [x] Épaisseur exacte (− / + / chiffre / pastilles)
- [x] « Importer un fichier » ajoute des pages ; « Importer un média » pose photo/audio/vidéo sur la page ; « Ajouter une photo » retiré

## Lot 2 (30 sept.) — Cahier, gestes & narration
- [x] Partage multi-pages (dialogue avec onglets, sélection, PDF/images, partage natif)
- [x] Ajout de page inséré juste après la page active (pas à la fin)
- [x] Navigation retour (←) vers le dossier d'origine du document
- [x] Actions rapides de page : icônes + et 🗑️ dédiées
- [x] Glisser-déposer des miniatures de pages (réordonnancement)
- [x] Animations liées à leur page : réindexation auto + avertissement Supprimer/Délier
- [x] Sélecteur de fichiers universel sur tablette (pas seulement la galerie)
- [x] Suppression définitive des « Clips »
- [x] Fin du chevauchement du compteur « 3/5 »
- [x] Protection anti-saut de page au stylet sur la feuille
- [x] Narration vocale continue (une seule prise Chirp 3 HD)
- [x] Fluidité du tracé lasso

## Retouches immédiates du cahier (30 sept.)
- [x] Remplacer la multivue plein écran par un seul volet vertical sur tous les écrans
- [x] Ajouter le menu de chaque page et la suppression multiple dans ce volet
- [x] Conserver le compteur uniquement dans la barre inférieure, sans chevauchement
- [x] Ajouter au lasso les actions supprimer, redimensionner et couleur sans latence au déplacement
- [x] Vérifier ces retouches sur téléphone, tablette et ordinateur
- [x] Clarifier puis ajouter la mise en forme partielle des notes texte (police, couleur, taille)
- [ ] Traduire tout le cahier, le lecteur vidéo et les petites fenêtres (EN/FR) ; garder la langue choisie à la connexion

## Phase 2 — Vitrine publique, formules et app installable
- [x] Nouvelle page d'accueil publique bilingue (EN par défaut) : promesse, aperçu du cahier, « Comment ça marche », fonctionnalités, formules, FAQ
- [x] Page /pricing publique bilingue : Découverte gratuite, Pass Cahier Illimité 30,99 $, Club Pro et Recharges « bientôt », location-achat, notes conservées
- [x] Invitation discrète à installer Clario sur l'écran d'accueil, avec instructions iPhone/iPad (mémo de fermeture locale)
- [x] Manifest PWA complet (icône 512 maskable, standalone, thème) + icône apple-touch
- [x] Correctif : la langue enregistrée s'applique après hydratation (plus d'erreur d'hydratation SSR)
- [x] Test navigateur EN/FR, téléphone et ordinateur, visiteur et connecté (tableau de bord intact)
- [ ] Brancher les vrais prix du Club Pro / recharges et les paiements (Phase 3)

- [ ] Phase 3: checkout + crédits (produits créés en test ; en attente : règle changement mensuel↔annuel)
- [x] Créer les produits et prix (Pass 30,99 $, Club 6,99 $/mois ou 59,99 $/an, recharges 3,49 $/5,49 $)
- [x] Crédits sécurisés côté serveur (soldes, déduction atomique avant IA, remboursement si échec, limite 5 documents, versements via webhook signé)
- [x] Compteurs 💬🎬 dans la barre du haut, profil avec gestion d abonnement, page Tarifs avec boutons d achat
- [x] Règle rollover finale : les crédits appartiennent à l'étudiant pour toujours ; Club = 100 Q + 10 V par mois ; vitesse plafonnée à 300 Q + 35 V par mois avec le message Bahamas 🏖️ (migr. 0013, testée en base)
- [x] Retouches : compteurs 💬🎬 sans pilule, page Tarifs clarifiée (détails par formule) + bouton Retour, avatars réels Selena et Sam (profil, barre latérale, salutation)
- [ ] Tester un achat réel complet dans l aperçu (carte de test 4242 4242 4242 4242) — l iframe de paiement refuse l automation ; à faire à la main
- [ ] Publier, puis vérifier l identité pour les vrais paiements

## Ajustements tablette et quiz de page (2 oct.)
- [x] Sur tablette, pousser les compteurs de questions/vidéos et la cloche complètement à droite de la barre supérieure
- [x] Appliquer le plafond mensuel validé de Club Max : 600 questions + 70 vidéos
- [x] Ajouter un quiz interactif de 5 questions créé par Clario à partir de la page active pour 1 crédit-question, avec résultat enregistré sur la page
- [x] Remplacer l’icône installée de Clario par le robot sur fond jaune pastel, sans modifier l’accueil ni la connexion
- [x] Ajouter Club Max annuel à 119,99 $ avec 300 questions et 35 vidéos versées chaque mois
- [x] Limiter l’invitation d’installation à l’accueil/connexion, la faire revenir après actualisation, équilibrer A–E dans les quiz et retirer la flèche finale et son sous-texte
- [x] Masquer le bouton Accueil dans l’app installée, fournir des icônes HD adaptatives et synchroniser chaque scène sur sa narration réelle

## Admin v2 et suppression de compte (3 oct.)
- [x] Suppression de compte autonome : zone de danger dans le profil, confirmation, effacement des fichiers et des données, registres de facturation conservés
- [x] Admin : onglets Tickets & Support, Utilisateurs & Crédits, Équipe & Rôles, Archives graphiques (ancienne bibliothèque déplacée)
- [x] Rôle « support » (employé, tickets seulement) + ajustements de crédits avec raison et historique

## Cahier : texte, lasso et collage (3 oct.)
- [x] Texte manuscrit réouvert à l'outil Texte, gomme « texte » unifiée
- [x] Menu Copier du système capturé vers le presse-papiers du cahier
- [x] Collage découpé par ligne/puce, Markdown nettoyé, anti-débordement
- [x] Lasso qui découpe les traits traversés (partie entourée seulement)
- [x] Poignées médianes largeur/hauteur pour les images au lasso
- [x] Boîte de texte active : déplacement et largeur à la poignée, sans lasso
- [x] Verrouillage du changement de page sur les poignées et la note

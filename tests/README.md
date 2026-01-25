# Tests Forge - Suite de Tests Automatiques

**Documentation complète du système de tests pour Forge Standalone**

---

## 📋 Vue d'Ensemble

Ce dossier contient les **tests automatisés JavaScript** pour Forge Standalone. Chaque version de Forge possède sa propre suite de tests, permettant de valider le comportement et de détecter les régressions.

### Philosophie

Les tests servent de **documentation vivante** du comportement attendu de l'application. Ils garantissent que:
- ✅ Chaque fonctionnalité fonctionne comme prévu
- ✅ Les modifications ne cassent pas les fonctionnalités existantes
- ✅ Le code reste compréhensible et maintenable

---

## 📁 Structure

```
tests/
├── README.md                    # Ce fichier
├── test-forge-v0.1.1.html      # Tests Foundation (15 tests)
├── test-forge-v0.5.html        # Tests Éditeur (TBD)
├── test-forge-v1.0.html        # Tests MVP (TBD)
└── test-results/               # Historique résultats (optionnel)
    └── YYYY-MM-DD-vX.X.X.json
```

---

## 🎯 Fichiers de Tests Disponibles

| Fichier | Version | Tests | Status | Scope |
|---------|---------|-------|--------|-------|
| `test-forge-v0.1.1.html` | v0.1.1 | 15 | ✅ ACTIF | Login, Navigation, 4 types Bibliothèque |
| `test-forge-v0.5.html` | v0.5 | ~35 | ⏳ À CRÉER | + Éditeur Pine Script, Conversion Python |
| `test-forge-v1.0.html` | v1.0 | ~60 | ⏳ À CRÉER | + Chat IA, Backtest, Triple mode |
| `test-forge-v1.5.html` | v1.5 | ~80 | ⏳ À CRÉER | + Intelligence, Scoring, Suggestions |

---

## 🚀 Comment Utiliser

### 1. Ouvrir le Fichier de Test

```bash
# Dans le dossier dtego-forge
open tests/test-forge-v0.1.1.html
```

Ou double-cliquer sur le fichier dans Finder.

### 2. Lancer les Tests

Cliquer sur le bouton **"▶ Lancer les Tests"** dans l'interface.

### 3. Interpréter les Résultats

**Si tous les tests sont PASS (✅ verts):**
- ✅ L'application fonctionne correctement
- ✅ Safe de déployer
- ✅ Aucune régression détectée

**Si un ou plusieurs tests sont FAIL (❌ rouges):**
- ❌ Bug détecté
- ❌ Vérifier la console (F12) pour détails
- ❌ Corriger avant de déployer

### 4. Console Développeur

Pour voir les logs détaillés:
1. Ouvrir Console (F12 ou Cmd+Option+I)
2. Onglet "Console"
3. Voir résultats détaillés avec ✅/❌

---

## 📝 Détails test-forge-v0.1.1.html

### Scope de Couverture

**Version testée:** v0.1.1 (commit a947dc3)  
**Date:** 24 janvier 2026  
**Total tests:** 15

### Catégories de Tests

#### 🔐 Authentification (5 tests)
- Mot de passe correct accepté
- Mot de passe incorrect rejeté
- Sensibilité à la casse
- localStorage persistance sauvegarde
- localStorage persistance suppression

#### 🧭 Navigation (3 tests)
- Section par défaut = Atelier
- Navigation Atelier → Bibliothèque
- Navigation Bibliothèque → Atelier

#### 📚 Bibliothèque (7 tests)
- Nombre de types = 4
- Type 1: Indicateurs présent
- Type 2: Filtres présent
- Type 3: Stratégies présent
- Type 4: Stratégies Filtrées présent
- Ordre des types respecté
- Nomenclature cohérente

---

## 🛠️ Ajouter un Nouveau Test

### Dans un Fichier Existant

1. Ouvrir le fichier `.html` dans un éditeur
2. Trouver la catégorie appropriée (ou en créer une)
3. Ajouter le test:

```javascript
TestSuite.category('🎨 Ma Catégorie'); // Si nouvelle catégorie

TestSuite.test('Description du test', () => {
    // Arrange - Préparer les données
    const valeurAttendue = 'résultat';
    
    // Act - Exécuter l'action
    const valeurObtenue = maFonction();
    
    // Assert - Vérifier
    if (valeurObtenue !== valeurAttendue) {
        throw new Error(`Attendu "${valeurAttendue}", obtenu "${valeurObtenue}"`);
    }
});
```

4. Sauvegarder et tester

### Créer un Nouveau Fichier pour Nouvelle Version

1. Copier le fichier précédent:
```bash
cp test-forge-v0.1.1.html test-forge-v0.5.html
```

2. Mettre à jour l'en-tête:
```javascript
const TestSuite = {
    version: '0.5.0',  // Nouvelle version
    commit: 'abc1234',  // Nouveau commit
    // ...
};
```

3. Ajouter les nouveaux tests (conserver les anciens!)
4. Mettre à jour le scope dans le footer
5. Commit:
```bash
git add test-forge-v0.5.html
git commit -m "test: Add v0.5 test suite (35 tests)"
```

---

## 🔄 Workflow Développement

### Avant Modification

```bash
# 1. Vérifier que tout est OK
open tests/test-forge-v0.1.1.html
# Cliquer "Lancer les Tests"
# Vérifier: Tous PASS? ✅

# 2. Modifier le code
vim index.html

# 3. Re-tester
open tests/test-forge-v0.1.1.html
# Tous PASS? ✅ OK pour commit
# Un FAIL? ❌ Corriger le bug
```

### Lors d'une Nouvelle Version

```bash
# 1. Copier tests précédents
cp tests/test-forge-v0.1.1.html tests/test-forge-v0.5.html

# 2. Ajouter nouveaux tests dans v0.5
# (Éditer le fichier)

# 3. Vérifier pas de régression
open tests/test-forge-v0.5.html
# TOUS les tests (anciens + nouveaux) doivent PASS

# 4. Commit
git add tests/test-forge-v0.5.html
git commit -m "test: Add v0.5 test suite - 35 tests"
```

---

## 📊 Convention de Nommage

### Fichiers

```
test-forge-v{MAJOR}.{MINOR}.{PATCH}.html

Exemples:
- test-forge-v0.1.1.html  → Foundation
- test-forge-v0.5.0.html  → Éditeur Basique
- test-forge-v1.0.0.html  → MVP Triple Mode
- test-forge-v1.5.0.html  → Intelligence
```

### Messages Commits

```bash
# Création nouvelle suite
git commit -m "test: Add v0.5 test suite (35 tests)"

# Modification tests existants
git commit -m "test: Update v0.1.1 - Add auth timeout test"

# Correction bug dans tests
git commit -m "test: Fix v0.1.1 - Correct expected value"
```

---

## 🎯 Bonnes Pratiques

### ✅ À FAIRE

- Tester **AVANT** chaque commit
- Conserver **tous** les anciens tests dans nouvelles versions
- Écrire tests **clairs** et **descriptifs**
- Un test = une seule vérification
- Utiliser messages d'erreur **explicites**
- Documenter les cas limites

### ❌ À ÉVITER

- Supprimer des tests existants
- Tests dépendants les uns des autres
- Tests qui modifient l'état global
- Messages d'erreur vagues ("ça marche pas")
- Tester plusieurs choses dans un seul test

---

## 🐛 Debugging

### Test FAIL - Que Faire?

1. **Lire le message d'erreur**
   - Console navigateur (F12)
   - Message affiché dans UI

2. **Comprendre le test**
   - Quel comportement est testé?
   - Quelle valeur est attendue?

3. **Reproduire manuellement**
   - Tester l'action dans l'app réelle
   - Vérifier si le bug existe vraiment

4. **Corriger**
   - Option A: Bug dans le code → Corriger le code
   - Option B: Test incorrect → Corriger le test

5. **Re-tester**
   - Vérifier que le test PASS maintenant
   - Vérifier qu'aucun autre test n'a été cassé

---

## 📈 Historique

| Date | Version | Tests | Auteur | Notes |
|------|---------|-------|--------|-------|
| 24 jan 2026 | v0.1.1 | 15 | Ralph + Claude | Suite initiale - Foundation |
| TBD | v0.5 | ~35 | - | + Éditeur & Conversion |
| TBD | v1.0 | ~60 | - | + MVP Complet |
| TBD | v1.5 | ~80 | - | + Intelligence |

---

## 🔗 Ressources

- **Application Production:** https://forge.dtego.net
- **Repo GitHub:** https://github.com/rpelam/dtego-forge
- **Documentation Principale:** /mnt/project/DTEGO_SKILL.md
- **Handoff Session 29:** /mnt/project/HANDOFF_SESSION29.md

---

## 📞 Support

**Projet:** Dtego - Trading Algorithmique  
**Owner:** Ralph Pélamourgues (RA2P Production)  
**Email:** ralph@ra2p.com  
**Location:** Montreal, QC (UTC-5)

---

**Dernière mise à jour:** 24 janvier 2026  
**© RA2P Production • Dtego Forge Test Suite**

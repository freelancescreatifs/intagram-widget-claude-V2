# Widget Instagram Notion - Version Multi-Calendriers

## 🎉 Nouvelles Fonctionnalités

### 1. **Multi-Calendriers (Multi-bases Notion)**
- ✅ Ajoutez plusieurs calendriers (bases Notion) dans le même widget
- ✅ Chaque calendrier a son propre `databaseId`
- ✅ Basculez facilement entre les calendriers via des onglets
- ✅ Option "Tous" pour afficher un agrégat de tous les calendriers

### 2. **Filtres à Deux Niveaux**
- **Niveau 1 : Filtre par Calendrier** (violet)
  - Sélectionnez un calendrier spécifique ou "Tous"
  - Compteur de posts par calendrier
  
- **Niveau 2 : Filtre par Compte Instagram** (bleu)
  - Filtrez les posts par compte Instagram
  - S'adapte automatiquement au calendrier sélectionné
  - Compteur de posts dynamique

### 3. **Isolation Complète des Widgets**
- ✅ Chaque instance du widget est totalement indépendante
- ✅ Génération automatique d'un `widgetId` unique par instance
- ✅ Données stockées dans `localStorage` avec préfixe unique : `widget_xxxxx_yyyy`
- ✅ Plusieurs widgets peuvent coexister sur la même page sans conflit

### 4. **API URL Mise à Jour**
- ✅ Toutes les requêtes pointent vers : `https://freelance-creatif.vercel.app/api`

## 📋 Structure des Données localStorage

Chaque widget stocke ses données avec un préfixe unique :
```
widget_1730560000000_abc123_notionApiKey
widget_1730560000000_abc123_calendars
widget_1730560000000_abc123_activeCalendar
widget_1730560000000_abc123_instagramAccounts
widget_1730560000000_abc123_instagramProfiles
widget_1730560000000_abc123_showAllTab
```

## 🔧 Utilisation

### Ajouter un Calendrier
1. Cliquez sur **"Gérer les calendriers"** (bouton violet)
2. Entrez le nom du calendrier (ex: "Planning Mars 2024")
3. Collez l'ID de la base Notion (32 caractères)
4. Cliquez sur **"Ajouter"**

### Basculer entre Calendriers
- Utilisez les onglets violets pour sélectionner un calendrier
- Cliquez sur **"Tous"** pour voir tous les posts de tous les calendriers

### Ajouter des Comptes Instagram
1. Cliquez sur **"Gérer les comptes"** (bouton gris)
2. Ajoutez vos comptes Instagram
3. Les posts seront filtrés par compte

### Drag & Drop
- Glissez-déposez les posts pour changer leur ordre
- La date dans Notion est mise à jour automatiquement

## 🗂️ Structure du Projet

```
widget-agency-claude-main/
├── api/
│   └── notion.js              # API backend (inchangé)
├── public/
│   └── index.html             # HTML principal
├── src/
│   ├── App.js                 # ✨ NOUVEAU - Composant principal avec multi-calendriers
│   └── index.js               # Point d'entrée React
├── package.json               # Dépendances npm
└── README.md                  # Cette documentation
```

## 🚀 Installation

1. Installez les dépendances :
```bash
npm install
```

2. Lancez le serveur de développement :
```bash
npm start
```

3. Ouvrez http://localhost:3000

## 📦 Build pour Production

```bash
npm run build
```

Les fichiers seront générés dans le dossier `build/`.

## 🔑 Configuration Notion

### Colonnes Requises dans votre Base Notion

| Nom de la colonne | Type | Description |
|-------------------|------|-------------|
| **Couverture** | Files & media | Images/vidéos à poster |
| **Date** | Date | Date de publication |
| **Caption** | Text | Description du post |
| **Compte Instagram** | Select | Nom du compte Instagram |
| **Statut** | Select | Statut du post (ne pas utiliser "Posté") |

### Obtenir votre Clé API Notion

1. Allez sur https://www.notion.so/my-integrations
2. Créez une nouvelle intégration
3. Copiez le **"Internal Integration Token"** (commence par `ntn_`)
4. Partagez votre base Notion avec cette intégration

### Obtenir l'ID de votre Base Notion

L'URL de votre base ressemble à :
```
https://www.notion.so/workspace/abc123def456?v=...
```

L'ID est la partie entre le dernier `/` et le `?` : `abc123def456`
(32 caractères alphanumériques)

## 🎨 Personnalisation

### Couleurs des Filtres

Dans `App.js`, vous pouvez modifier les couleurs :

**Calendriers (violet)** :
```javascript
className="bg-purple-600 text-white"  // Actif
className="bg-gray-100 text-gray-700" // Inactif
```

**Comptes Instagram (bleu)** :
```javascript
className="bg-blue-600 text-white"    // Actif
className="bg-gray-100 text-gray-700" // Inactif
```

## ⚙️ Fonctionnalités Techniques

### Génération d'ID Unique

```javascript
const generateWidgetId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `widget_${timestamp}_${random}`;
};
```

### localStorage Isolé

```javascript
const getStorageKey = (key) => `${WIDGET_ID}_${key}`;

// Exemple d'utilisation
setLocalStorage('calendars', calendarsArray);
// Stocke dans: widget_1730560000000_abc123_calendars
```

### Agrégation des Posts

Le widget charge tous les posts de tous les calendriers en parallèle :

```javascript
const postsPromises = calendarsList.map(calendar => 
  fetchPostsFromCalendar(apiKey, calendar.databaseId, calendar.name)
);

const results = await Promise.all(postsPromises);
const combinedPosts = results.flat();
```

## 🐛 Débogage

### Problèmes Courants

**Les posts ne s'affichent pas**
- Vérifiez que la clé API est correcte
- Vérifiez que l'ID de la base est correct (32 caractères)
- Assurez-vous que la base est partagée avec l'intégration

**Les calendriers ne se synchronisent pas**
- Ouvrez la console du navigateur (F12)
- Recherchez les erreurs réseau dans l'onglet Network
- Vérifiez que l'API répond à `https://freelance-creatif.vercel.app/api/notion`

**Le localStorage est plein**
- Chaque widget utilise environ 50-200 KB
- Supprimez les anciens widgets inutilisés via les DevTools → Application → localStorage

## 📞 Support

Créé par [@Freelancecreatif](https://www.instagram.com/freelance.creatif/)

Pour toute question ou problème, contactez-moi sur Instagram !

---

## 🆕 Changelog

### Version 2.0 (Novembre 2024)
- ✨ Ajout du support multi-calendriers
- ✨ Isolation complète des widgets
- ✨ Filtres à deux niveaux (Calendrier + Compte)
- ✨ Gestionnaire de calendriers avec CRUD complet
- ✨ Migration vers `https://freelance-creatif.vercel.app/api`
- 🐛 Corrections mineures et optimisations

### Version 1.0
- 🎉 Première version avec support mono-calendrier
- 🎨 Interface style Instagram
- 🔄 Drag & drop avec synchronisation Notion
- 👥 Multi-comptes Instagram

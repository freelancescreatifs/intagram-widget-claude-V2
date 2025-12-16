// App.jsx (ou App.js) - Version Améliorée
import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Settings, RefreshCw, Edit3, X, ChevronLeft, ChevronRight, Play, Plus, ChevronDown, Calendar, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * ✅ API backend
 */
const API_BASE = 'https://instagram-widget-claude.vercel.app/api';

/* -------------------------- Isolation par widget -------------------------- */

// 1) Récupère wid depuis query OU hash (ex: ?wid=client-a ou #wid=client-a)
const getWidFromUrl = () => {
  try {
    const searchWid = new URLSearchParams(window.location.search).get('wid');
    const hashWid = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('wid');
    return (searchWid || hashWid || '').trim() || null;
  } catch {
    return null;
  }
};

// 2) Fallback session si pas de wid explicite (persiste tant que l'onglet vit)
const getSessionId = () => {
  try {
    if (!window.name) {
      window.name = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    }
    return window.name;
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

// 3) ID "effectif" : priorité à ?wid / #wid (et STOP là si présent)
const getEffectiveWidgetId = () => {
  const urlWid = getWidFromUrl();
  if (urlWid) return `wid_${urlWid}`;  // ✅ STOP ICI si wid dans URL
  
  // Seulement si PAS de wid dans l'URL :
  const named = localStorage.getItem('widget_custom_name');
  if (named && named.trim()) return named.trim();
  return `session_${getSessionId()}`;
};

/* ------------------------------ Utilitaires ------------------------------ */

const detectMediaType = (urls) => {
  if (!urls || urls.length === 0) return 'Image';
  const hasVideo = urls.some(url =>
    url.match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i) || url.includes('video') || url.includes('.mp4')
  );
  if (hasVideo) return 'Vidéo';
  if (urls.length > 1) return 'Carrousel';
  return 'Image';
};

// ✅ Messages d'erreur en français avec solutions
const ERROR_MESSAGES = {
  NOTION_API_INVALID: {
    title: "❌ Clé API Notion invalide",
    message: "La clé API fournie ne fonctionne pas.",
    solution: "Vérifiez que votre clé commence par 'secret_' et qu'elle a les bonnes permissions."
  },
  DATABASE_NOT_FOUND: {
    title: "❌ Base de données introuvable", 
    message: "L'ID de base de données Notion est incorrect ou inaccessible.",
    solution: "Copiez l'ID depuis l'URL de votre page Notion (32 caractères après le dernier /)."
  },
  MISSING_COLUMNS: {
    title: "⚠️ Colonnes manquantes",
    message: "Certaines colonnes requises sont manquantes dans votre base Notion.",
    solution: "Ajoutez les colonnes : 'Titre' (texte), 'Date' ou 'Date de publication' (date), 'Couverture' ou 'Visuel' (fichier), 'Caption' ou 'Légende' (texte)."
  },
  NETWORK_ERROR: {
    title: "🌐 Erreur de connexion",
    message: "Impossible de se connecter à Notion.",
    solution: "Vérifiez votre connexion internet et réessayez."
  },
  SYNC_ERROR: {
    title: "🔄 Erreur de synchronisation",
    message: "Impossible de mettre à jour la date dans Notion.",
    solution: "Vérifiez que votre intégration a les permissions d'écriture sur la base."
  },
  FIELD_MAPPING_ERROR: {
    title: "🏷️ Erreur de mapping des champs",
    message: "Impossible de trouver les colonnes nécessaires.",
    solution: "Renommez vos colonnes : Date → 'Date' ou 'Date de publication', Image → 'Couverture' ou 'Visuel', Texte → 'Caption' ou 'Légende'."
  }
};

/* --------------------------------- UI ----------------------------------- */

// ✅ Composant de notification amélioré
const Notification = ({ notification, onClose }) => {
  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle size={20} className="text-green-600" />;
      case 'error': return <AlertCircle size={20} className="text-red-600" />;
      case 'warning': return <AlertCircle size={20} className="text-yellow-600" />;
      default: return <Info size={20} className="text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const errorInfo = notification.error ? ERROR_MESSAGES[notification.error] : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-fade-in">
      <div className={`border rounded-lg shadow-lg p-4 ${getBgColor()}`}>
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900">
              {errorInfo?.title || notification.message}
            </div>
            {errorInfo && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">{errorInfo.message}</p>
                <p className="text-xs text-gray-800 font-medium">
                  💡 {errorInfo.solution}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const MediaDisplay = ({ urls, caption }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!urls || urls.length === 0) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ aspectRatio: '1080/1350' }}>
        <span className="text-gray-500 text-xs">Pas de média</span>
      </div>
    );
  }

  const detectedType = detectMediaType(urls);
  const isVideo = detectedType === 'Vidéo';
  const isCarousel = urls.length > 1;
  const currentUrl = urls[currentIndex];

  return (
    <div className="relative w-full h-full group">
      {currentUrl && currentUrl.match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i) ? (
        <video
          src={currentUrl}
          className="w-full h-full object-cover"
          style={{ aspectRatio: '1080/1350' }}
          controls={false}
          muted
          loop
        />
      ) : (
        <img
          src={currentUrl}
          alt="Post"
          className="w-full h-full object-cover"
          style={{ aspectRatio: '1080/1350' }}
          onError={(e) => {
            e.target.src = `https://picsum.photos/1080/1350?random=${Date.now()}`;
          }}
        />
      )}

      {isCarousel && (
        <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="6" height="18"/>
            <rect x="9" y="3" width="6" height="18"/>
            <rect x="15" y="3" width="6" height="18"/>
          </svg>
        </div>
      )}

      {isVideo && (
        <div className="absolute top-2 right-2 text-white drop-shadow-lg z-10">
          <Play size={16} fill="white" stroke="white" />
        </div>
      )}

      {isCarousel && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev > 0 ? prev - 1 : urls.length - 1); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ width: '28px', height: '28px' }}
          >
            <ChevronLeft size={16} className="mx-auto" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev < urls.length - 1 ? prev + 1 : 0); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ width: '28px', height: '28px' }}
          >
            <ChevronRight size={16} className="mx-auto" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
            {urls.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                className={`w-2 h-2 rounded-full transition-all ${index === currentIndex ? 'bg-white' : 'bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity" style={{ height: '40px' }}>
        <div className="absolute bottom-1 left-2 right-2 text-white text-xs font-medium truncate">
          {caption || 'Cliquer pour voir en détail'}
        </div>
      </div>
    </div>
  );
};

const PostModal = ({ post, isOpen, onClose, onNavigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  if (!isOpen || !post) return null;

  const urls = post.urls || [];
  const detectedType = detectMediaType(urls);

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50" onClick={onClose}>
      <div className="relative max-w-2xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 z-20 bg-black/50 rounded-full p-2">
          <X size={24} />
        </button>

        {onNavigate && (
          <>
            <button onClick={() => onNavigate('prev')} className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-20 bg-black/50 rounded-full p-2">
              <ChevronLeft size={32} />
            </button>
            <button onClick={() => onNavigate('next')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-20 bg-black/50 rounded-full p-2">
              <ChevronRight size={32} />
            </button>
          </>
        )}

        <div className="flex flex-col items-center max-w-lg">
          <div className="relative bg-black rounded-lg overflow-hidden">
            {urls[currentIndex] && (
              <>
                {urls[currentIndex].match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i) ? (
                  <video 
                    src={urls[currentIndex]} 
                    className="max-w-sm max-h-[60vh] object-contain" 
                    style={{ aspectRatio: '1080/1350' }}
                    controls 
                    autoPlay 
                  />
                ) : (
                  <img 
                    src={urls[currentIndex]} 
                    alt={post.title} 
                    className="max-w-sm max-h-[60vh] object-contain"
                    style={{ aspectRatio: '1080/1350' }}
                  />
                )}

                {urls.length > 1 && (
                  <>
                    <button onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : urls.length - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full p-2">
                      <ChevronLeft size={20} />
                    </button>
                    <button onClick={() => setCurrentIndex(prev => prev < urls.length - 1 ? prev + 1 : 0)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white rounded-full p-2">
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                      {urls.map((_, index) => (
                        <button key={index} onClick={() => setCurrentIndex(index)} className={`w-2.5 h-2.5 rounded-full ${index === currentIndex ? 'bg-white' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="text-white text-center mt-6 px-4">
            <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
            {post.caption && <p className="text-sm text-gray-300 mb-3 leading-relaxed">{post.caption}</p>}
            <div className="text-xs text-gray-400 space-y-1">
              <p>📅 {post.date && new Date(post.date).toLocaleDateString('fr-FR')}</p>
              <p>📷 {detectedType} {urls.length > 1 && `(${urls.length} médias)`}</p>
              {post.account && <p>👤 {post.account}</p>}
              {post.calendarName && <p>📆 {post.calendarName}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ✅ Composant DraggablePost avec indicateurs visuels améliorés */
const DraggablePost = ({ post, index, isDragging, isDropTarget, onDragStart, onDragEnd, onDragOver, onDragEnter, onDragLeave, onDrop, onClick }) => {
  return (
    <div
      draggable={!!post}
      onDragStart={(e) => post && onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => post && onDragOver(e, index)}
      onDragEnter={(e) => post && onDragEnter(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => post && onDrop(e, index)}
      onClick={onClick}
      className={`aspect-square bg-white cursor-pointer transition-all duration-200 relative
        ${post ? 'hover:opacity-80' : ''} 
        ${isDragging ? 'opacity-30 scale-95 rotate-2 z-50' : ''} 
        ${isDropTarget ? 'ring-4 ring-blue-500 ring-inset bg-blue-50 scale-105' : ''}
        ${post ? 'hover:shadow-lg hover:z-10' : ''}
      `}
      style={{
        aspectRatio: '1080/1350',
        transform: isDragging ? 'rotate(2deg) scale(0.95)' : isDropTarget ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {post ? (
        <>
          <MediaDisplay urls={post.urls} caption={post.caption} />
          
          {/* ✅ Indicateur de déplacement amélioré */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg flex items-center justify-center z-10">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                📋 Déplacement...
              </div>
            </div>
          )}
          
          {/* ✅ Indicateur de zone de dépôt */}
          {isDropTarget && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-500/30 border-3 border-blue-500 border-dashed rounded-lg flex items-center justify-center z-10 animate-pulse">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                📍 Déposer ici
              </div>
            </div>
          )}
          
          {/* ✅ Indicateur hover subtil */}
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/10 flex items-center justify-center">
            <div className="bg-black/70 text-white px-2 py-1 rounded text-xs">
              ✋ Glisser pour réorganiser
            </div>
          </div>
        </>
      ) : (
        <div className="w-full h-full bg-gray-50"></div>
      )}
    </div>
  );
};

/* ------------------------------ Composant App ----------------------------- */

const InstagramNotionWidget = () => {
  // ✅ WIDGET_ID calculé dynamiquement à chaque render
  const WIDGET_ID = useMemo(() => getEffectiveWidgetId(), []);
  
  // Helpers de storage namespacés (recalculés avec le bon WIDGET_ID)
  const getStorageKey = (key) => `igw:${WIDGET_ID}:${key}`;

  const getLocalStorage = (key, defaultValue = null) => {
    try {
      const value = localStorage.getItem(getStorageKey(key));
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      console.error('Erreur lecture localStorage:', e);
      return defaultValue;
    }
  };

  const setLocalStorage = (key, value) => {
    try {
      localStorage.setItem(getStorageKey(key), JSON.stringify(value));
    } catch (e) {
      console.error('Erreur écriture localStorage:', e);
    }
  };

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isProfileEdit, setIsProfileEdit] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState('');
  const [widgetName, setWidgetName] = useState('');

  // Multi-calendriers
  const [calendars, setCalendars] = useState([]);
  const [activeCalendar, setActiveCalendar] = useState('default');
  const [isCalendarManager, setIsCalendarManager] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDbId, setNewCalendarDbId] = useState('');
  const [editingCalendar, setEditingCalendar] = useState(null);
  const [editCalendarName, setEditCalendarName] = useState('');
  const [editCalendarDbId, setEditCalendarDbId] = useState('');

  const [allPosts, setAllPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);

  // Drag & drop amélioré
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Comptes Instagram
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState('All');
  const [showAllTab, setShowAllTab] = useState(true);
  const [isAccountManager, setIsAccountManager] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [editAccountName, setEditAccountName] = useState('');

  const [profiles, setProfiles] = useState({
    'All': {
      username: 'mon_compte',
      fullName: 'Mon Compte Principal',
      bio: '🚀 Créateur de contenu\n📸 Planning Instagram\n📍 Paris, France',
      profilePhoto: '',
      followers: '1,234',
      following: '567'
    }
  });

  // ✅ Fonction de notification améliorée
  const showNotification = (message, type = 'success', errorCode = null) => {
    setNotification({ message, type, error: errorCode });
    setTimeout(() => setNotification(null), type === 'error' ? 6000 : 3000);
  };

  useEffect(() => {
    const savedApiKey = getLocalStorage('notionApiKey', '');
    const savedCalendars = getLocalStorage('calendars', []);
    const savedActiveCalendar = getLocalStorage('activeCalendar', 'default');
    const savedProfiles = getLocalStorage('instagramProfiles', null);
    const savedAccounts = getLocalStorage('instagramAccounts', []);
    const savedShowAllTab = getLocalStorage('showAllTab', true);
    
    // ✅ Si on a un wid dans l'URL, on charge le nom depuis le storage isolé
    const urlWid = getWidFromUrl();
    const savedWidgetName = urlWid 
      ? (getLocalStorage('displayName', '') || '')
      : (localStorage.getItem('widget_custom_name') || '');

    if (savedWidgetName) setWidgetName(savedWidgetName);
    if (savedApiKey) setNotionApiKey(savedApiKey);

    if (savedCalendars && savedCalendars.length > 0) {
      setCalendars(savedCalendars);
      setActiveCalendar(savedActiveCalendar);
      loadAllCalendarsPosts(savedApiKey, savedCalendars);
      setTimeout(() => showNotification(`✅ Widget "${WIDGET_ID}" chargé`, 'success'), 500);
    } else if (savedApiKey) {
      setTimeout(() => showNotification('⚙️ Ajoutez un calendrier pour commencer', 'info'), 500);
    }

    if (savedProfiles) setProfiles(savedProfiles);
    if (savedShowAllTab !== null) setShowAllTab(savedShowAllTab);
    if (savedAccounts && savedAccounts.length > 0) {
      setAccounts(savedAccounts);
      if (activeAccount === 'All') setActiveAccount(savedAccounts[0]);
    }

    console.log('📊 Widget Chargé:', {
      widgetId: WIDGET_ID,
      widFromUrl: getWidFromUrl(),
      calendars: savedCalendars.length,
      accounts: savedAccounts.length,
      storageKeys: Object.keys(localStorage).filter(k => k.includes(WIDGET_ID))
    });
  }, [WIDGET_ID]);

  /* ------------------------- Chargement des posts ------------------------- */

  const fetchJsonNoStore = async (url, options = {}) => {
    const resp = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', ...(options.headers || {}) },
      ...options,
    });
    return resp;
  };

  const loadAllCalendarsPosts = async (apiKey = notionApiKey, calendarsList = calendars) => {
    if (!apiKey || !calendarsList || calendarsList.length === 0) return;
    setIsRefreshing(true);
    try {
      const postsPromises = calendarsList.map(c => fetchPostsFromCalendar(apiKey, c.databaseId, c.name));
      const results = await Promise.all(postsPromises);
      const combined = results.flat();
      setAllPosts(combined);
      if (combined.length > 0) {
        showNotification(`✅ ${combined.length} posts chargés avec succès`, 'success');
      } else {
        showNotification('Aucun post trouvé dans vos calendriers', 'warning');
      }
    } catch (e) {
      console.error('Erreur chargement calendriers:', e);
      showNotification('Erreur lors du chargement', 'error', 'NETWORK_ERROR');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const fetchPostsFromCalendar = async (apiKey, databaseId, calendarName) => {
    console.log(`🚀 Chargement ${calendarName}...`);
    
    try {
      const response = await fetchJsonNoStore(`${API_BASE}/notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, databaseId }),
      });
      
      console.log(`📊 Réponse ${calendarName}:`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur HTTP ${calendarName}:`, response.status, errorText);
        showNotification(`❌ Erreur HTTP ${response.status} pour ${calendarName}`, 'error');
        return [];
      }
      
      const data = await response.json();
      console.log(`📋 Données ${calendarName}:`, data);
      
      if (data.success) {
        const validPosts = data.posts.filter(p => p.urls && p.urls.length > 0);
        console.log(`✅ ${calendarName}: ${validPosts.length}/${data.posts.length} posts avec médias`);
        
        if (data.meta) {
          console.log(`📊 ${calendarName} - Métadonnées:`, data.meta);
          if (data.meta.withoutMedia > 0) {
            console.log(`⚠️ ${data.meta.withoutMedia} posts sans média ignorés`);
          }
        }
        
        return validPosts.map(p => ({ ...p, calendarName }));
      } else {
        console.error(`❌ ${calendarName} - API error:`, data.error);
        
        // Messages d'erreur clairs basés sur l'ancienne logique
        if (data.error?.includes('🔑') || data.error?.includes('API')) {
          showNotification(`🔑 Clé API invalide pour ${calendarName}`, 'error');
        } else if (data.error?.includes('📊') || data.error?.includes('database') || data.error?.includes('Base de données')) {
          showNotification(`📊 Base "${calendarName}" introuvable - vérifiez l\'ID`, 'error');
        } else if (data.error?.includes('🚫') || data.error?.includes('Accès refusé')) {
          showNotification(`🚫 Accès refusé à "${calendarName}" - vérifiez les permissions`, 'error');
        } else {
          showNotification(`❌ ${calendarName}: ${data.error || 'Erreur inconnue'}`, 'error');
        }
        
        return [];
      }
    } catch (error) {
      console.error(`💥 Exception ${calendarName}:`, error);
      showNotification(`💥 Erreur de connexion pour ${calendarName}`, 'error');
      return [];
    }
  };

  const fetchPosts = async () => {
    setShowRefreshMenu(false);
    await loadAllCalendarsPosts();
  };

  /* --------------------------- Drag & Drop dates -------------------------- */

  const calculateNewDate = (prevPost, nextPost) => {
    const now = new Date();
    if (!prevPost && !nextPost) return now.toISOString().split('T')[0];
    if (!prevPost) {
      const nextDate = new Date(nextPost.date);
      return new Date(nextDate.getTime() + 86400000).toISOString().split('T')[0];
    }
    if (!nextPost) {
      const prevDate = new Date(prevPost.date);
      return new Date(prevDate.getTime() - 86400000).toISOString().split('T')[0];
    }
    const prevTime = new Date(prevPost.date).getTime();
    const nextTime = new Date(nextPost.date).getTime();
    return new Date((prevTime + nextTime) / 2).toISOString().split('T')[0];
  };

  const syncDateToNotion = async (post, newDate) => {
    if (isSyncing) return;
    setIsSyncing(true);

    const calendar = calendars.find(cal => cal.name === post.calendarName);
    if (!calendar) {
      showNotification('Calendrier introuvable', 'error', 'DATABASE_NOT_FOUND');
      setIsSyncing(false);
      return;
    }

    try {
      const response = await fetchJsonNoStore(`${API_BASE}/notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: notionApiKey,
          databaseId: calendar.databaseId,
          action: 'updateDate',
          postId: post.id,
          newDate,
        }),
      });
      const result = await response.json();
      if (result.success) {
        showNotification(`✅ Date mise à jour: ${new Date(newDate).toLocaleDateString('fr-FR')}`, 'success');
        setTimeout(() => { fetchPosts(); }, 800);
      } else {
        console.error('Erreur:', result.error);
        showNotification('Impossible de mettre à jour', 'error', 'SYNC_ERROR');
      }
    } catch (e) {
      console.error('Erreur synchronisation:', e);
      showNotification('Erreur de synchronisation', 'error', 'SYNC_ERROR');
    } finally {
      setIsSyncing(false);
    }
  };

  /* -------------------------- Connexion & réglages ------------------------ */

  const connectToNotion = async () => {
    if (!notionApiKey) {
      return showNotification('Veuillez saisir la clé API', 'error', 'NOTION_API_INVALID');
    }
    if (calendars.length === 0) {
      return showNotification('Veuillez ajouter au moins un calendrier', 'error', 'MISSING_COLUMNS');
    }
    setLocalStorage('notionApiKey', notionApiKey);
    await loadAllCalendarsPosts();
    setIsConfigOpen(false);
  };

  // ✅ Sauvegarde/rename du nom de widget
  const saveWidgetName = () => {
    if (!widgetName.trim()) {
      return showNotification('⚠️ Veuillez entrer un nom pour le widget', 'error');
    }

    const urlWid = getWidFromUrl();
    if (urlWid) {
      // Avec ?wid= : sauvegarde isolée seulement
      setLocalStorage('displayName', widgetName);
      showNotification(`✅ Nom du widget: "${widgetName}"`, 'success');
      return;
    }

    // Sans ?wid= : comportement normal avec migration
    const allKeys = Object.keys(localStorage);
    const conflict = allKeys.some(k => k.startsWith(`${widgetName}_`) || k.startsWith(`igw:${widgetName}:`));
    if (conflict && widgetName !== WIDGET_ID) {
      return showNotification('❌ Ce nom est déjà utilisé', 'error');
    }

    const oldPrefix1 = `${WIDGET_ID}_`;
    const oldPrefix2 = `igw:${WIDGET_ID}:`;
    const toMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(oldPrefix1) || key.startsWith(oldPrefix2)) toMigrate.push(key);
    }
    toMigrate.forEach(oldKey => {
      const val = localStorage.getItem(oldKey);
      const newKey = oldKey.startsWith(oldPrefix1)
        ? `${widgetName}_${oldKey.slice(oldPrefix1.length)}`
        : `igw:${widgetName}:${oldKey.slice(oldPrefix2.length)}`;
      localStorage.setItem(newKey, val);
    });

    localStorage.setItem('widget_custom_name', widgetName);

    if (WIDGET_ID.startsWith('session_') || WIDGET_ID.startsWith('wid_')) {
      toMigrate.forEach(k => localStorage.removeItem(k));
    }

    showNotification(`✅ Widget renommé en "${widgetName}"`, 'success');
    setTimeout(() => window.location.reload(), 1000);
  };

  const resetWidget = () => {
    if (!window.confirm('⚠️ Réinitialiser ce widget ?')) return;
    try {
      const prefix1 = `${WIDGET_ID}_`;
      const prefix2 = `igw:${WIDGET_ID}:`;
      const delKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(prefix1) || k.startsWith(prefix2))) delKeys.push(k);
      }
      delKeys.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('widget_custom_name');
      showNotification('✅ Widget réinitialisé avec succès', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error(e);
      showNotification('Erreur lors de la réinitialisation', 'error');
    }
  };

  const createNewWidget = () => {
    if (!window.confirm('🆕 Créer un nouveau widget ?')) return;
    try {
      localStorage.removeItem('widget_custom_name');
      showNotification('🆕 Nouveau widget créé !', 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      console.error(e);
      showNotification('Erreur', 'error');
    }
  };

  /* --------------------------- Gestion Calendriers ------------------------ */

  const addCalendar = () => {
    if (!newCalendarName.trim() || !newCalendarDbId.trim()) {
      return showNotification('Veuillez remplir tous les champs', 'error');
    }
    
    // Validation de l'ID Notion
    if (newCalendarDbId.trim().length !== 32) {
      return showNotification('L\'ID de base Notion doit faire 32 caractères', 'error', 'DATABASE_NOT_FOUND');
    }
    
    const exists = calendars.some(c => c.name === newCalendarName.trim() || c.databaseId === newCalendarDbId.trim());
    if (exists) {
      return showNotification('Ce calendrier existe déjà', 'error');
    }
    const newCalendar = { name: newCalendarName.trim(), databaseId: newCalendarDbId.trim() };
    const updatedCalendars = [...calendars, newCalendar];
    setCalendars(updatedCalendars);
    setLocalStorage('calendars', updatedCalendars);
    setActiveCalendar(newCalendarName.trim());
    setLocalStorage('activeCalendar', newCalendarName.trim());
    setNewCalendarName('');
    setNewCalendarDbId('');
    setIsCalendarManager(false);
    loadAllCalendarsPosts(notionApiKey, updatedCalendars);
    showNotification(`✅ Calendrier "${newCalendarName.trim()}" ajouté`, 'success');
  };

  const removeCalendar = (calendarToRemove) => {
    const updatedCalendars = calendars.filter(c => c.name !== calendarToRemove);
    setCalendars(updatedCalendars);
    setLocalStorage('calendars', updatedCalendars);
    if (activeCalendar === calendarToRemove) {
      const newActive = updatedCalendars.length > 0 ? updatedCalendars[0].name : 'default';
      setActiveCalendar(newActive);
      setLocalStorage('activeCalendar', newActive);
    }
    loadAllCalendarsPosts(notionApiKey, updatedCalendars);
    showNotification(`✅ Calendrier "${calendarToRemove}" supprimé`, 'success');
  };

  const startEditCalendar = (calendar) => {
    setEditingCalendar(calendar.name);
    setEditCalendarName(calendar.name);
    setEditCalendarDbId(calendar.databaseId);
  };

  const saveEditCalendar = () => {
    if (!editCalendarName.trim() || !editCalendarDbId.trim()) {
      setEditingCalendar(null);
      return;
    }
    
    // Validation de l'ID Notion
    if (editCalendarDbId.trim().length !== 32) {
      showNotification('L\'ID de base Notion doit faire 32 caractères', 'error', 'DATABASE_NOT_FOUND');
      return;
    }
    
    const updatedCalendars = calendars.map(c =>
      c.name === editingCalendar
        ? { name: editCalendarName.trim(), databaseId: editCalendarDbId.trim() }
        : c
    );
    setCalendars(updatedCalendars);
    setLocalStorage('calendars', updatedCalendars);
    if (activeCalendar === editingCalendar) {
      setActiveCalendar(editCalendarName.trim());
      setLocalStorage('activeCalendar', editCalendarName.trim());
    }
    setEditingCalendar(null);
    setEditCalendarName('');
    setEditCalendarDbId('');
    loadAllCalendarsPosts(notionApiKey, updatedCalendars);
    showNotification('✅ Calendrier mis à jour', 'success');
  };

  const cancelEditCalendar = () => {
    setEditingCalendar(null);
    setEditCalendarName('');
    setEditCalendarDbId('');
  };

  /* ------------------------------ Profils/Comptes ------------------------- */

  const getProfile = (account) =>
    profiles[account] || profiles['All'] || {
      username: 'mon_compte',
      fullName: 'Mon Compte',
      bio: '🚀 Créateur de contenu\n📸 Planning Instagram\n📍 Paris, France',
      profilePhoto: '',
      followers: '1,234',
      following: '567'
    };

  const saveProfile = (account, profileData) => {
    const newProfiles = { ...profiles, [account]: profileData };
    setProfiles(newProfiles);
    setLocalStorage('instagramProfiles', newProfiles);
  };

  const hideAllTab = () => {
    setShowAllTab(false);
    setLocalStorage('showAllTab', false);
    if (activeAccount === 'All' && accounts.length > 0) setActiveAccount(accounts[0]);
  };

  const addAccount = () => {
    if (!newAccountName.trim() || accounts.includes(newAccountName.trim())) return;
    const newAcc = newAccountName.trim();
    const newAccounts = [...accounts, newAcc];
    setAccounts(newAccounts);

    const newProf = {
      username: newAcc.toLowerCase().replace(/\s+/g, '_'),
      fullName: newAcc,
      bio: `🚀 ${newAcc}\n📸 Créateur de contenu\n📍 Paris, France`,
      profilePhoto: '',
      followers: '1,234',
      following: '567'
    };

    const newProfiles = { ...profiles, [newAcc]: newProf };
    setProfiles(newProfiles);

    setLocalStorage('instagramAccounts', newAccounts);
    setLocalStorage('instagramProfiles', newProfiles);

    setActiveAccount(newAcc);
    setNewAccountName('');
    setIsAccountManager(false);
    showNotification(`✅ Compte "${newAcc}" ajouté`, 'success');
  };

  const removeAccount = (accountToRemove) => {
    const newAccounts = accounts.filter(acc => acc !== accountToRemove);
    setAccounts(newAccounts);

    if (activeAccount === accountToRemove) {
      if (newAccounts.length > 0) setActiveAccount(newAccounts[0]);
      else {
        setActiveAccount('All');
        setShowAllTab(true);
        setLocalStorage('showAllTab', true);
      }
    }

    const newProfiles = { ...profiles };
    delete newProfiles[accountToRemove];
    setProfiles(newProfiles);

    setLocalStorage('instagramAccounts', newAccounts);
    setLocalStorage('instagramProfiles', newProfiles);
    showNotification(`✅ Compte "${accountToRemove}" supprimé`, 'success');
  };

  const removeAllAccounts = () => {
    if (!window.confirm('⚠️ Supprimer tous les comptes ?')) return;
    setAccounts([]);
    setActiveAccount('All');
    const newProfiles = { 'All': profiles['All'] || getProfile('All') };
    setProfiles(newProfiles);
    setLocalStorage('instagramAccounts', []);
    setLocalStorage('instagramProfiles', newProfiles);
    setIsAccountManager(false);
    showNotification('✅ Tous les comptes supprimés', 'success');
  };

  const renameAccount = (oldName, newName) => {
    if (!newName.trim() || newName === oldName || accounts.includes(newName.trim())) {
      setEditingAccount(null); setEditAccountName(''); return;
    }
    const trimmed = newName.trim();
    const newAccounts = accounts.map(acc => acc === oldName ? trimmed : acc);
    setAccounts(newAccounts);

    if (activeAccount === oldName) setActiveAccount(trimmed);

    const newProfiles = { ...profiles };
    if (profiles[oldName]) {
      newProfiles[trimmed] = { ...profiles[oldName] };
      delete newProfiles[oldName];
      setProfiles(newProfiles);
    }

    setLocalStorage('instagramAccounts', newAccounts);
    setLocalStorage('instagramProfiles', newProfiles);

    setEditingAccount(null);
    setEditAccountName('');
    showNotification(`✅ Compte renommé en "${trimmed}"`, 'success');
  };

  /* ------------------------------ Filtrage/tri ---------------------------- */

  const getOrderedFilteredPosts = () => {
    let posts = allPosts;
    if (activeCalendar !== 'all' && activeCalendar !== 'default') {
      posts = posts.filter(p => p.calendarName === activeCalendar);
    }
    if (activeAccount !== 'All' && accounts.length > 0) {
      posts = posts.filter(p => p.account === activeAccount);
    }
    return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const filteredPosts = getOrderedFilteredPosts();

  /* --------------------------------- DnD ---------------------------------- */

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };
  
  const handleDragEnd = () => { 
    setDraggedIndex(null); 
    setDragOverIndex(null); 
  };
  
  const handleDragOver = (e, index) => { 
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move'; 
    if (draggedIndex !== null && draggedIndex !== index) setDragOverIndex(index); 
  };
  
  const handleDragEnter = (e, index) => { 
    e.preventDefault(); 
    if (draggedIndex !== null && draggedIndex !== index) setDragOverIndex(index); 
  };
  
  const handleDragLeave = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      setDragOverIndex(null);
    }
  };
  
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault(); 
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === dropIndex) { 
      setDraggedIndex(null); 
      return; 
    }
    const sourcePost = filteredPosts[draggedIndex];
    if (!sourcePost) { 
      setDraggedIndex(null); 
      return; 
    }
    const prevPost = dropIndex > 0 ? filteredPosts[dropIndex - 1] : null;
    const nextPost = dropIndex < filteredPosts.length ? filteredPosts[dropIndex] : null;
    const newDate = calculateNewDate(prevPost, nextPost);
    await syncDateToNotion(sourcePost, newDate);
    setDraggedIndex(null);
  };

  const gridItems = Array.from({ length: 60 }, (_, i) => filteredPosts[i] || null);

  /* --------------------------------- Render -------------------------------- */

  const currentProfile = getProfile(activeAccount);
  const shouldShowTabs = accounts.length > 0;
  const shouldShowAllTab = accounts.length > 1 && showAllTab;
  const shouldShowCalendarTabs = calendars.length > 0;

  return (
    <div className="w-full max-w-md mx-auto bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Camera size={24} className="text-gray-800" />
          <span className="font-semibold text-lg text-gray-800">Instagram</span>
        </div>
        <div className="flex items-center space-x-2">
          {(isSyncing || isRefreshing) && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-xs text-blue-600">{isSyncing ? 'Sync...' : 'Chargement...'}</span>
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowRefreshMenu(!showRefreshMenu)}
              disabled={isRefreshing || isSyncing}
              className={`flex items-center space-x-1 p-2 hover:bg-gray-100 rounded-full transition-all ${(isRefreshing || isSyncing) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Options d'actualisation"
            >
              <RefreshCw size={20} className={`text-gray-700 ${(isRefreshing || isSyncing) ? 'animate-spin' : ''}`} />
              <ChevronDown size={14} className="text-gray-700" />
            </button>

            {showRefreshMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <button onClick={() => fetchPosts()} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3">
                  <RefreshCw size={16} className="text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">Actualiser</div>
                    <div className="text-xs text-gray-500">Récupérer nouveaux posts</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setIsConfigOpen(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Paramètres">
            <Settings size={20} className="text-gray-700" />
          </button>
        </div>
      </div>

      {showRefreshMenu && <div className="fixed inset-0 z-40" onClick={() => setShowRefreshMenu(false)} />}

      {/* Profile Section */}
      <div className="p-4">
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative cursor-pointer group" onClick={() => setIsProfileEdit(true)}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-0.5">
              <div className="w-full h-full rounded-full bg-white p-0.5">
                {currentProfile.profilePhoto ? (
                  <img src={currentProfile.profilePhoto} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                    <Camera size={24} className="text-gray-500" />
                  </div>
                )}
              </div>
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 size={16} className="text-white" />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              <div className="text-center">
                <div className="font-semibold text-gray-900">{filteredPosts.length}</div>
                <div className="text-xs text-gray-500">publications</div>
              </div>
              <div className="text-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => setIsProfileEdit(true)}>
                <div className="font-semibold text-gray-900">{currentProfile.followers}</div>
                <div className="text-xs text-gray-500">abonnés</div>
              </div>
              <div className="text-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded" onClick={() => setIsProfileEdit(true)}>
                <div className="font-semibold text-gray-900">{currentProfile.following}</div>
                <div className="text-xs text-gray-500">suivi(e)s</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="font-semibold text-sm text-gray-900">{currentProfile.fullName}</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line mt-1">{currentProfile.bio}</p>
        </div>
      </div>

      {/* Account Tabs */}
      {shouldShowTabs && (
        <div className="border-t border-b border-gray-200 overflow-x-auto">
          <div className="flex space-x-0 min-w-max">
            {shouldShowAllTab && (
              <button
                onClick={() => setActiveAccount('All')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeAccount === 'All' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📊 Tous
              </button>
            )}
            {accounts.map(account => (
              <button
                key={account}
                onClick={() => setActiveAccount(account)}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeAccount === account ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {account}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Tabs */}
      {shouldShowCalendarTabs && calendars.length > 1 && (
        <div className="border-b border-gray-200 overflow-x-auto bg-gray-50">
          <div className="flex space-x-0 min-w-max">
            <button
              onClick={() => setActiveCalendar('all')}
              className={`flex-1 px-4 py-2 text-xs font-medium transition-all whitespace-nowrap ${activeCalendar === 'all' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-800'}`}
            >
              📅 Tous
            </button>
            {calendars.map(calendar => (
              <button
                key={calendar.name}
                onClick={() => setActiveCalendar(calendar.name)}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-all whitespace-nowrap ${activeCalendar === calendar.name ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-600 hover:text-gray-800'}`}
              >
                {calendar.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ✅ Posts Grid avec DnD amélioré */}
      <div className="grid grid-cols-3 gap-0.5 bg-gray-100">
        {gridItems.map((post, index) => (
          <DraggablePost
            key={post ? post.id : `empty-${index}`}
            post={post}
            index={index}
            isDragging={draggedIndex === index}
            isDropTarget={dragOverIndex === index}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (post) {
                setSelectedPost(post);
                setModalOpen(true);
              }
            }}
          />
        ))}
      </div>

      {/* Post Modal */}
      <PostModal
        post={selectedPost}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedPost(null); }}
        onNavigate={(direction) => {
          const currentIndex = filteredPosts.findIndex(p => p.id === selectedPost.id);
          if (direction === 'next') {
            const nextIndex = (currentIndex + 1) % filteredPosts.length;
            setSelectedPost(filteredPosts[nextIndex]);
          } else {
            const prevIndex = (currentIndex - 1 + filteredPosts.length) % filteredPosts.length;
            setSelectedPost(filteredPosts[prevIndex]);
          }
        }}
      />

      {/* Profile Edit Modal - Le reste continue de la même façon... */}
      {isProfileEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsProfileEdit(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Modifier le profil</h3>
              <button onClick={() => setIsProfileEdit(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil (URL)</label>
                <input
                  type="text"
                  value={currentProfile.profilePhoto}
                  onChange={(e) => {
                    const updated = { ...currentProfile, profilePhoto: e.target.value };
                    saveProfile(activeAccount, updated);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur</label>
                <input
                  type="text"
                  value={currentProfile.username}
                  onChange={(e) => {
                    const updated = { ...currentProfile, username: e.target.value };
                    saveProfile(activeAccount, updated);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                <input
                  type="text"
                  value={currentProfile.fullName}
                  onChange={(e) => {
                    const updated = { ...currentProfile, fullName: e.target.value };
                    saveProfile(activeAccount, updated);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={currentProfile.bio}
                  onChange={(e) => {
                    const updated = { ...currentProfile, bio: e.target.value };
                    saveProfile(activeAccount, updated);
                  }}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Abonnés</label>
                  <input
                    type="text"
                    value={currentProfile.followers}
                    onChange={(e) => {
                      const updated = { ...currentProfile, followers: e.target.value };
                      saveProfile(activeAccount, updated);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Suivis</label>
                  <input
                    type="text"
                    value={currentProfile.following}
                    onChange={(e) => {
                      const updated = { ...currentProfile, following: e.target.value };
                      saveProfile(activeAccount, updated);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsProfileEdit(false)}
              className="w-full mt-6 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setIsConfigOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">⚙️ Configuration du Widget</h2>
                <button onClick={() => setIsConfigOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Widget Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">Informations du Widget</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>ID Widget:</strong> <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{WIDGET_ID}</code></p>
                      {getWidFromUrl() && (
                        <p className="text-xs text-green-600 font-medium">✅ Widget isolé via URL (?wid={getWidFromUrl()})</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ Guide des colonnes Notion */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-yellow-600 mt-0.5">📝</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-yellow-900 mb-2">Guide des colonnes Notion (respecter les majuscules)</h4>
                    <div className="text-sm text-yellow-800 space-y-1">
                      <p><strong>Date :</strong> "Date", "Date de publication", "Date de publi"</p>
                      <p><strong>Couverture :</strong> "Couverture", "Visuel", "Image", "Cover"</p>
                      <p><strong>Caption :</strong> "Caption", "Légende", "Description"</p>
                      <p><strong>Compte Instagram :</strong> "Compte Instagram", "Compte", "Account" (optionnel)</p>
                    </div>
                    <p className="text-xs text-yellow-700 mt-2 font-medium">
                      ⚠️ Recommandé : "Date", "Couverture", "Caption", "Compte Instagram"
                    </p>
                  </div>
                </div>
              </div>

              {/* Widget Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Nom du Widget {getWidFromUrl() && <span className="text-xs text-gray-500">(affichage uniquement)</span>}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={widgetName}
                    onChange={(e) => setWidgetName(e.target.value)}
                    placeholder="Ex: Planning Client A"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={saveWidgetName}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Enregistrer
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getWidFromUrl() 
                    ? "Nom d'affichage pour ce widget (données déjà isolées par ?wid=)" 
                    : "Donnez un nom unique pour identifier ce widget"}
                </p>
              </div>

              {/* Notion API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">🔑 Clé API Notion</label>
                <input
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  placeholder="secret_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Votre clé d'intégration Notion</p>
              </div>

              {/* Calendars Manager */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">📅 Calendriers Notion</label>
                  <button
                    onClick={() => setIsCalendarManager(!isCalendarManager)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Plus size={16} />
                    <span>Gérer</span>
                  </button>
                </div>

                {calendars.length > 0 ? (
                  <div className="space-y-2">
                    {calendars.map(calendar => (
                      <div key={calendar.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        {editingCalendar === calendar.name ? (
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={editCalendarName}
                              onChange={(e) => setEditCalendarName(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="Nom"
                            />
                            <input
                              type="text"
                              value={editCalendarDbId}
                              onChange={(e) => setEditCalendarDbId(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                              placeholder="ID Base de données (32 caractères)"
                            />
                            <div className="flex space-x-2">
                              <button onClick={saveEditCalendar} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                                Sauvegarder
                              </button>
                              <button onClick={cancelEditCalendar} className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600">
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{calendar.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{calendar.databaseId.slice(0, 20)}...</div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditCalendar(calendar)}
                                className="p-1.5 text-gray-600 hover:text-blue-600 rounded"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => removeCalendar(calendar.name)}
                                className="p-1.5 text-gray-600 hover:text-red-600 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Aucun calendrier configuré</p>
                )}

                {isCalendarManager && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Ajouter un calendrier</h4>
                    <input
                      type="text"
                      value={newCalendarName}
                      onChange={(e) => setNewCalendarName(e.target.value)}
                      placeholder="Nom du calendrier (ex: Client A)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={newCalendarDbId}
                      onChange={(e) => setNewCalendarDbId(e.target.value)}
                      placeholder="ID de la base de données Notion (32 caractères)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={addCalendar}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Ajouter
                      </button>
                      <button
                        onClick={() => {
                          setIsCalendarManager(false);
                          setNewCalendarName('');
                          setNewCalendarDbId('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Accounts Manager */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">👤 Comptes Instagram</label>
                  <button
                    onClick={() => setIsAccountManager(!isAccountManager)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Plus size={16} />
                    <span>Gérer</span>
                  </button>
                </div>

                {accounts.length > 0 ? (
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <div key={account} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        {editingAccount === account ? (
                          <div className="flex-1 flex items-center space-x-2">
                            <input
                              type="text"
                              value={editAccountName}
                              onChange={(e) => setEditAccountName(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                              onKeyPress={(e) => e.key === 'Enter' && renameAccount(account, editAccountName)}
                            />
                            <button
                              onClick={() => renameAccount(account, editAccountName)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => { setEditingAccount(null); setEditAccountName(''); }}
                              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-sm">{account}</span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => { setEditingAccount(account); setEditAccountName(account); }}
                                className="p-1.5 text-gray-600 hover:text-blue-600 rounded"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => removeAccount(account)}
                                className="p-1.5 text-gray-600 hover:text-red-600 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {accounts.length > 0 && (
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={removeAllAccounts}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Supprimer tous les comptes
                        </button>
                        {accounts.length > 1 && !showAllTab && (
                          <button
                            onClick={() => { setShowAllTab(true); setLocalStorage('showAllTab', true); }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Afficher l'onglet "Tous"
                          </button>
                        )}
                        {showAllTab && accounts.length > 1 && (
                          <button
                            onClick={hideAllTab}
                            className="text-xs text-gray-600 hover:text-gray-700"
                          >
                            Masquer l'onglet "Tous"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Aucun compte configuré</p>
                )}

                {isAccountManager && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Ajouter un compte</h4>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Nom du compte (ex: @moncompte)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={addAccount}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Ajouter
                      </button>
                      <button
                        onClick={() => { setIsAccountManager(false); setNewAccountName(''); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Widget Actions */}
              {!getWidFromUrl() && (
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <button
                    onClick={createNewWidget}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    🆕 Créer un nouveau widget indépendant
                  </button>
                  <button
                    onClick={resetWidget}
                    className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    🗑️ Réinitialiser ce widget
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    La réinitialisation supprime uniquement les données locales, pas vos données Notion
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={connectToNotion}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                💾 Sauvegarder et Connecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Notification améliorée */}
      <Notification 
        notification={notification} 
        onClose={() => setNotification(null)} 
      />
    </div>
  );
};

export default InstagramNotionWidget;

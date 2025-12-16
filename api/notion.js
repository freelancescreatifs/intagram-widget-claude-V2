// api/notion.js - Version simple basée sur l'ancien code qui fonctionnait
module.exports = async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      status: "OK",
      message: "API Notion active",
      version: "8.0-tags-alternatifs"
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      error: "Method not allowed",
      method: req.method,
      message: "Use POST to interact with Notion API"
    });
    return;
  }

  try {
    const { apiKey, databaseId, action, postId, newDate, pageId } = req.body;
    
    console.log('🚀 === NOUVELLE REQUÊTE API ===');
    console.log('📋 Body reçu:', { 
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'MANQUANTE', 
      databaseId: databaseId || 'MANQUANT',
      action: action || 'LECTURE_POSTS'
    });

    // Validation des paramètres
    if (!apiKey || !databaseId) {
      console.error('❌ Paramètres manquants');
      res.status(400).json({
        success: false,
        error: "🔑 Clé API et ID de base requis",
        details: "Vérifiez que vous avez bien renseigné la clé API Notion et l'ID de votre base de données"
      });
      return;
    }

    // Validation format clé API (flexible pour ntn_ et secret_)
    if (!apiKey.startsWith('ntn_') && !apiKey.startsWith('secret_')) {
      console.error('❌ Format de clé API invalide:', apiKey.substring(0, 10));
      res.status(400).json({
        success: false,
        error: "🔑 Format de clé API invalide",
        details: "La clé doit commencer par 'ntn_' (nouveau format) ou 'secret_' (ancien format)"
      });
      return;
    }

    // ========== ACTION : Mise à jour de la DATE (pour drag & drop) ==========
    if (action === 'updateDate' && (postId || pageId) && newDate) {
      console.log('🔄 Mise à jour date pour:', postId || pageId, 'vers:', newDate);
      
      try {
        const updateResponse = await fetch(`https://api.notion.com/v1/pages/${postId || pageId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            properties: {
              "Date": {
                date: { start: newDate }
              }
            }
          })
        });

        const updateResult = await updateResponse.json();
        console.log('📊 Résultat mise à jour:', updateResponse.status, updateResult);

        if (updateResponse.ok) {
          res.status(200).json({
            success: true,
            message: `✅ Date mise à jour: ${newDate}`,
            data: updateResult
          });
        } else {
          console.error('❌ Erreur mise à jour:', updateResult);
          res.status(400).json({
            success: false,
            error: `❌ Impossible de mettre à jour la date: ${updateResponse.status}`,
            details: updateResult.message || "Vérifiez les permissions de votre intégration Notion"
          });
        }
        return;
      } catch (error) {
        console.error('❌ Exception mise à jour:', error);
        res.status(500).json({
          success: false,
          error: "❌ Erreur lors de la mise à jour de la date",
          details: error.message
        });
        return;
      }
    }

    // ========== LECTURE DES POSTS ==========
    console.log('📖 Lecture des posts depuis:', databaseId);

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        sorts: [
          {
            property: 'Date',
            direction: 'descending'  // Plus récent en premier
          }
        ]
      })
    });

    console.log('📥 Statut réponse Notion:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur Notion API:', response.status, errorText);
      
      let userError = "❌ Erreur de connexion à Notion";
      let userDetails = "";
      
      if (response.status === 401) {
        userError = "🔑 Clé API Notion invalide ou expirée";
        userDetails = "Vérifiez que votre clé API est correcte et qu'elle a les bonnes permissions";
      } else if (response.status === 404) {
        userError = "📊 Base de données Notion introuvable";
        userDetails = "Vérifiez l'ID de votre base et que l'intégration y a accès";
      } else if (response.status === 403) {
        userError = "🚫 Accès refusé à la base Notion";
        userDetails = "Votre intégration n'a pas les permissions pour accéder à cette base";
      }
      
      res.status(response.status).json({
        success: false,
        error: userError,
        details: userDetails,
        apiError: `${response.status} - ${errorText}`
      });
      return;
    }

    const data = await response.json();
    console.log('📊 Données Notion reçues:', data.results?.length || 0, 'pages');

    if (!data.results || data.results.length === 0) {
      console.log('⚠️ Aucune page trouvée dans la base');
      res.status(200).json({
        success: true,
        posts: [],
        meta: { total: 0, accounts: [] },
        message: "📭 Aucun post trouvé dans votre base Notion"
      });
      return;
    }

    // ========== TRAITEMENT DES POSTS ==========
    console.log('🔄 Traitement des posts...');
    
    const posts = data.results
      .filter(row => {
        // Filtrer les posts avec statut "Posté" - AVEC TAGS ALTERNATIFS
        const status = row.properties.État?.select?.name ||
                      row.properties.Statut?.select?.name || 
                      row.properties.Status?.select?.name ||
                      row.properties.état?.select?.name ||
                      row.properties.statut?.select?.name ||
                      row.properties.etat?.select?.name ||
                      row.properties.Etat?.select?.name || '';
        
        const isPosted = ['posté', 'posted', 'publié', 'published'].includes(status.toLowerCase());
        
        console.log(`📄 Page ${row.id.slice(-6)} - Statut: "${status}" (${isPosted ? 'EXCLU' : 'INCLUS'})`);
        
        return !isPosted; // Exclure les posts déjà postés
      })
      .map(row => {
        const properties = row.properties;
        console.log(`🔍 Traitement page ${row.id.slice(-6)} - Propriétés:`, Object.keys(properties));
        
        // ✅ TAGS ALTERNATIFS - Extraction du titre (optionnel maintenant)
        const title = properties.Titre?.title?.[0]?.text?.content ||
                     properties.Title?.title?.[0]?.text?.content ||
                     properties.Name?.title?.[0]?.text?.content ||
                     `Post ${new Date().toLocaleDateString('fr-FR')}`;

        // ✅ TAGS ALTERNATIFS - Extraction des fichiers média
        const contentProperty = properties.couverture?.files ||
                               properties.Visuel?.files ||
                               properties.image?.files ||
                               properties.cover?.files ||
                               properties.Couverture?.files ||
                               properties.visuel?.files ||
                               properties.Image?.files ||
                               properties.Cover?.files ||
                               properties.Contenu?.files || 
                               properties.Content?.files || 
                               properties.Media?.files || 
                               properties['Files & media']?.files ||
                               properties.Fichiers?.files ||
                               properties.Images?.files || [];

        const urls = contentProperty
          .map(file => {
            if (file.type === 'file') {
              return file.file.url;
            } else if (file.type === 'external') {
              return file.external.url;
            }
            return null;
          })
          .filter(Boolean);

        console.log(`📷 Médias trouvés pour ${row.id.slice(-6)}:`, urls.length, 'fichier(s)');
        if (urls.length === 0) {
          console.log(`⚠️ Aucun média trouvé dans les propriétés:`, Object.keys(properties).filter(k => k.toLowerCase().includes('couverture') || k.toLowerCase().includes('image') || k.toLowerCase().includes('visuel')));
        }

        // ✅ TAGS ALTERNATIFS - Extraction de la date
        const dateProperty = properties.date?.date?.start ||
                           properties['date de publication']?.date?.start ||
                           properties['Date de publi']?.date?.start ||
                           properties.Date?.date?.start ||
                           properties['Date de publication']?.date?.start ||
                           properties['date de publi']?.date?.start ||
                           properties.Published?.date?.start ||
                           properties.Publish?.date?.start ||
                           new Date().toISOString().split('T')[0];

        // ✅ TAGS ALTERNATIFS - Extraction du caption
        const caption = properties.caption?.rich_text?.[0]?.text?.content ||
                       properties.Légende?.rich_text?.[0]?.text?.content ||
                       properties.description?.rich_text?.[0]?.text?.content ||
                       properties.Caption?.rich_text?.[0]?.text?.content ||
                       properties.légende?.rich_text?.[0]?.text?.content ||
                       properties.Description?.rich_text?.[0]?.text?.content ||
                       properties.Text?.rich_text?.[0]?.text?.content ||
                       properties.Texte?.rich_text?.[0]?.text?.content || 
                       '';

        // Détection automatique du type
        const type = properties.Type?.select?.name ||
                    properties.Category?.select?.name ||
                    properties.Catégorie?.select?.name ||
                    (urls.length > 1 ? 'Carrousel' : 
                     urls.some(url => url.match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i)) ? 'Vidéo' : 'Image');

        // ✅ TAGS ALTERNATIFS - Extraction du compte
        const account = properties.compte?.select?.name ||
                       properties.account?.select?.name ||
                       properties['compte instagram']?.select?.name ||
                       properties.Compte?.select?.name ||
                       properties.Account?.select?.name ||
                       properties['Compte Instagram']?.select?.name ||
                       properties['Account Instagram']?.select?.name ||
                       properties['account instagram']?.select?.name ||
                       properties.Instagram?.select?.name || '';

        console.log(`✅ Post ${row.id.slice(-6)} traité:`, {
          title: title.substring(0, 30),
          urls: urls.length,
          date: dateProperty,
          caption: caption.substring(0, 30),
          account: account || 'aucun'
        });

        return {
          id: row.id,
          title,
          urls,
          date: dateProperty,
          caption,
          type,
          account
        };
      })
      .filter(post => {
        // Garder tous les posts (même sans média pour debug)
        if (post.urls.length === 0) {
          console.log(`⚠️ Post ${post.id.slice(-6)} exclu: aucun média`);
        }
        return true; // Garder tous pour debug
      });

    console.log(`📊 RÉSULTAT FINAL: ${posts.length} posts traités`);
    console.log(`📷 Posts avec médias: ${posts.filter(p => p.urls.length > 0).length}`);
    console.log(`📭 Posts sans médias: ${posts.filter(p => p.urls.length === 0).length}`);

    // Extraction des comptes uniques
    const accounts = [...new Set(posts.map(p => p.account).filter(Boolean))];
    console.log(`👤 Comptes trouvés:`, accounts);

    res.status(200).json({
      success: true,
      posts: posts,
      meta: {
        total: posts.length,
        accounts: accounts,
        withMedia: posts.filter(p => p.urls.length > 0).length,
        withoutMedia: posts.filter(p => p.urls.length === 0).length
      },
      debug: {
        databaseId,
        totalPagesFromNotion: data.results.length,
        processedPosts: posts.length,
        samplePost: posts[0] || null
      }
    });

  } catch (error) {
    console.error('❌ ERREUR GLOBALE API:', error);
    res.status(500).json({
      success: false,
      error: "❌ Erreur serveur interne",
      details: error.message,
      stack: error.stack
    });
  }
};

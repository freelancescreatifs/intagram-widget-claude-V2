// src/index.js - Fichier d'entrée React modifié

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ AJOUTER cette ligne pour importer les styles globaux
import './globals.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const DTEGO_PASSWORD = "Fisherman'sfriend";
const AUTH_KEY = 'forge_auth';
const API_BASE = 'https://api.dtego.net';

window.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem(AUTH_KEY) === 'granted') {
        grantAccess();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

function checkPassword() {
    if (document.getElementById('login-password').value === DTEGO_PASSWORD) {
        localStorage.setItem(AUTH_KEY, 'granted');
        grantAccess();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
}

async function grantAccess() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    await Promise.all([
        loadLibraryData(),
        fetch(API_BASE + '/api/forge/projects?_t=' + Date.now(), {
            cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }
        }).then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) forgeState.projects = data.projects; })
          .catch(function() {})
    ]);
    renderSection();
}

async function loadLibraryData() {
    try {
        const response = await fetch(`${API_BASE}/api/library`);
        if (response.ok) {
            const data = await response.json();
            libraryData = { items: data.items || [] };
        } else {
            libraryData = { items: [] };
        }
    } catch (error) {
        libraryData = { items: [] };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTÈME DE MODALS CENTRÉS (Design System Dtego)
// ═══════════════════════════════════════════════════════════════════════════

function showCenteredModal(message, type = 'info') {
    const existing = document.getElementById('centered-modal-overlay');
    if (existing) existing.remove();

    const colors = { error: '#f87171', success: '#4ade80', info: '#38bdf8' };
    const icons = {
        error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
        success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
    };
    const color = colors[type] || colors.info;

    const overlay = document.createElement('div');
    overlay.id = 'centered-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;">
            <div style="width:48px;height:48px;border-radius:12px;background:${color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                <svg width="24" height="24" fill="none" stroke="${color}" viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
            </div>
            <p style="color:white;font-size:15px;line-height:1.6;margin:0 0 1.5rem;">${message}</p>
            <button onclick="this.closest('#centered-modal-overlay').remove()" style="px:6;py:2;padding:0.5rem 1.5rem;border-radius:12px;border:none;background:${color};color:${type === 'success' ? '#000' : '#fff'};font-weight:500;cursor:pointer;">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showToast(message, type = 'info') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6'
    };

    // Create/get toast container
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-2.5';
        container.style.zIndex = '10001';
        document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = 'px-4 py-2 rounded-lg shadow-lg transition-opacity';
    toast.style.cssText = `background: ${colors[type]}; color: white;`;
    toast.textContent = message;
    container.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            // Remove container if empty
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 3000);
}

// ========================================
// ANALYSE GRANULAIRE
// ========================================

/**
 * Analyse le code généré et affiche modal granules
 */
async function analyzeAndShowGranules(code, codeType, strategyName) {
    console.log('[GRANULES] Début analyse pour:', strategyName);

    try {
        // 1. Extraction granules
        const response = await fetch(`${API_BASE}/api/forge/extract-granules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                code_type: codeType,
                save_new: false
            })
        });

        const data = await response.json();

        if (!data.success || !data.granules || data.granules.length === 0) {
            console.log('[GRANULES] Aucune granule détectée');
            return;
        }

        console.log(`[GRANULES] ${data.granules.length} granule(s) détectée(s)`);

        // 2. Comparaison avec bibliothèque existante
        const comparison = await compareGranulesWithLibrary(data.granules);

        // 3. Afficher modal
        showGranulesModal(comparison, strategyName);

    } catch (error) {
        console.error('[GRANULES] Erreur analyse:', error);
    }
}

/**
 * Compare granules détectées avec bibliothèque
 */
async function compareGranulesWithLibrary(detectedGranules) {
    try {
        // Récupérer toutes les granules de la bibliothèque
        const response = await fetch(`${API_BASE}/api/forge/granules?per_page=1000`);
        const data = await response.json();

        if (!data.success) {
            return detectedGranules.map(g => ({ ...g, status: 'nouvelle' }));
        }

        const libraryGranules = data.granules || [];

        // Comparer chaque granule détectée
        return detectedGranules.map(detected => {
            // Chercher granule identique ou similaire
            const existing = libraryGranules.find(lib =>
                lib.name.toLowerCase() === detected.name.toLowerCase() &&
                lib.category === detected.category
            );

            if (!existing) {
                return { ...detected, status: 'nouvelle' };
            }

            // Comparer scores
            if (detected.reusability_score > existing.reusability_score + 5) {
                return {
                    ...detected,
                    status: 'amelioree',
                    existing_id: existing.id,
                    existing_score: existing.reusability_score
                };
            } else if (Math.abs(detected.reusability_score - existing.reusability_score) <= 5) {
                return {
                    ...detected,
                    status: 'existante',
                    existing_id: existing.id
                };
            } else {
                return {
                    ...detected,
                    status: 'similaire',
                    existing_id: existing.id,
                    existing_score: existing.reusability_score
                };
            }
        });

    } catch (error) {
        console.error('[GRANULES] Erreur comparaison:', error);
        return detectedGranules.map(g => ({ ...g, status: 'nouvelle' }));
    }
}

/**
 * Affiche modal avec granules détectées
 */
function showGranulesModal(granules, strategyName) {
    const categoryColors = {
        'CALCUL': '#3b82f6',
        'COMPARAISON': '#8b5cf6',
        'TEMPORELLES': '#06b6d4',
        'SEUIL': '#f59e0b',
        'LOGIQUES': '#a78bfa',
        'DONNÉES': '#10b981',
        'TRANSFORMATION': '#ec4899',
        'AGRÉGATION': '#f97316',
        'ÉTAT/MÉMOIRE': '#6366f1'
    };

    const categoryDescriptions = {
        'CALCUL': 'Opération mathématique de base : moyenne mobile, somme, delta, ratio. Brique fondamentale réutilisable dans de nombreux contextes.',
        'COMPARAISON': 'Évalue une condition entre deux valeurs (supérieur, inférieur, croisement). Retourne vrai ou faux.',
        'TEMPORELLES': 'Gère le temps : détection de nouveau jour, plage horaire, reset périodique, barres depuis un événement.',
        'SEUIL': 'Définit une limite fixe ou dynamique (absolue, pourcentage, multiple) au-delà de laquelle une condition est activée.',
        'LOGIQUES': 'Combine plusieurs conditions avec des opérateurs (AND, OR, NOT). Permet de construire des règles complexes.',
        'DONNÉES': 'Accède aux données brutes du marché : prix OHLCV, volume, données multi-timeframe.',
        'TRANSFORMATION': 'Convertit une valeur d\'un format à un autre : pourcentage en décimal, normalisation, arrondi.',
        'AGRÉGATION': 'Regroupe plusieurs valeurs en une seule : somme cumulative, comptage, moyenne pondérée.',
        'ÉTAT/MÉMOIRE': 'Conserve un état entre les barres : compteur, flag, valeur précédente, historique.'
    };

    const categoryIcons = {
        'CALCUL': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>',
        'COMPARAISON': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>',
        'TEMPORELLES': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        'SEUIL': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
        'LOGIQUES': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>',
        'DONNÉES': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>',
        'TRANSFORMATION': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>',
        'AGRÉGATION': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>',
        'ÉTAT/MÉMOIRE': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/>'
    };

    const statusLabels = {
        'nouvelle': { label: 'Nouvelle', color: '#10b981' },
        'existante': { label: 'Existante', color: '#6b7280' },
        'amelioree': { label: 'Améliorée', color: '#f59e0b' },
        'similaire': { label: 'Similaire', color: '#3b82f6' }
    };

    // Compteur par catégorie
    const categoryCounts = {};
    granules.forEach(g => {
        categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
    });

    let html = `
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" id="granulesModal" onclick="if(event.target===this)closeGranulesModal()">
            <div class="bg-gray-900 rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto" style="width: 90%; max-width: 1000px; border: 1px solid rgba(255,255,255,0.1);">

                <!-- Header sticky -->
                <div class="sticky top-0 bg-gray-900/95 backdrop-blur-sm p-6 pb-4 z-10" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-white mb-1">Granules Détectées</h3>
                            <p class="text-white/50 text-sm">${granules.length} granule(s) dans « ${strategyName} »</p>
                        </div>
                        <button onclick="closeGranulesModal()" class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Résumé catégories -->
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${Object.entries(categoryCounts).map(([cat, count]) => {
                            const color = categoryColors[cat] || '#888';
                            return `<span class="px-2 py-1 rounded-lg text-xs" style="background: ${color}15; color: ${color}; border: 1px solid ${color}30;">${cat} (${count})</span>`;
                        }).join('')}
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-between items-center">
                        <div class="flex gap-2">
                            <button onclick="selectAllGranules()" class="px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-lg text-xs hover:bg-purple-500/25 transition border border-purple-500/20">
                                Tout sélectionner
                            </button>
                            <button onclick="selectOnlyNew()" class="px-3 py-1.5 bg-green-500/15 text-green-400 rounded-lg text-xs hover:bg-green-500/25 transition border border-green-500/20">
                                Nouvelles uniquement
                            </button>
                        </div>
                        <span id="granule-selection-count" class="text-white/50 text-sm">0 sélectionnée(s)</span>
                    </div>
                </div>

                <!-- Grid Granules -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-6 pt-4">
    `;

    granules.forEach((granule, index) => {
        const catColor = categoryColors[granule.category] || '#888888';
        const catIcon = categoryIcons[granule.category] || categoryIcons['CALCUL'];
        const catDesc = categoryDescriptions[granule.category] || 'Granule atomique réutilisable.';
        const status = statusLabels[granule.status] || statusLabels['nouvelle'];
        const score = granule.reusability_score;
        const scoreColor = score >= 90 ? '#22c55e' :
                          score >= 75 ? '#4ade80' :
                          score >= 60 ? '#fbbf24' :
                          score >= 40 ? '#f97316' : '#ef4444';

        const autoSelect = granule.status === 'nouvelle' || granule.status === 'amelioree';

        html += `
            <div class="p-4 rounded-xl bg-white/5 hover:bg-white/8 transition group border border-transparent hover:border-white/10 relative" data-granule-index="${index}">

                <!-- Score badge coin droit -->
                <div class="absolute top-3 right-3 cursor-pointer" onclick="event.stopPropagation(); toggleGranuleScoreInfo(${index})">
                    <span class="text-lg font-bold" style="color: ${scoreColor};">${score}</span>
                </div>

                <!-- Row 1: Checkbox + Icon + Name + Status -->
                <div class="flex items-start gap-3 mb-3 pr-12">
                    <input type="checkbox"
                           class="granule-checkbox mt-1 w-4 h-4 rounded accent-purple-500"
                           data-index="${index}"
                           ${autoSelect ? 'checked' : ''}
                           onchange="updateGranuleCount()">

                    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background: ${catColor}15;">
                        <svg class="w-4 h-4" style="color: ${catColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${catIcon}
                        </svg>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="text-white font-semibold text-sm truncate">${granule.name}</h4>
                            <span class="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                                  style="background: ${status.color}15; color: ${status.color}; border: 1px solid ${status.color}30;">
                                ${status.label}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Row 2: Category badge + Info button -->
                <div class="flex items-center gap-2 mb-3 ml-10">
                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                          style="background: ${catColor}15; color: ${catColor}; border: 1px solid ${catColor}30;">
                        ${granule.category}
                    </span>

                    <!-- Info tooltip -->
                    <div class="relative">
                        <button onclick="event.stopPropagation(); toggleGranuleCatInfo(${index})"
                            class="w-5 h-5 rounded-full flex items-center justify-center transition"
                            style="background: ${catColor}15; color: ${catColor};">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </button>
                        <div id="granule-cat-info-${index}" class="hidden absolute left-0 top-7 w-64 p-3 rounded-xl shadow-2xl z-50 text-xs"
                             style="background: rgba(15,15,26,0.95); backdrop-filter: blur(10px); border: 1px solid ${catColor}30;">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: ${catColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    ${catIcon}
                                </svg>
                                <span class="font-semibold" style="color: ${catColor};">${granule.category}</span>
                            </div>
                            <p class="text-white/70 leading-relaxed">${catDesc}</p>
                        </div>
                    </div>
                </div>

                <!-- Row 4: Description -->
                <p class="text-white/60 text-xs mb-2 ml-10">${granule.description}</p>

                <!-- Row 5: Code Preview -->
                <details class="text-xs ml-10">
                    <summary class="text-purple-400 cursor-pointer hover:text-purple-300 transition">Voir code</summary>
                    <div class="mt-2 bg-black/30 p-2 rounded-lg">
                        <pre class="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">${granule.code_pine || 'N/A'}</pre>
                    </div>
                </details>
            </div>
        `;
    });

    html += `
                </div>

                <!-- Footer sticky -->
                <div class="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm p-6 pt-4 flex justify-end gap-3" style="border-top: 1px solid rgba(255,255,255,0.05);">
                    <button onclick="closeGranulesModal()"
                            class="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl transition border border-white/10">
                        Annuler
                    </button>
                    <button onclick="saveSelectedGranulesToLibrary()"
                            class="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition font-medium">
                        Sauvegarder dans Bibliothèque
                    </button>
                </div>
            </div>
        </div>
    `;

    // Injecter modal
    const existingModal = document.getElementById('granulesModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', html);

    // Stocker granules pour sauvegarde
    window.detectedGranules = granules;

    // Compter sélection initiale
    updateGranuleCount();
}


function selectAllGranules() {
    document.querySelectorAll('.granule-checkbox').forEach(cb => cb.checked = true);
    updateGranuleCount();
}

function selectOnlyNew() {
    window.detectedGranules.forEach((granule, index) => {
        const checkbox = document.querySelector(`.granule-checkbox[data-index="${index}"]`);
        if (checkbox) {
            checkbox.checked = granule.status === 'nouvelle' || granule.status === 'amelioree';
        }
    });
    updateGranuleCount();
}

function updateGranuleCount() {
    const count = document.querySelectorAll('.granule-checkbox:checked').length;
    const counter = document.getElementById('granule-selection-count');
    if (counter) counter.textContent = `${count} sélectionnée(s)`;
}

function toggleGranuleCatInfo(index) {
    const popup = document.getElementById(`granule-cat-info-${index}`);
    if (!popup) return;
    
    // Fermer tous les autres popups
    document.querySelectorAll('[id^="granule-cat-info-"]').forEach(el => {
        if (el.id !== `granule-cat-info-${index}`) el.classList.add('hidden');
    });
    
    popup.classList.toggle('hidden');
    
    // Fermer au clic extérieur
    if (!popup.classList.contains('hidden')) {
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && !e.target.closest('button')) {
                    popup.classList.add('hidden');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    }
}

function toggleGranuleScoreInfo(index) {
    const granule = window.detectedGranules[index];
    if (!granule) return;

    // Fermer un popup existant
    const existing = document.getElementById('granule-score-popup');
    if (existing) { existing.remove(); return; }

    const score = granule.reusability_score;
    const scoreColor = score >= 90 ? '#22c55e' :
                      score >= 75 ? '#4ade80' :
                      score >= 60 ? '#fbbf24' :
                      score >= 40 ? '#f97316' : '#ef4444';

    const gradeLabel = score >= 90 ? 'Excellent' :
                      score >= 75 ? 'Très bon' :
                      score >= 60 ? 'Bon' :
                      score >= 40 ? 'Moyen' : 'Faible';

    // Critères de scoring avec évaluation
    const criteria = [
        {
            name: 'Atomicité',
            desc: 'La granule est-elle indivisible ? Plus elle est simple et ciblée, plus elle est réutilisable.',
            good: score >= 80
        },
        {
            name: 'Universalité',
            desc: 'Peut-elle être utilisée dans différents contextes (stratégies, filtres, timeframes) ?',
            good: score >= 70
        },
        {
            name: 'Indépendance',
            desc: 'Fonctionne-t-elle sans dépendance à d\'autres composants spécifiques ?',
            good: score >= 75
        },
        {
            name: 'Pattern standard',
            desc: 'Correspond-elle à un pattern de trading reconnu (SMA, RSI, comparaison, seuil) ?',
            good: score >= 85
        }
    ];

    const popup = document.createElement('div');
    popup.id = 'granule-score-popup';
    popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:100;';

    popup.innerHTML = `
        <div style="background:rgba(15,15,26,0.98);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:1.5rem;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span style="font-size:2rem;font-weight:800;color:${scoreColor};">${score}</span>
                    <div>
                        <div style="color:white;font-size:13px;font-weight:600;">${gradeLabel}</div>
                        <div style="color:rgba(255,255,255,0.4);font-size:11px;">Score de réutilisabilité</div>
                    </div>
                </div>
                <button onclick="document.getElementById('granule-score-popup').remove()"
                    style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:rgba(255,255,255,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;">
                    x
                </button>
            </div>

            <div style="color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">
                Critères d'évaluation
            </div>

            ${criteria.map(c => `
                <div style="display:flex;align-items:start;gap:0.5rem;padding:0.5rem 0;border-top:1px solid rgba(255,255,255,0.05);">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-top:3px;background:${c.good ? '#22c55e' : 'rgba(255,255,255,0.15)'};flex-shrink:0;"></span>
                    <div>
                        <div style="color:white;font-size:12px;font-weight:500;">${c.name}</div>
                        <div style="color:rgba(255,255,255,0.4);font-size:11px;line-height:1.4;">${c.desc}</div>
                    </div>
                </div>
            `).join('')}

            <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.05);">
                <div style="color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">
                    Granule
                </div>
                <div style="color:white;font-size:12px;font-weight:500;">${granule.name}</div>
                <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px;">${granule.description}</div>
            </div>
        </div>
    `;

    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });

    document.body.appendChild(popup);
}


function closeGranulesModal() {
    const modal = document.getElementById('granulesModal');
    if (modal) modal.remove();
}

async function saveSelectedGranulesToLibrary() {
    const checkboxes = document.querySelectorAll('.granule-checkbox:checked');

    if (checkboxes.length === 0) {
        showToast('Sélectionnez au moins une granule', 'error');
        return;
    }

    const granulesData = Array.from(checkboxes).map(cb => {
        const index = parseInt(cb.dataset.index);
        return window.detectedGranules[index];
    });

    try {
        const response = await fetch(`${API_BASE}/api/forge/granules/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ granules: granulesData })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`${data.summary.saved} granule(s) sauvegardée(s)`, 'success');
            if (data.summary.skipped > 0) {
                showToast(`${data.summary.skipped} déjà existante(s)`, 'info');
            }
            closeGranulesModal();
        } else {
            showToast(data.error || 'Erreur sauvegarde', 'error');
        }
    } catch (error) {
        console.error('[GRANULES] Erreur sauvegarde:', error);
        showToast('Erreur connexion API', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALE FORGE UNIFIÉE — 3 ÉTATS: GENERATING → RESULT → GRANULES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Injecte le CSS de la modale Forge (appelé une seule fois)
 */
function injectForgeModalCSS() {
    if (document.getElementById('forge-modal-css')) return;
    const style = document.createElement('style');
    style.id = 'forge-modal-css';
    style.textContent = `
        .forge-overlay {
            position: fixed; inset: 0; z-index: 1000;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
            animation: fmOverlayIn 0.3s ease;
        }
        .forge-overlay.fm-hidden { display: none; }
        @keyframes fmOverlayIn { from{opacity:0} to{opacity:1} }

        .forge-modal {
            width: 420px; max-width: 90vw;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.4);
            overflow: hidden;
            animation: fmModalIn 0.4s cubic-bezier(0.16,1,0.3,1);
            transition: width 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .forge-modal.fm-wide { width: 700px; }
        @keyframes fmModalIn { from{opacity:0;transform:scale(0.95) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }

        /* État 1: GENERATING */
        .fm-generating { padding: 48px 32px 40px; text-align: center; }
        .fm-generating .fm-loader {
            width: 56px; height: 56px; margin: 0 auto 24px;
            border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.06);
            border-top-color: #d97706; animation: fmSpin 1s linear infinite;
        }
        @keyframes fmSpin { to{transform:rotate(360deg)} }
        .fm-generating .fm-gen-title { font-size:17px; font-weight:600; color:rgba(255,255,255,0.9); margin-bottom:6px; }
        .fm-generating .fm-gen-step { font-size:13px; color:rgba(255,255,255,0.35); margin-bottom:28px; transition:opacity 0.3s; }
        .fm-generating .fm-progress-track { width:100%; height:2px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
        .fm-generating .fm-progress-fill {
            height:100%; border-radius:2px;
            background: linear-gradient(90deg, #d97706, #f59e0b);
            animation: fmProgress 18s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        @keyframes fmProgress { 0%{width:0%} 15%{width:20%} 40%{width:45%} 65%{width:60%} 85%{width:78%} 100%{width:92%} }

        /* État 2: RESULT */
        .fm-result { display:none; animation: fmResultIn 0.4s ease; }
        .fm-result.fm-active { display:block; }
        @keyframes fmResultIn { from{opacity:0} to{opacity:1} }

        .fm-result-header { padding:28px 28px 20px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.06); }
        .fm-result-check {
            width:44px; height:44px; border-radius:50%;
            background:rgba(74,222,128,0.1); border:1.5px solid rgba(74,222,128,0.25);
            display:flex; align-items:center; justify-content:center; margin:0 auto 14px;
        }
        .fm-result-title { font-size:17px; font-weight:600; color:rgba(255,255,255,0.9); margin-bottom:4px; }
        .fm-result-subtitle { font-size:13px; color:rgba(255,255,255,0.35); }

        .fm-result-tabs { padding:16px 28px 0; }
        .fm-tabs-row { display:flex; gap:8px; background:transparent; border-radius:10px; padding:0; border:none; }
        .fm-tab-btn {
            flex:1; padding:10px 0; border-radius:8px; font-size:13px; font-weight:600;
            text-align:center; border:1px solid rgba(255,255,255,0.15); cursor:pointer; transition:all 0.2s;
            background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.5); letter-spacing:0.01em;
        }
        .fm-tab-btn:hover { color:rgba(255,255,255,0.9); background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.25); }
        .fm-tab-btn.fm-active { background:rgba(255,255,255,0.12); color:#fff; box-shadow:0 2px 10px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.3); }

        .fm-result-code { padding:0 28px; max-height:0; overflow:hidden; transition:max-height 0.3s ease, padding 0.3s ease; }
        .fm-result-code.fm-expanded { max-height:280px; padding:12px 28px 16px; }
        .fm-code-block {
            background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.06);
            border-radius:12px; padding:14px 16px; max-height:220px; overflow-y:auto;
        }
        .fm-code-block pre {
            font-family:'SF Mono','Menlo','Consolas',monospace;
            font-size:11.5px; line-height:1.6; color:rgba(255,255,255,0.7);
            white-space:pre-wrap; margin:0;
        }
        .fm-copy-btn {
            padding:5px 12px;
            border-radius:6px; font-size:10px; font-weight:500; border:none; cursor:pointer;
            background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); transition:all 0.2s;
        }
        .fm-copy-btn:hover { background:rgba(255,255,255,0.15); color:rgba(255,255,255,0.8); }
        .fm-copy-btn.fm-copied { background:rgba(74,222,128,0.15); color:#4ade80; }

        .fm-result-actions { padding:20px 28px 24px; display:flex; gap:10px; }
        .fm-btn-secondary {
            flex:1; padding:11px 0; border-radius:12px; font-size:13px; font-weight:500;
            text-align:center; border:1px solid rgba(255,255,255,0.08); cursor:pointer; transition:all 0.2s;
            background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6);
        }
        .fm-btn-secondary:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .fm-btn-granules {
            flex:1; padding:11px 0; border-radius:12px; font-size:13px; font-weight:500;
            text-align:center; border:1px solid rgba(139,92,246,0.3); cursor:pointer; transition:all 0.2s;
            background:rgba(139,92,246,0.1); color:rgba(139,92,246,0.7);
            display:flex; align-items:center; justify-content:center; gap:6px;
        }
        .fm-btn-granules:hover:not(:disabled) { background:rgba(139,92,246,0.2); color:#a78bfa; }
        .fm-btn-granules:disabled { opacity:0.7; cursor:wait; }
        .fm-btn-granules .fm-mini-loader {
            width:16px; height:16px; border-radius:50%;
            border:2px solid rgba(139,92,246,0.15); border-top-color:#a78bfa;
            animation: fmSpin 0.8s linear infinite;
        }
        .fm-btn-primary {
            flex:1.5; padding:11px 0; border-radius:12px; font-size:13px; font-weight:600;
            text-align:center; border:none; cursor:pointer; transition:all 0.2s;
            background:linear-gradient(135deg, #d97706, #f59e0b); color:#fff;
            box-shadow:0 4px 12px rgba(217,119,6,0.25);
            display:flex; align-items:center; justify-content:center; gap:6px;
        }
        .fm-btn-primary:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(217,119,6,0.35); }
        .fm-btn-primary:active { transform:scale(0.95); opacity:0.8; }

        /* État 3: GRANULES */
        .fm-granules { display:none; animation: fmResultIn 0.4s ease; }
        .fm-granules.fm-active { display:block; }
        .fm-granules-header { padding:24px 28px 16px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .fm-granules-list { padding:16px 28px; max-height:400px; overflow-y:auto; }
        .fm-granule-item {
            padding:12px; margin-bottom:8px; border-radius:12px;
            background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);
            transition: background 0.2s;
        }
        .fm-granule-item:hover { background:rgba(255,255,255,0.06); }
        .fm-granules-footer {
            padding:16px 28px 24px; display:flex; gap:10px;
            border-top:1px solid rgba(255,255,255,0.06);
        }

        /* Scrollbar modale */
        .fm-code-block::-webkit-scrollbar, .fm-granules-list::-webkit-scrollbar { width:4px; }
        .fm-code-block::-webkit-scrollbar-track, .fm-granules-list::-webkit-scrollbar-track { background:transparent; }
        .fm-code-block::-webkit-scrollbar-thumb, .fm-granules-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
    `;
    document.head.appendChild(style);
}

/**
 * Affiche la modale en état GENERATING
 */
function forgeShowGenerating() {
    injectForgeModalCSS();

    // Nettoyer timers précédents
    forgeState.forgeModalStepTimers.forEach(t => clearTimeout(t));
    forgeState.forgeModalStepTimers = [];
    forgeState.forgeModalGranules = null;
    forgeState.forgeModalGranulesLoading = false;

    // Supprimer modale existante
    const existing = document.getElementById('forgeModalOverlay');
    if (existing) existing.remove();

    const steps = [
        { text: "Analyse de la stratégie...", delay: 0 },
        { text: "Génération du Pine Script...", delay: 3000 },
        { text: "Conversion en Python...", delay: 8000 },
        { text: "Validation du code...", delay: 13000 }
    ];

    const html = `
        <div class="forge-overlay" id="forgeModalOverlay">
            <div class="forge-modal" id="forgeModalBox">
                <div class="fm-generating" id="fmStateGenerating">
                    <div class="fm-loader"></div>
                    <div class="fm-gen-title">Forge en cours</div>
                    <div class="fm-gen-step" id="fmGenStep">${steps[0].text}</div>
                    <div class="fm-progress-track">
                        <div class="fm-progress-fill" id="fmProgressFill"></div>
                    </div>
                </div>
                <div class="fm-result" id="fmStateResult"></div>
                <div class="fm-granules" id="fmStateGranules"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Rotation des steps
    steps.forEach(step => {
        const t = setTimeout(() => {
            const el = document.getElementById('fmGenStep');
            if (el) el.textContent = step.text;
        }, step.delay);
        forgeState.forgeModalStepTimers.push(t);
    });
}

/**
 * Transition vers état RESULT
 */
function forgeShowResult(pineCode, pythonCode, version) {
    forgeState.forgeModalPineCode = pineCode || '';
    forgeState.forgeModalPythonCode = pythonCode || '';
    forgeState.forgeModalVersion = version;
    forgeState.forgeModalCurrentTab = 'pine';

    // Arrêter timers de génération
    forgeState.forgeModalStepTimers.forEach(t => clearTimeout(t));
    forgeState.forgeModalStepTimers = [];

    const genEl = document.getElementById('fmStateGenerating');
    const resultEl = document.getElementById('fmStateResult');
    const modalBox = document.getElementById('forgeModalBox');
    if (!genEl || !resultEl) return;

    // Cacher generating
    genEl.style.display = 'none';
    // Retirer wide si granules l'avait mis
    if (modalBox) modalBox.classList.remove('fm-wide');

    const versionLabel = version ? `v${version}` : '';
    const subtitle = versionLabel ? `Code généré (${versionLabel}) — Pine Script + Python` : 'Pine Script + Python';

    const granulesLoading = forgeState.forgeModalGranulesLoading;
    const granulesReady = forgeState.forgeModalGranules && forgeState.forgeModalGranules.length > 0;

    resultEl.innerHTML = `
        <div class="fm-result-header">
            <div class="fm-result-check">
                <svg width="20" height="20" fill="none" stroke="#4ade80" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
            </div>
            <div class="fm-result-title">Stratégie générée</div>
            <div class="fm-result-subtitle">${subtitle}</div>
        </div>

        <div class="fm-result-tabs">
            <div class="fm-tabs-row">
                <button class="fm-tab-btn" onclick="forgeModalSwitchTab('pine', this)">Pine Script</button>
                <button class="fm-tab-btn" onclick="forgeModalSwitchTab('python', this)">Python</button>
            </div>
        </div>

        <div class="fm-result-code" id="fmResultCode">
            <div style="position:relative;">
                <div style="display:flex;justify-content:flex-end;padding:0 0 6px;">
                    <button class="fm-copy-btn" id="fmCopyBtn" onclick="forgeModalCopyCode()">Copier</button>
                </div>
                <div class="fm-code-block">
                    <pre id="fmCodeContent"></pre>
                </div>
            </div>
        </div>

        <div class="fm-result-actions">
            <button class="fm-btn-secondary" onclick="forgeCloseModal()">Fermer</button>
            <button class="fm-btn-granules" id="fmBtnGranules"
                    onclick="forgeModalShowGranules()"
                    ${!granulesReady ? 'disabled' : ''}>
                ${granulesLoading ? '<span class="fm-mini-loader"></span> Analyse...' : (granulesReady ? `Granules (${forgeState.forgeModalGranules.length})` : 'Granules')}
            </button>
            <button class="fm-btn-primary" onclick="forgeModalTest()">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                Tester
            </button>
        </div>
    `;

    resultEl.classList.add('fm-active');
}

/**
 * Escape HTML pour affichage sécurisé du code
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Switch tab Pine/Python dans la modale
 */
function forgeModalSwitchTab(tab, btn) {
    forgeState.forgeModalCurrentTab = tab;
    document.querySelectorAll('#fmStateResult .fm-tab-btn').forEach(b => b.classList.remove('fm-active'));
    if (btn) btn.classList.add('fm-active');

    const code = tab === 'pine' ? forgeState.forgeModalPineCode : forgeState.forgeModalPythonCode;
    const codeEl = document.getElementById('fmCodeContent');
    if (codeEl) codeEl.textContent = code;

    // Reset bouton copier
    const copyBtn = document.getElementById('fmCopyBtn');
    if (copyBtn) { copyBtn.textContent = 'Copier'; copyBtn.classList.remove('fm-copied'); }

    // Auto-expand
    const codeArea = document.getElementById('fmResultCode');
    if (codeArea) codeArea.classList.add('fm-expanded');
}

/**
 * Copier le code affiché
 */
function forgeModalCopyCode() {
    const code = forgeState.forgeModalCurrentTab === 'pine'
        ? forgeState.forgeModalPineCode : forgeState.forgeModalPythonCode;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('fmCopyBtn');
        if (btn) { btn.textContent = 'Copié'; btn.classList.add('fm-copied'); }
        setTimeout(() => {
            if (btn) { btn.textContent = 'Copier'; btn.classList.remove('fm-copied'); }
        }, 2000);
    });
}

/**
 * Met à jour le bouton Granules quand les données arrivent
 */
function forgeModalUpdateGranulesButton() {
    const btn = document.getElementById('fmBtnGranules');
    if (!btn) return;

    const granules = forgeState.forgeModalGranules;
    if (granules && granules.length > 0) {
        btn.disabled = false;
        btn.innerHTML = `Granules (${granules.length})`;
    } else if (granules && granules.length === 0) {
        btn.disabled = true;
        btn.innerHTML = 'Aucune granule';
    } else {
        btn.disabled = true;
        btn.innerHTML = '<span class="fm-mini-loader"></span> Granules...';
    }
}

/**
 * Affiche l'état GRANULES dans la modale
 */
function forgeModalShowGranules() {
    const granules = forgeState.forgeModalGranules;
    if (!granules || granules.length === 0) return;

    const resultEl = document.getElementById('fmStateResult');
    const granulesEl = document.getElementById('fmStateGranules');
    const modalBox = document.getElementById('forgeModalBox');
    if (!resultEl || !granulesEl) return;

    // Élargir la modale
    if (modalBox) modalBox.classList.add('fm-wide');

    // Cacher result
    resultEl.classList.remove('fm-active');

    const categoryColors = {
        'CALCUL': '#3b82f6', 'COMPARAISON': '#8b5cf6', 'TEMPORELLES': '#06b6d4',
        'SEUIL': '#f59e0b', 'LOGIQUES': '#a78bfa', 'DONNÉES': '#10b981',
        'TRANSFORMATION': '#ec4899', 'AGRÉGATION': '#f97316', 'ÉTAT/MÉMOIRE': '#6366f1'
    };
    const categoryDescriptions = {
        'CALCUL': 'Opération mathématique de base : moyenne mobile, somme, delta, ratio.',
        'COMPARAISON': 'Évalue une condition entre deux valeurs. Retourne vrai ou faux.',
        'TEMPORELLES': 'Gère le temps : nouveau jour, plage horaire, reset périodique.',
        'SEUIL': 'Définit une limite fixe ou dynamique au-delà de laquelle une condition est activée.',
        'LOGIQUES': 'Combine plusieurs conditions avec des opérateurs (AND, OR, NOT).',
        'DONNÉES': 'Accède aux données brutes du marché : prix OHLCV, volume, multi-timeframe.',
        'TRANSFORMATION': 'Convertit une valeur : pourcentage en décimal, normalisation, arrondi.',
        'AGRÉGATION': 'Regroupe plusieurs valeurs : somme cumulative, comptage, moyenne pondérée.',
        'ÉTAT/MÉMOIRE': 'Conserve un état entre les barres : compteur, flag, valeur précédente.'
    };
    const statusLabels = {
        'nouvelle': { label: 'Nouvelle', color: '#10b981' },
        'existante': { label: 'Existante', color: '#6b7280' },
        'amelioree': { label: 'Améliorée', color: '#f59e0b' },
        'similaire': { label: 'Similaire', color: '#3b82f6' }
    };

    // Compteur catégories
    const categoryCounts = {};
    granules.forEach(g => { categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1; });

    const strategyName = forgeState.currentProject?.name || 'Stratégie';

    let listHtml = granules.map((g, i) => {
        const catColor = categoryColors[g.category] || '#888';
        const catDesc = categoryDescriptions[g.category] || 'Granule atomique réutilisable.';
        const status = statusLabels[g.status] || statusLabels['nouvelle'];
        const score = g.reusability_score;
        const scoreColor = score >= 90 ? '#22c55e' : score >= 75 ? '#4ade80' : score >= 60 ? '#fbbf24' : score >= 40 ? '#f97316' : '#ef4444';
        const gradeLabel = score >= 90 ? 'Excellent' : score >= 75 ? 'Très bon' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Faible';
        const autoSelect = g.status === 'nouvelle' || g.status === 'amelioree';

        return `
            <div class="fm-granule-item">
                <div style="display:flex;align-items:center;gap:10px;">
                    <input type="checkbox" class="fm-granule-cb" data-index="${i}" ${autoSelect ? 'checked' : ''} onchange="forgeModalUpdateGranuleCount()" style="accent-color:#a78bfa;">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span onclick="event.stopPropagation();fmShowCategoryInfo('${g.category}')" style="color:#fff;font-size:13px;font-weight:600;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.7);text-underline-offset:4px;text-decoration-thickness:2px;cursor:pointer;transition:text-decoration-color 0.2s;" onmouseover="this.style.textDecorationColor='rgba(255,255,255,1)'" onmouseout="this.style.textDecorationColor='rgba(255,255,255,0.7)'">${escapeHtml(g.name)}</span>
                            <span style="font-size:10px;padding:2px 6px;border-radius:6px;background:${catColor}15;color:${catColor};border:1px solid ${catColor}30;">${g.category}</span>
                            <span style="font-size:10px;padding:2px 6px;border-radius:6px;background:${status.color}15;color:${status.color};border:1px solid ${status.color}30;">${status.label}</span>
                        </div>
                        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:4px;">${escapeHtml(g.description)}</p>
                    </div>
                    <span onclick="event.stopPropagation();fmShowScoreInfo(${score}, '${gradeLabel}', '${scoreColor}')" style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:${scoreColor}12;color:${scoreColor};border:1px solid ${scoreColor}30;flex-shrink:0;letter-spacing:0.02em;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">${score}</span>
                </div>
            </div>
        `;
    }).join('');

    granulesEl.innerHTML = `
        <div class="fm-granules-header">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div>
                    <div style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.9);">Granules détectées</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.35);">${granules.length} granule(s) dans « ${escapeHtml(strategyName)} »</div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
                ${Object.entries(categoryCounts).map(([cat, count]) => {
                    const c = categoryColors[cat] || '#888';
                    return `<span style="padding:3px 8px;border-radius:8px;font-size:11px;background:${c}15;color:${c};border:1px solid ${c}30;">${cat} (${count})</span>`;
                }).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;gap:6px;">
                    <button onclick="forgeModalSelectAllGranules()" style="padding:5px 10px;border-radius:8px;font-size:11px;background:rgba(139,92,246,0.1);color:#a78bfa;border:1px solid rgba(139,92,246,0.2);cursor:pointer;">Tout sélectionner</button>
                    <button onclick="forgeModalSelectNewGranules()" style="padding:5px 10px;border-radius:8px;font-size:11px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.2);cursor:pointer;">Nouvelles</button>
                </div>
                <span id="fmGranuleCount" style="color:rgba(255,255,255,0.4);font-size:12px;">0 sélectionnée(s)</span>
            </div>
        </div>

        <div class="fm-granules-list">${listHtml}</div>

        <div class="fm-granules-footer">
            <button class="fm-btn-secondary" onclick="forgeCloseModal()">Fermer</button>
            <button class="fm-btn-primary" onclick="forgeModalSaveGranules()" style="background:linear-gradient(135deg, #7c3aed, #a78bfa);">
                Sauvegarder dans Bibliothèque
            </button>
        </div>
    `;

    granulesEl.classList.add('fm-active');

    // Stocker pour sauvegarde
    window.forgeModalDetectedGranules = granules;
    forgeModalUpdateGranuleCount();
}

/**
 * Retour de GRANULES vers RESULT
 */
function forgeModalBackToResult() {
    const granulesEl = document.getElementById('fmStateGranules');
    const resultEl = document.getElementById('fmStateResult');
    const modalBox = document.getElementById('forgeModalBox');
    if (granulesEl) granulesEl.classList.remove('fm-active');
    if (modalBox) modalBox.classList.remove('fm-wide');
    if (resultEl) resultEl.classList.add('fm-active');
}

function forgeModalSelectAllGranules() {
    document.querySelectorAll('.fm-granule-cb').forEach(cb => cb.checked = true);
    forgeModalUpdateGranuleCount();
}

function forgeModalSelectNewGranules() {
    const granules = window.forgeModalDetectedGranules || [];
    granules.forEach((g, i) => {
        const cb = document.querySelector(`.fm-granule-cb[data-index="${i}"]`);
        if (cb) cb.checked = (g.status === 'nouvelle' || g.status === 'amelioree');
    });
    forgeModalUpdateGranuleCount();
}

function forgeModalUpdateGranuleCount() {
    const count = document.querySelectorAll('.fm-granule-cb:checked').length;
    const el = document.getElementById('fmGranuleCount');
    if (el) el.textContent = `${count} sélectionnée(s)`;
}

/**
 * Affiche une modale d'information détaillée sur un type de granule
 */
function fmShowCategoryInfo(category) {
    const categoryColors = {
        'CALCUL': '#3b82f6', 'COMPARAISON': '#8b5cf6', 'TEMPORELLES': '#06b6d4',
        'SEUIL': '#f59e0b', 'LOGIQUES': '#a78bfa', 'DONNÉES': '#10b981',
        'TRANSFORMATION': '#ec4899', 'AGRÉGATION': '#f97316', 'ÉTAT/MÉMOIRE': '#6366f1'
    };

    const categoryInfo = {
        'CALCUL': {
            title: 'Calcul',
            desc: 'Opération mathématique de base : moyenne mobile, somme, delta, ratio. Brique fondamentale réutilisable dans de nombreux contextes.',
            examples: ['Moyenne mobile (SMA, EMA)', 'Somme cumulative', 'Delta / Différence', 'Ratio / Pourcentage', 'Min / Max', 'True Range'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>'
        },
        'COMPARAISON': {
            title: 'Comparaison',
            desc: 'Évalue une condition entre deux valeurs (supérieur, inférieur, croisement). Retourne un résultat vrai ou faux.',
            examples: ['Égalité (==, !=)', 'Supériorité (>, >=, <, <=)', 'Between (dans une plage)', 'Crossed above / below'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>'
        },
        'TEMPORELLES': {
            title: 'Temporelles',
            desc: 'Gère le temps : détection de nouveau jour, plage horaire, reset périodique, barres depuis un événement.',
            examples: ['Nouveau jour (UTC, local)', 'Plage horaire (de X à Y)', 'Barres depuis événement', 'Reset périodique'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'
        },
        'SEUIL': {
            title: 'Seuil',
            desc: 'Définit une limite fixe ou dynamique au-delà de laquelle une condition est activée.',
            examples: ['Seuil absolu (> 100)', 'Seuil pourcentage (> 15%)', 'Seuil multiple (> 2x moyenne)', 'Seuil dynamique (> ATR * 1.5)'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>'
        },
        'LOGIQUES': {
            title: 'Logiques',
            desc: 'Combine plusieurs conditions avec des opérateurs logiques. Permet de construire des règles complexes.',
            examples: ['AND (toutes conditions vraies)', 'OR (au moins une vraie)', 'NOT (inverse)', 'IF / THEN / ELSE'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>'
        },
        'DONNÉES': {
            title: 'Données',
            desc: 'Accède aux données brutes du marché : prix OHLCV, volume, données multi-timeframe.',
            examples: ['Extraction OHLCV', 'Volume par période', 'Tick data', 'Multi-timeframe (request.security)'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>'
        },
        'TRANSFORMATION': {
            title: 'Transformation',
            desc: 'Convertit une valeur d\'un format à un autre : pourcentage en décimal, normalisation, arrondi.',
            examples: ['Normalisation', 'Conversion %', 'Arrondi', 'Mapping de plage'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>'
        },
        'AGRÉGATION': {
            title: 'Agrégation',
            desc: 'Regroupe plusieurs valeurs en une seule : somme cumulative, comptage, moyenne pondérée.',
            examples: ['Somme cumulative', 'Comptage événements', 'Moyenne pondérée', 'Agrégation multi-barres'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>'
        },
        'ÉTAT/MÉMOIRE': {
            title: 'État / Mémoire',
            desc: 'Conserve un état entre les barres : compteur, flag, valeur précédente, historique.',
            examples: ['Compteur', 'Flag booléen', 'Valeur précédente (prev)', 'Historique N barres'],
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/>'
        }
    };

    const info = categoryInfo[category];
    if (!info) return;
    const color = categoryColors[category] || '#888';

    // Supprimer popup existante
    const existing = document.getElementById('fmCategoryInfoModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'fmCategoryInfoModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1100;animation:fmOverlayIn 0.2s ease;';

    modal.innerHTML = `
        <div style="position:relative;width:340px;max-width:90vw;background:rgba(15,15,26,0.98);backdrop-filter:blur(20px);border:1px solid ${color}25;border-radius:20px;padding:28px;box-shadow:0 24px 64px rgba(0,0,0,0.5);animation:fmModalIn 0.3s cubic-bezier(0.16,1,0.3,1);">
            <button onclick="document.getElementById('fmCategoryInfoModal').remove()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);cursor:pointer;color:rgba(255,255,255,0.4);transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.4)'">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:${color}15;border:1px solid ${color}25;">
                    <svg width="20" height="20" fill="none" stroke="${color}" viewBox="0 0 24 24">${info.icon}</svg>
                </div>
                <div>
                    <div style="font-size:16px;font-weight:600;color:#fff;">${info.title}</div>
                    <div style="font-size:11px;color:${color};font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Type de granule</div>
                </div>
            </div>

            <p style="color:rgba(255,255,255,0.6);font-size:12px;line-height:1.6;margin-bottom:16px;">${info.desc}</p>

            <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Exemples</div>
                ${info.examples.map(ex => `
                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;">
                        <span style="width:4px;height:4px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                        <span style="color:rgba(255,255,255,0.6);font-size:11px;">${ex}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * Affiche une modale d'information détaillée sur le score de réutilisabilité
 */
function fmShowScoreInfo(score, gradeLabel, scoreColor) {
    // Supprimer popup existante
    const existing = document.getElementById('fmScoreInfoModal');
    if (existing) existing.remove();

    const criteria = [
        {name: 'Atomicité', desc: 'La granule ne peut pas être décomposée davantage', good: score >= 80},
        {name: 'Universalité', desc: 'Applicable dans de nombreux contextes différents', good: score >= 70},
        {name: 'Indépendance', desc: 'Fonctionne sans dépendances complexes', good: score >= 75},
        {name: 'Pattern standard', desc: 'Utilise des patterns reconnus et éprouvés', good: score >= 85}
    ];

    const modal = document.createElement('div');
    modal.id = 'fmScoreInfoModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1100;animation:fmOverlayIn 0.2s ease;';

    modal.innerHTML = `
        <div style="position:relative;width:300px;max-width:90vw;background:rgba(15,15,26,0.98);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:28px;box-shadow:0 24px 64px rgba(0,0,0,0.5);animation:fmModalIn 0.3s cubic-bezier(0.16,1,0.3,1);">
            <button onclick="document.getElementById('fmScoreInfoModal').remove()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);cursor:pointer;color:rgba(255,255,255,0.4);transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.4)'">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
                <span style="font-size:32px;font-weight:800;color:${scoreColor};">${score}</span>
                <div>
                    <div style="color:#fff;font-size:14px;font-weight:600;">${gradeLabel}</div>
                    <div style="color:rgba(255,255,255,0.35);font-size:11px;">Score de réutilisabilité</div>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
                ${criteria.map(c => `
                    <div style="display:flex;align-items:flex-start;gap:8px;">
                        <span style="margin-top:2px;width:8px;height:8px;border-radius:50%;background:${c.good ? '#22c55e' : 'rgba(255,255,255,0.12)'};flex-shrink:0;${c.good ? 'box-shadow:0 0 6px rgba(34,197,94,0.3);' : ''}"></span>
                        <div>
                            <div style="color:${c.good ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)'};font-size:12px;font-weight:500;">${c.name}</div>
                            <div style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:1px;">${c.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}
async function forgeModalSaveGranules() {
    const checkboxes = document.querySelectorAll('.fm-granule-cb:checked');
    if (checkboxes.length === 0) {
        showToast('Sélectionnez au moins une granule', 'error');
        return;
    }

    const granules = window.forgeModalDetectedGranules || [];
    const selected = Array.from(checkboxes).map(cb => granules[parseInt(cb.dataset.index)]);

    forgeCloseModal();

    try {
        const response = await fetch(`${API_BASE}/api/forge/granules/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ granules: selected })
        });
        const data = await response.json();

        if (data.success) {
            showToast(`${data.summary.saved} granule(s) sauvegardée(s)`, 'success');
            if (data.summary.skipped > 0) {
                showToast(`${data.summary.skipped} déjà existante(s)`, 'info');
            }
        } else {
            showToast(data.error || 'Erreur sauvegarde', 'error');
        }
    } catch (error) {
        console.error('[FORGE MODAL] Erreur sauvegarde granules:', error);
        showToast('Erreur connexion API', 'error');
    }
}

/**
 * Tester la stratégie depuis la modale
 */
function forgeModalTest() {
    // Charger code dans forgeState
    forgeState.pineCode = forgeState.forgeModalPineCode;
    forgeState.pythonCode = forgeState.forgeModalPythonCode;
    forgeState.strategyType = 'strategy';

    // Fermer modale
    forgeCloseModal();

    // Activer zone backtest
    forgeState.showChatBacktest = true;
    renderSection();

    // Scroll vers backtest
    setTimeout(() => {
        const el = document.getElementById('forge-chat-backtest-zone');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

/**
 * Rouvrir la modale RESULT depuis un message du chat
 */
function forgeReopenResultFromMsg(msgId) {
    const msg = forgeState.messages.find(m => m.id === msgId);
    if (!msg) return;

    let metadata = {};
    try {
        metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});
    } catch(e) {}

    if (!metadata.pine_code) return;

    forgeState.forgeModalPineCode = metadata.pine_code;
    forgeState.forgeModalPythonCode = metadata.python_code || '';

    forgeShowGenerating();

    if (metadata.granules && metadata.granules.length > 0) {
        forgeState.forgeModalGranules = metadata.granules;
        forgeState.forgeModalGranulesLoading = false;
    } else {
        forgeState.forgeModalGranules = null;
        forgeState.forgeModalGranulesLoading = true;
    }

    forgeShowResult(metadata.pine_code, metadata.python_code || '', null);
    forgeModalUpdateGranulesButton();

    if (!metadata.granules || metadata.granules.length === 0) {
        (async () => {
            try {
                const grResp = await fetch(`${API_BASE}/api/forge/extract-granules`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: metadata.pine_code, code_type: 'pine', save_new: false })
                });
                const grData = await grResp.json();
                if (grData.success && grData.granules && grData.granules.length > 0) {
                    const comparison = await compareGranulesWithLibrary(grData.granules);
                    forgeState.forgeModalGranules = comparison;
                    metadata.granules = comparison;
                    msg.metadata = metadata;
                    // Persist to DB
                    fetch(`${API_BASE}/api/forge/messages/${msg.id}/metadata`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ granules: comparison })
                    }).catch(e => console.error('[FORGE] Failed to persist granules:', e));
                } else {
                    forgeState.forgeModalGranules = [];
                }
            } catch (e) {
                forgeState.forgeModalGranules = [];
            }
            forgeState.forgeModalGranulesLoading = false;
            forgeModalUpdateGranulesButton();
        })();
    }
}

/**
 * Rouvrir la modale RESULT (depuis le chat)
 */
function forgeReopenResult() {
    if (!forgeState.forgeModalPineCode) {
        const resultMsg = [...(forgeState.messages || [])].reverse().find(m => m.message_type === 'forge_result');
        if (resultMsg) {
            forgeReopenResultFromMsg(resultMsg.id);
            return;
        }
        return;
    }
    // Sauvegarder granules avant reset
    const savedGranules = forgeState.forgeModalGranules;
    const savedLoading = forgeState.forgeModalGranulesLoading;
    forgeShowGenerating();
    // Restaurer après reset
    forgeState.forgeModalGranules = savedGranules;
    forgeState.forgeModalGranulesLoading = savedLoading;
    forgeShowResult(
        forgeState.forgeModalPineCode,
        forgeState.forgeModalPythonCode,
        forgeState.forgeModalVersion
    );
    forgeModalUpdateGranulesButton();
}

/**
 * Fermer la modale Forge
 */
function forgeCloseModal() {
    forgeState.forgeModalStepTimers.forEach(t => clearTimeout(t));
    forgeState.forgeModalStepTimers = [];
    const overlay = document.getElementById('forgeModalOverlay');
    if (overlay) overlay.remove();
}

function showConfirmModal(message, onConfirm, onCancel = () => {}) {
    const existing = document.getElementById('confirm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

    overlay.innerHTML = `
        <div style="background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(251,191,36,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                <svg width="24" height="24" fill="none" stroke="#fbbf24" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p style="color:white;font-size:15px;line-height:1.6;margin:0 0 1.5rem;">${message}</p>
            <div style="display:flex;gap:0.75rem;justify-content:center;">
                <button id="confirm-modal-cancel" style="padding:0.5rem 1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.7);font-weight:500;cursor:pointer;">Annuler</button>
                <button id="confirm-modal-ok" style="padding:0.5rem 1.5rem;border-radius:12px;border:none;background:#f87171;color:white;font-weight:500;cursor:pointer;">Confirmer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-modal-cancel').onclick = () => { overlay.remove(); onCancel(); };
    document.getElementById('confirm-modal-ok').onclick = () => { overlay.remove(); onConfirm(); };
}

function showPromptModal(message, defaultValue, onConfirm, onCancel = () => {}) {
    const existing = document.getElementById('prompt-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'prompt-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

    overlay.innerHTML = `
        <div style="background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <p style="color:white;font-size:15px;line-height:1.6;margin:0 0 1rem;">${message}</p>
            <input id="prompt-modal-input" type="text" value="${defaultValue || ''}" style="width:100%;padding:0.75rem 1rem;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:white;font-size:14px;margin-bottom:1rem;box-sizing:border-box;" autofocus />
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button id="prompt-modal-cancel" style="padding:0.5rem 1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.7);font-weight:500;cursor:pointer;">Annuler</button>
                <button id="prompt-modal-ok" style="padding:0.5rem 1.5rem;border-radius:12px;border:none;background:#4ade80;color:#000;font-weight:500;cursor:pointer;">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('prompt-modal-input');
    input.focus();
    input.select();
    input.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('prompt-modal-ok').click(); };

    document.getElementById('prompt-modal-cancel').onclick = () => { overlay.remove(); onCancel(); };
    document.getElementById('prompt-modal-ok').onclick = () => { const val = input.value.trim(); overlay.remove(); if (val) onConfirm(val); else onCancel(); };
}

let libraryData = { items: [] };
let currentSection = 'atelier';

function renderSection() {
    const container = document.getElementById('forge-content');
    const html = renderForge();
    console.log('[RENDER] Mode:', forgeState.atelierMode, 'HTML length:', html.length);
    container.innerHTML = html;
    console.log('[RENDER] Container innerHTML length:', container.innerHTML.length);
}

let forgeState = {
    // Mode Atelier: 'choice' (défaut), 'convert', 'create'
    atelierMode: 'choice',
    // Sous-mode pour 'create': 'projects' ou 'chat'
    createView: 'projects',
    newProjectModalOpen: false, // Protection contre le polling
    // Projet en cours (mode create)
    currentProjectId: null,
    currentProject: null,
    projects: [],
    deletedProjectIds: [], // DEPRECATED - non utilisé, le backend filtre par status
    messages: [],
    versions: [],
    chatInput: '',
    isSendingMessage: false,
    isLoadingProjects: false,
    chatFullscreen: false, // Mode grand écran
    // Backtest dans le chat
    showChatBacktest: false,
    chatBacktestMsgId: null,
    chatBacktestResults: null,
    lastGeneratedCode: null,
    // Mode convert (existant)
    description: '',
    pineCode: '',
    pythonCode: '',
    refinement: '',
    showPineCode: false,
    conversationHistory: [],
    backtestResults: null,
    aiAnalysis: null,
    isGenerating: false,
    isAnalyzing: false,
    isSimulating: false, // État pour le bouton Simuler
    isConverting: false, // État pour le bouton Python
    // Modale Forge unifiée
    forgeModalPineCode: '',
    forgeModalPythonCode: '',
    forgeModalVersion: null,
    forgeModalCurrentTab: 'pine',
    forgeModalGranules: null,       // null=loading, []=vide, [...]= données
    forgeModalGranulesLoading: false,
    forgeModalStepTimers: [],
    strategyType: 'strategy', // 'strategy' ou 'indicator'
    inputMode: 'natural', // 'natural', 'pine' ou 'python' - Toggle zone d'entrée
    selectedAssets: 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT',
    selectedPeriod: '3M',
    // Backtest v2
    backtestMode: 'simple', // 'simple' ou 'comparative'
    selectedTimeframe: '1h', // Pour mode simple
    comparativeResults: null, // Tableau pour mode comparatif
    bestTimeframe: null, // Meilleur TF identifié
    source: null,
    sourceMeta: null
};

// Timeframes disponibles pour backtest
const BACKTEST_TIMEFRAMES = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1D', label: '1J' }
];

// Périodes disponibles
const BACKTEST_PERIODS = [
    { value: '1M', label: '1 mois' },
    { value: '3M', label: '3 mois' },
    { value: '6M', label: '6 mois' },
    { value: '1Y', label: '1 an' }
];

// Historique des backtests (chargé depuis localStorage)
let backtestHistory = JSON.parse(localStorage.getItem('dtego_backtest_history') || '[]');

// Fonction pour sauvegarder l'historique
function saveBacktestHistory() {
    localStorage.setItem('dtego_backtest_history', JSON.stringify(backtestHistory.slice(0, 50))); // Max 50 items
}

// Vérifier combinaison timeframe/période
function getBacktestWarning(timeframe, period) {
    const bougiesApprox = {
        '1m': { '1M': 43200, '3M': 129600, '6M': 259200, '1Y': 525600 },
        '5m': { '1M': 8640, '3M': 25920, '6M': 51840, '1Y': 105120 },
        '15m': { '1M': 2880, '3M': 8640, '6M': 17280, '1Y': 35040 },
        '30m': { '1M': 1440, '3M': 4320, '6M': 8640, '1Y': 17520 },
        '1h': { '1M': 720, '3M': 2160, '6M': 4320, '1Y': 8760 },
        '4h': { '1M': 180, '3M': 540, '6M': 1080, '1Y': 2190 },
        '1D': { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
    };
    
    const count = bougiesApprox[timeframe]?.[period] || 0;
    
    if (count < 50) return { type: 'error', message: `Seulement ~${count} bougies - données insuffisantes` };
    if (count < 100) return { type: 'warning', message: `~${count} bougies - résultats peu fiables` };
    if (count > 100000) return { type: 'warning', message: `~${count.toLocaleString()} bougies - calcul peut être long` };
    return null;
}

function renderForge() {
    // Router selon le mode Atelier
    console.log('[FORGE] Routing for mode:', forgeState.atelierMode);
    if (forgeState.atelierMode === 'choice') {
        console.log('[FORGE] → renderAtelierChoice');
        return renderAtelierChoice();
    } else if (forgeState.atelierMode === 'create') {
        console.log('[FORGE] → renderAtelierCreate');
        return renderAtelierCreate();
    }
    // Mode 'convert' = système existant
    console.log('[FORGE] → renderAtelierConvert');
    return renderAtelierConvert();
}

// Écran de choix: Convertir ou Créer
function renderAtelierChoice() {
    return `
        <div class="space-y-4">
            <!-- Header -->
            <div class="text-center py-4">
                <h2 class="text-2xl font-bold text-white mb-1">Atelier</h2>
                <p class="text-white/50 text-sm">Choisissez votre mode de travail</p>
            </div>
            
            <!-- Cartes de choix - pleine largeur -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Carte CONVERTIR -->
                <button onclick="forgeSetAtelierMode('convert')" 
                    class="group p-6 rounded-2xl text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
                    style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04)); border: 1px solid rgba(59, 130, 246, 0.25);">
                    <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style="background: rgba(59, 130, 246, 0.2);">
                        <svg class="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Convertir</h3>
                    <p class="text-white/50 text-sm mb-4">Transformez votre code existant entre différents formats</p>
                    <div class="space-y-2 text-sm text-white/40">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Pine Script vers Python
                        </div>
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Description vers code
                        </div>
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Détection automatique
                        </div>
                    </div>
                </button>
                
                <!-- Carte CRÉER -->
                <button onclick="forgeSetAtelierMode('create')" 
                    class="group p-6 rounded-2xl text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
                    style="background: linear-gradient(135deg, rgba(217, 119, 6, 0.12), rgba(217, 119, 6, 0.04)); border: 1px solid rgba(217, 119, 6, 0.25);">
                    <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style="background: rgba(217, 119, 6, 0.2);">
                        <svg class="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Créer</h3>
                    <p class="text-white/50 text-sm mb-4">Construisez votre stratégie par dialogue avec l'IA</p>
                    <div class="space-y-2 text-sm text-white/40">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Conversation guidée
                        </div>
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Projets sauvegardés
                        </div>
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Historique des versions
                        </div>
                    </div>
                </button>
            </div>
        </div>
    `;
}

// Mode Convertir (système existant renommé)
function renderAtelierConvert() {
    // Construire la liste des items de bibliothèque FILTRÉE selon le type sélectionné
    const typeFilter = forgeState.strategyType === 'strategy' ? 'strategy' : 'indicator';
    const libraryItems = (libraryData.items && Array.isArray(libraryData.items)) ? libraryData.items : []
        .filter(item => item.type === typeFilter)
        .slice(0, 10)
        .map(item => ({...item, libType: item.type}));
    
    return `
        <div class="space-y-6">
            <!-- Header avec retour -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <button onclick="forgeSetAtelierMode('choice')" class="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition" title="Retour">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div>
                        <h2 class="text-2xl font-bold text-white">Convertir</h2>
                        <p class="text-white/60 text-sm mt-1">Transformez vos stratégies et indicateurs</p>
                    </div>
                </div>
                <button onclick="forgeReset()" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition">
                    Nouveau
                </button>
            </div>
            
            <!-- Type selector + Charger depuis Bibliothèque -->
            <div class="flex items-center justify-between gap-4 p-4 rounded-xl" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <div class="flex gap-6">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="forge-type" value="strategy" ${forgeState.strategyType === 'strategy' ? 'checked' : ''} class="accent-amber-500" onchange="forgeSetType('strategy')">
                        <span class="text-white text-sm font-medium">Stratégie</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="forge-type" value="indicator" ${forgeState.strategyType === 'indicator' ? 'checked' : ''} class="accent-amber-500" onchange="forgeSetType('indicator')">
                        <span class="text-white text-sm font-medium">Indicateur</span>
                    </label>
                </div>
                
                <!-- Dropdown Charger depuis Bibliothèque -->
                <div class="relative">
                    <button onclick="toggleForgeLibraryDropdown()" 
                        class="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
                        Charger depuis Bibliothèque
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div id="forge-library-dropdown" class="hidden absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl border border-white/20 z-50 overflow-hidden"
                        style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                        <div class="p-2 max-h-64 overflow-y-auto">
                            ${libraryItems.length > 0 ? libraryItems.map(item => `
                                <button onclick="loadFromLibraryDropdown('${item.id}', '${item.type}')" 
                                    class="w-full px-3 py-2 rounded-lg text-left hover:bg-white/10 transition flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${item.type === 'strategy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'};">
                                        ${item.type === 'strategy' ? 
                                            '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>' :
                                            '<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'
                                        }
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-white text-sm font-medium truncate">${item.name}</div>
                                        <div class="text-white/40 text-xs">${item.type === 'strategy' ? 'Stratégie' : 'Indicateur'}</div>
                                    </div>
                                </button>
                            `).join('') : `
                                <div class="p-4 text-center text-white/40 text-sm">
                                    Aucun élément dans la bibliothèque
                                </div>
                            `}
                        </div>
                        <div class="p-2 border-t border-white/10">
                            <button onclick="window.location.href='bibliotheque.html';"
                                class="w-full px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition text-center">
                                Voir toute la bibliothèque
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Zone Entrée UNIFIÉE (Toggle Naturel / Pine / Python) -->
            <div class="rounded-xl p-5 border border-white/10" style="background: rgba(255,255,255,0.03);">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <!-- Toggle 3 positions -->
                    <div class="flex items-center gap-1 p-1 rounded-lg" style="background: rgba(0,0,0,0.3);">
                        <button onclick="forgeState.inputMode = 'natural'; renderSection();"
                            class="px-3 py-1.5 rounded-md text-sm font-medium transition-all ${forgeState.inputMode === 'natural' ? 'bg-amber-500 text-white' : 'text-white/50 hover:text-white/70'}">
                            Naturel
                        </button>
                        <button onclick="forgeState.inputMode = 'pine'; renderSection();"
                            class="px-3 py-1.5 rounded-md text-sm font-medium transition-all ${forgeState.inputMode === 'pine' ? 'bg-amber-500 text-white' : 'text-white/50 hover:text-white/70'}">
                            Pine Script
                        </button>
                        <button onclick="forgeState.inputMode = 'python'; renderSection();"
                            class="px-3 py-1.5 rounded-md text-sm font-medium transition-all ${forgeState.inputMode === 'python' ? 'bg-amber-500 text-white' : 'text-white/50 hover:text-white/70'}">
                            Python
                        </button>
                    </div>
                    
                    <!-- Boutons: Importer (toujours) + Contextuels + Sauvegarder/Exporter (si contenu) -->
                    <div class="flex items-center gap-2">
                        <!-- Input file caché -->
                        <input type="file" id="forge-file-input" class="hidden" accept=".pine,.txt,.py,.pinescript" onchange="forgeImportFile(event)">
                        
                        <!-- Bouton Importer (toujours visible) -->
                        <button onclick="document.getElementById('forge-file-input').click()" 
                            class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-1.5" title="Importer un fichier">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Importer
                        </button>
                        
                        <!-- Séparateur si contenu -->
                        ${(forgeState.description || forgeState.pineCode || forgeState.pythonCode) ? `
                            <div class="w-px h-5 bg-white/10"></div>
                        ` : ''}
                        
                        <!-- Boutons contextuels selon le mode (si contenu) -->
                        ${forgeState.inputMode === 'natural' && forgeState.description ? `
                            <button onclick="forgeGeneratePine()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 transition flex items-center gap-1.5" title="Générer le code Pine Script">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                Générer Pine
                            </button>
                        ` : ''}
                        
                        ${forgeState.inputMode === 'pine' && forgeState.pineCode ? `
                            <button onclick="forgeCopyCode('pine')" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition" title="Copier">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            </button>
                            <a href="https://www.tradingview.com/pine-editor/" target="_blank"
                                class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition" title="Ouvrir TradingView">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            </a>
                            <button onclick="forgeConvertToPython()"
                                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-400 transition flex items-center gap-1.5 ${forgeState.isConverting ? 'opacity-50 cursor-not-allowed' : ''}"
                                title="Convertir en Python"
                                ${forgeState.isConverting ? 'disabled' : ''}>
                                ${forgeState.isConverting ? `
                                    <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                    Conversion...
                                ` : `
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                                    Python
                                `}
                            </button>
                        ` : ''}
                        
                        ${forgeState.inputMode === 'python' && forgeState.pythonCode ? `
                            <button onclick="forgeCopyCode('python')" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition" title="Copier">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            </button>
                            <button onclick="forgeState.inputMode = 'pine'; renderSection();" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-1.5" title="Voir le Pine">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                                Pine
                            </button>
                            ${forgeState.description ? `
                                <button onclick="forgeGeneratePine()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 transition flex items-center gap-1.5" title="Régénérer Pine depuis la description">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    Générer Pine
                                </button>
                            ` : ''}
                        ` : ''}
                        
                        <!-- Sauvegarder / Exporter / Effacer (si contenu) -->
                        ${(forgeState.description || forgeState.pineCode || forgeState.pythonCode) ? `
                            <div class="w-px h-5 bg-white/10"></div>
                            <button onclick="forgeQuickSave()" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-1.5" title="Sauvegarder dans la Bibliothèque">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                                Sauvegarder
                            </button>
                            <button onclick="forgeExport()" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-1.5" title="Exporter le fichier">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Exporter
                            </button>
                            <button onclick="forgeShowClearModal()" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition flex items-center gap-1.5" title="Effacer le contenu">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                Effacer
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Zone de texte avec Drop Zone -->
                <div class="relative" id="forge-dropzone-container">
                    <!-- Overlay Drop Zone (visible quand vide) -->
                    ${!(forgeState.inputMode === 'natural' ? forgeState.description : forgeState.inputMode === 'pine' ? forgeState.pineCode : forgeState.pythonCode) ? `
                        <div id="forge-dropzone-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div class="text-center p-8 rounded-2xl" style="background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.1);">
                                <div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style="background: rgba(217, 119, 6, 0.1);">
                                    <svg class="w-6 h-6 text-amber-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                    </svg>
                                </div>
                                <p class="text-white/40 text-sm mb-1">Glissez un fichier ici</p>
                                <p class="text-white/25 text-xs mb-3">ou collez / écrivez directement</p>
                                <p class="text-white/20 text-xs mb-4">.pine Â· .txt Â· .py</p>
                                
                                <!-- Bouton Convertir discret (si autre source dispo) -->
                                ${forgeState.inputMode === 'natural' && (forgeState.pineCode || forgeState.pythonCode) ? `
                                    <button onclick="forgeConvertTo('natural')" class="pointer-events-auto px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition flex items-center gap-2 mx-auto">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        Générer depuis ${forgeState.pineCode ? 'Pine Script' : 'Python'}
                                    </button>
                                ` : ''}
                                ${forgeState.inputMode === 'pine' && (forgeState.description || forgeState.pythonCode) ? `
                                    <button onclick="forgeConvertTo('pine')" class="pointer-events-auto px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition flex items-center gap-2 mx-auto">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        Générer depuis ${forgeState.description ? 'Description' : 'Python'}
                                    </button>
                                ` : ''}
                                ${forgeState.inputMode === 'python' && (forgeState.pineCode || forgeState.description) ? `
                                    <button onclick="forgeConvertTo('python')" class="pointer-events-auto px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition flex items-center gap-2 mx-auto">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        Générer depuis ${forgeState.pineCode ? 'Pine Script' : 'Description'}
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Textarea -->
                    <textarea 
                        id="forge-input-unified" 
                        class="w-full p-4 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-all ${forgeState.inputMode !== 'natural' ? 'font-mono' : ''}"
                        style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); --tw-ring-color: rgba(217, 119, 6, 0.5); min-height: 280px; font-size: ${forgeState.inputMode !== 'natural' ? '13px' : '14px'};"
                        placeholder=""
                        oninput="forgeHandleInput(this.value)"
                        ondragover="forgeHandleDragOver(event)"
                        ondragleave="forgeHandleDragLeave(event)"
                        ondrop="forgeHandleDrop(event)"
                    >${forgeState.inputMode === 'natural' ? forgeState.description : forgeState.inputMode === 'pine' ? forgeState.pineCode : forgeState.pythonCode}</textarea>
                </div>
                
                <!-- Indicateur de statut -->
                ${forgeState.inputMode === 'pine' && forgeState.pineCode ? `
                    <div class="mt-3 flex items-center justify-between">
                        <div class="text-xs text-white/40 flex items-center gap-2">
                            <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Pine Script (${forgeState.pineCode.split('\\n').length} lignes)
                            ${forgeState.sourceMeta?.name ? `â€¢ ${forgeState.sourceMeta.name}` : ''}
                            ${forgeState.pythonCode ? '<span class="text-emerald-400 ml-2">â€¢ Python</span>' : ''}
                            ${forgeState.description ? '<span class="text-amber-400 ml-2">â€¢ Description</span>' : ''}
                        </div>
                        <div id="forge-generation-status" class="hidden"></div>
                    </div>
                ` : ''}
                ${forgeState.inputMode === 'python' && forgeState.pythonCode ? `
                    <div class="mt-3 flex items-center justify-between">
                        <div class="text-xs text-white/40 flex items-center gap-2">
                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Python (${forgeState.pythonCode.split('\\n').length} lignes)
                            ${forgeState.pineCode ? '<span class="text-green-400 ml-2">â€¢ Pine</span>' : ''}
                            ${forgeState.description ? '<span class="text-amber-400 ml-2">â€¢ Description</span>' : ''}
                        </div>
                        <div id="forge-generation-status" class="hidden"></div>
                    </div>
                ` : ''}
                ${forgeState.inputMode === 'natural' && forgeState.description && forgeState.description.length > 50 ? `
                    <div class="mt-3 flex items-center justify-between">
                        <div class="text-xs text-white/40 flex items-center gap-2">
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            ${forgeState.description.length} caractères
                            ${forgeState.pineCode ? '<span class="text-green-400 ml-2">â€¢ Pine</span>' : ''}
                            ${forgeState.pythonCode ? '<span class="text-emerald-400 ml-2">â€¢ Python</span>' : ''}
                        </div>
                        <div id="forge-generation-status" class="${forgeState.pineCode && forgeState.pythonCode ? 'mt-0' : 'hidden'}">
                            ${forgeState.pineCode && forgeState.pythonCode ? '<span class="text-green-400/70 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Tout prêt</span>' : ''}
                        </div>
                    </div>
                ` : `
                    <div id="forge-generation-status" class="hidden"></div>
                `}
            </div>
            
            <!-- ZONE BACKTEST v2 avec SUBSTITUTION -->
            <div class="rounded-xl overflow-hidden transition-all duration-300" style="background: rgba(217, 119, 6, 0.08); border: 1px solid rgba(217, 119, 6, 0.25);">
                
                ${forgeState.backtestResults || forgeState.comparativeResults ? `
                    <!-- ÉTAT RÉSULTATS -->
                    <div class="p-5">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-amber-400 font-semibold flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                BACKTEST ${forgeState.comparativeResults ? 'â€¢ Comparatif' : 'â€¢ ' + forgeState.selectedTimeframe}
                                <span class="text-white/40 font-normal text-sm ml-2">Période: ${forgeState.selectedPeriod}</span>
                            </h3>
                            <button onclick="forgeCloseBacktest()" 
                                class="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        
                        ${forgeState.comparativeResults ? `
                            <!-- TABLEAU COMPARATIF -->
                            <div class="overflow-x-auto mb-4">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="text-amber-400/80 text-xs uppercase">
                                            <th class="text-left py-2 px-3">Intervalle</th>
                                            <th class="text-center py-2 px-2">Score</th>
                                            <th class="text-center py-2 px-2">Win Rate</th>
                                            <th class="text-center py-2 px-2">Trades</th>
                                            <th class="text-center py-2 px-2">Wins</th>
                                            <th class="text-center py-2 px-2">Losses</th>
                                            <th class="text-center py-2 px-2">Drawdown</th>
                                            <th class="text-center py-2 px-2" title="Profit Factor = Gains / Pertes">P.F.</th>
                                            <th class="text-center py-2 px-2">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${forgeState.comparativeResults.map(r => {
                                            const score = r.score || 0;
                                            const scoreColor = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';
                                            const isBest = r.timeframe === forgeState.bestTimeframe;
                                            const wins = r.wins || Math.round((r.total_trades || 0) * (r.win_rate || 0) / 100);
                                            const losses = (r.total_trades || 0) - wins;
                                            return `
                                            <tr class="${isBest ? 'bg-amber-500/10' : ''}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5">
                                                    ${isBest ? '<span class="text-amber-400">â˜…</span>' : '<span class="w-4"></span>'}
                                                    ${r.timeframe}
                                                </td>
                                                <td class="py-2 px-2">
                                                    <div class="flex items-center justify-center gap-2">
                                                        <div class="w-16 h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.1);">
                                                            <div class="h-full rounded-full transition-all" style="width: ${score}%; background: ${scoreColor};"></div>
                                                        </div>
                                                        <span class="text-xs font-medium" style="color: ${scoreColor};">${score}</span>
                                                    </div>
                                                </td>
                                                <td class="text-center py-2 px-2 text-white/80">${r.win_rate?.toFixed(1)}%</td>
                                                <td class="text-center py-2 px-2 text-white/60">${r.total_trades}</td>
                                                <td class="text-center py-2 px-2 text-green-400">${wins}</td>
                                                <td class="text-center py-2 px-2 text-red-400">${losses}</td>
                                                <td class="text-center py-2 px-2 text-white/80">${r.max_drawdown?.toFixed(1)}%</td>
                                                <td class="text-center py-2 px-2 text-white/80">${r.profit_factor?.toFixed(2)}</td>
                                                <td class="text-center py-2 px-2 font-medium ${r.total_profit_pct >= 0 ? 'text-green-400' : 'text-red-400'}">
                                                    ${r.total_profit_pct >= 0 ? '+' : ''}${r.total_profit_pct?.toFixed(1)}%
                                                </td>
                                            </tr>
                                        `}).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ${forgeState.bestTimeframe ? renderBestTimeframeBanner() : ''}
                        ` : `
                            <!-- RÉSULTATS SIMPLES -->
                            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                                <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                                    <div class="text-2xl font-bold text-white">${forgeState.backtestResults.win_rate?.toFixed(1) || '--'}%</div>
                                    <div class="text-white/50 text-xs mt-1">Win Rate</div>
                                </div>
                                <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                                    <div class="text-2xl font-bold text-white">${forgeState.backtestResults.profit_factor?.toFixed(2) || '--'}</div>
                                    <div class="text-white/50 text-xs mt-1">Profit Factor</div>
                                </div>
                                <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                                    <div class="text-2xl font-bold text-white">${forgeState.backtestResults.sharpe_ratio?.toFixed(2) || '--'}</div>
                                    <div class="text-white/50 text-xs mt-1">Sharpe Ratio</div>
                                </div>
                                <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                                    <div class="text-2xl font-bold text-white">${forgeState.backtestResults.max_drawdown?.toFixed(1) || '--'}%</div>
                                    <div class="text-white/50 text-xs mt-1">Max Drawdown</div>
                                </div>
                                <div class="p-4 rounded-xl text-center" style="background: ${(forgeState.backtestResults.total_profit_pct || 0) >= 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)'}; border: 1px solid ${(forgeState.backtestResults.total_profit_pct || 0) >= 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'};">
                                    <div class="text-2xl font-bold ${(forgeState.backtestResults.total_profit_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
                                        ${(forgeState.backtestResults.total_profit_pct || 0) >= 0 ? '+' : ''}${forgeState.backtestResults.total_profit_pct?.toFixed(2) || '0.00'}%
                                    </div>
                                    <div class="text-white/50 text-xs mt-1">${forgeState.backtestResults.total_trades || 0} trades</div>
                                </div>
                            </div>
                            
                            <!-- Classement mode simple -->
                            ${renderSimpleRankingBanner()}
                        `}
                        
                        <!-- Analyse IA -->
                        ${forgeState.aiAnalysis ? `
                            <div class="mt-4 p-4 rounded-xl" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
                                <div class="text-amber-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                                    ANALYSE IA
                                </div>
                                <p class="text-white/70 text-sm mb-3">${forgeState.aiAnalysis.summary}</p>
                                ${forgeState.aiAnalysis.suggestions && forgeState.aiAnalysis.suggestions.length > 0 ? `
                                    <div class="space-y-2">
                                        ${forgeState.aiAnalysis.suggestions.map((s, i) => `
                                            <div class="flex items-start gap-3 p-3 rounded-lg" style="background: rgba(0,0,0,0.2);">
                                                <span class="text-amber-400 font-bold text-sm">${i + 1}.</span>
                                                <div class="flex-1">
                                                    <p class="text-white/80 text-sm">${s.text}</p>
                                                    ${s.explanation ? `<p class="text-white/40 text-xs mt-1">${s.explanation}</p>` : ''}
                                                </div>
                                                <div class="flex gap-2">
                                                    <button onclick="forgeApplySuggestion(${i})" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">Appliquer</button>
                                                    <button onclick="forgeIgnoreSuggestion(${i})" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/50 hover:bg-white/20 transition">Ignorer</button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        <!-- Boutons d'action -->
                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-amber-500/20">
                            <div class="flex gap-3">
                                <button onclick="forgeRequestAnalysis()" 
                                    class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${forgeState.isAnalyzing ? 'opacity-50 cursor-not-allowed bg-white/5 text-white/50' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}"
                                    ${forgeState.isAnalyzing ? 'disabled' : ''}>
                                    ${forgeState.isAnalyzing ? `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Analyse...` : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> ${forgeState.aiAnalysis ? 'Nouvelle analyse' : 'Analyser (IA)'}`}
                                </button>
                                <button onclick="forgeNewTest()" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                    Nouveau test
                                </button>
                            </div>
                            <button onclick="forgeShowHistory()" class="text-amber-400/70 text-sm hover:text-amber-400 transition flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Historique
                            </button>
                        </div>
                    </div>
                ` : `
                    <!-- ÉTAT CONFIG -->
                    <div class="p-5">
                        <h3 class="text-amber-400 font-semibold flex items-center gap-2 mb-4">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                            BACKTEST
                        </h3>
                        
                        <!-- Mode Simple / Comparatif -->
                        <div class="flex items-center gap-4 mb-4 p-3 rounded-lg" style="background: rgba(0,0,0,0.2);">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="backtest-mode" value="simple" ${forgeState.backtestMode === 'simple' ? 'checked' : ''} class="accent-amber-500" onchange="forgeState.backtestMode = 'simple'; renderSection();">
                                <span class="text-white text-sm">Simple</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="backtest-mode" value="comparative" ${forgeState.backtestMode === 'comparative' ? 'checked' : ''} class="accent-amber-500" onchange="forgeState.backtestMode = 'comparative'; renderSection();">
                                <span class="text-white text-sm">Comparatif</span>
                                <span class="text-white/40 text-xs">(tous les intervalles)</span>
                            </label>
                        </div>
                        
                        <!-- Sélection Intervalle (mode simple uniquement) -->
                        ${forgeState.backtestMode === 'simple' ? `
                            <div class="mb-4">
                                <label class="text-white/60 text-xs block mb-2">Intervalle</label>
                                <div class="flex flex-wrap gap-2">
                                    ${BACKTEST_TIMEFRAMES.map(tf => `
                                        <button onclick="forgeState.selectedTimeframe = '${tf.value}'; renderSection();"
                                            class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${forgeState.selectedTimeframe === tf.value ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}"
                                        >${tf.label}</button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Sélection Période -->
                        <div class="mb-4">
                            <label class="text-white/60 text-xs block mb-2">Période</label>
                            <div class="flex flex-wrap gap-2">
                                ${BACKTEST_PERIODS.map(p => `
                                    <button onclick="forgeState.selectedPeriod = '${p.value}'; renderSection();"
                                        class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${forgeState.selectedPeriod === p.value ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}"
                                    >${p.label}</button>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Avertissement combinaison -->
                        ${(() => {
                            const warning = forgeState.backtestMode === 'simple' ? getBacktestWarning(forgeState.selectedTimeframe, forgeState.selectedPeriod) : null;
                            return warning ? `
                                <div class="mb-4 p-3 rounded-lg flex items-center gap-2 ${warning.type === 'error' ? 'bg-red-500/15 border border-red-500/30' : 'bg-yellow-500/15 border border-yellow-500/30'}">
                                    <svg class="w-4 h-4 flex-shrink-0 ${warning.type === 'error' ? 'text-red-400' : 'text-yellow-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                    <span class="${warning.type === 'error' ? 'text-red-400' : 'text-yellow-400'} text-sm">${warning.message}</span>
                                </div>
                            ` : '';
                        })()}
                        
                        <!-- Monnaies + Boutons -->
                        <div class="flex flex-wrap items-center gap-4">
                            <div class="flex items-center gap-2">
                                <label class="text-white/60 text-sm">Monnaies :</label>
                                <button onclick="forgeOpenAssetSelector()" 
                                    id="forge-assets-btn"
                                    class="px-3 py-2 rounded-lg text-sm text-white border border-amber-500/30 hover:border-amber-500/50 focus:outline-none cursor-pointer flex items-center gap-2 transition"
                                    style="background: rgba(0,0,0,0.3);"
                                    title="${forgeState.selectedAssets || ''}">
                                    <span id="forge-assets-count">${(() => {
                                        const assets = forgeState.selectedAssets ? forgeState.selectedAssets.split(',') : [];
                                        const count = assets.length;
                                        if (count === 0) return 'Aucun';
                                        if (count <= 3) return assets.map(a => a.replace('USDT', '')).join(', ');
                                        return count + ' sélectionné' + (count > 1 ? 's' : '');
                                    })()}</span>
                                    <svg class="w-4 h-4 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                </button>
                            </div>
                            
                            <div class="flex-1"></div>
                            
                            <button onclick="forgeSimulateBacktest()" 
                                class="px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${forgeState.isSimulating ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70'}"
                                title="Simuler des résultats pour voir l'effet"
                                ${forgeState.isSimulating ? 'disabled' : ''}>
                                ${forgeState.isSimulating ? `
                                    <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                    Simulation...
                                ` : 'Simuler'}
                            </button>
                            
                            <button onclick="forgeGenerateAndTest()" 
                                class="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 ${forgeState.isGenerating ? 'opacity-50 cursor-not-allowed' : ''}"
                                style="background: linear-gradient(135deg, #b45309, #d97706);"
                                ${forgeState.isGenerating ? 'disabled' : ''}>
                                ${forgeState.isGenerating ? `
                                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                    Test en cours...
                                ` : `
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    Backtester
                                `}
                            </button>
                            
                            <button onclick="forgeShowHistory()" 
                                class="px-3 py-2.5 rounded-lg text-xs font-medium bg-white/5 text-white/40 hover:bg-white/10 hover:text-amber-400 transition flex items-center gap-1.5"
                                title="Voir l'historique des backtests">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Historique
                            </button>
                        </div>
                    </div>
                `}
            </div>
            
            <!-- Section Sauvegarde/Déploiement -->
            ${forgeState.pineCode ? `
                <div class="rounded-xl p-5 border border-white/10" style="background: rgba(255,255,255,0.03);">
                    <div class="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div class="lg:flex-1">
                            <label class="text-white/50 text-xs block mb-1.5">Nom de la stratégie</label>
                            <input type="text" id="forge-strategy-name" 
                                class="w-full px-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2"
                                style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; --tw-ring-color: rgba(217, 119, 6, 0.5);"
                                placeholder="Nom de la stratégie"
                                value="${forgeState.sourceMeta?.name || ''}">
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <button onclick="forgeSaveToLibrary()" 
                                class="px-5 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                                Sauvegarder
                            </button>
                            <button onclick="forgeDeployTest()" 
                                class="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition flex items-center gap-2"
                                style="background: linear-gradient(135deg, #3b82f6, #60a5fa);">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                                Déployer TEST
                            </button>
                            <button onclick="forgeDeployActive()" 
                                class="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition flex items-center gap-2"
                                style="background: linear-gradient(135deg, #059669, #10b981);">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                                Déployer ACTIF
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- MODALE HISTORIQUE BACKTESTS -->
            <div id="forge-history-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);">
                <div class="w-full max-w-5xl rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex items-center justify-between p-5 border-b border-white/10">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Historique des Backtests
                            <span id="history-count" class="text-white/40 text-sm font-normal ml-2"></span>
                        </h3>
                        <button onclick="forgeCloseHistory()" class="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    
                    <!-- Filtres -->
                    <div class="px-5 py-3 border-b border-white/10 flex flex-wrap items-center gap-3" style="background: rgba(0,0,0,0.2);">
                        <div class="flex items-center gap-2">
                            <label class="text-white/50 text-xs">Type:</label>
                            <select id="history-filter-type" onchange="forgeRenderHistoryList()" class="px-2 py-1 rounded text-xs border border-white/20 focus:outline-none" style="background: rgba(0,0,0,0.3); color: white;">
                                <option value="all">Tous</option>
                                <option value="simple">Simple</option>
                                <option value="comparative">Comparatif</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-white/50 text-xs">Famille:</label>
                            <select id="history-filter-family" onchange="forgeRenderHistoryList()" class="px-2 py-1 rounded text-xs border border-white/20 focus:outline-none" style="background: rgba(0,0,0,0.3); color: white;">
                                <option value="all">Toutes</option>
                                <option value="oscillator">Oscillateurs</option>
                                <option value="trend">Tendance</option>
                                <option value="momentum">Momentum</option>
                                <option value="volatility">Volatilité</option>
                                <option value="volume">Volume</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-white/50 text-xs">Stratégie:</label>
                            <select id="history-filter-strategy" onchange="forgeRenderHistoryList()" class="px-2 py-1 rounded text-xs border border-white/20 focus:outline-none" style="background: rgba(0,0,0,0.3); color: white; max-width: 150px;">
                                <option value="all">Toutes</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-white/50 text-xs">Tri:</label>
                            <select id="history-sort" onchange="forgeRenderHistoryList()" class="px-2 py-1 rounded text-xs border border-white/20 focus:outline-none" style="background: rgba(0,0,0,0.3); color: white;">
                                <option value="date-desc">Date (récent)</option>
                                <option value="date-asc">Date (ancien)</option>
                                <option value="score-desc">Score (meilleur)</option>
                                <option value="score-asc">Score (pire)</option>
                                <option value="profit-desc">Profit (meilleur)</option>
                                <option value="profit-asc">Profit (pire)</option>
                            </select>
                        </div>
                        <button id="load-best-btn" onclick="forgeLoadBestVersion()" class="hidden px-3 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                            Charger la meilleure
                        </button>
                    </div>
                    
                    <div class="p-5 overflow-y-auto" style="max-height: 60vh;">
                        <table class="w-full text-sm">
                            <thead class="sticky top-0" style="background: rgba(30, 30, 50, 0.98);">
                                <tr class="text-white/50 text-xs uppercase border-b border-white/10">
                                    <th class="text-left py-2 px-2">Stratégie</th>
                                    <th class="text-left py-2 px-2">Famille</th>
                                    <th class="text-center py-2 px-2">Mode</th>
                                    <th class="text-center py-2 px-2">Meilleur TF</th>
                                    <th class="text-center py-2 px-2">Score</th>
                                    <th class="text-center py-2 px-2">Profit</th>
                                    <th class="text-center py-2 px-2">Période</th>
                                    <th class="text-left py-2 px-2">Date</th>
                                    <th class="text-center py-2 px-2">Action</th>
                                </tr>
                            </thead>
                            <tbody id="forge-history-body" class="text-white/80">
                                <tr><td colspan="9" class="py-8 text-center text-white/40">Chargement...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="p-4 border-t border-white/10 flex justify-between items-center">
                        <div class="flex gap-3">
                            <button onclick="forgeExportHistory()" class="text-amber-400/70 text-sm hover:text-amber-400 transition flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Exporter JSON
                            </button>
                            <button onclick="forgeClearHistory()" class="text-red-400/70 text-sm hover:text-red-400 transition">
                                Vider l'historique
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function forgeSetType(type) {
    forgeState.strategyType = type;
    renderSection();
}

function forgeSetAtelierMode(mode) {
    forgeState.atelierMode = mode;
    if (mode === 'create' || mode === 'choice') {
        forgeState.createView = 'projects';
        forgeState.currentProjectId = null;
        forgeState.currentProject = null;
    }
    renderSection();
    if (mode === 'create') {
        fetch(API_BASE + '/api/forge/projects?_t=' + Date.now(), {
            cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }
        }).then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) { forgeState.projects = data.projects; renderSection(); } })
          .catch(function() {});
    }
}

function forgeReset() {
    const currentMode = forgeState.atelierMode;
    const currentView = forgeState.createView;
    const currentProjectId = forgeState.currentProjectId;
    const currentProject = forgeState.currentProject;
    const projects = forgeState.projects;
    const deletedProjectIds = forgeState.deletedProjectIds;
    const messages = forgeState.messages;
    const versions = forgeState.versions;
    
    forgeState = {
        // Conserver le mode actuel
        atelierMode: currentMode,
        createView: currentView,
        currentProjectId: currentProjectId,
        currentProject: currentProject,
        projects: projects,
        deletedProjectIds: deletedProjectIds,
        messages: messages,
        versions: versions,
        chatInput: '',
        isSendingMessage: false,
        isLoadingProjects: false,
        // Reset du mode convert
        description: '',
        pineCode: '',
        pythonCode: '',
        refinement: '',
        showPineCode: false,
        conversationHistory: [],
        backtestResults: null,
        aiAnalysis: null,
        isGenerating: false,
        isAnalyzing: false,
        isSimulating: false,
        strategyType: 'strategy',
        inputMode: 'natural',
        selectedAssets: 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT',
        selectedPeriod: '3M',
        backtestMode: 'simple',
        selectedTimeframe: '1h',
        comparativeResults: null,
        bestTimeframe: null,
        source: null,
        sourceMeta: null
    };
    renderSection();
}

// ============================================
// MODE CRÉER - Système conversationnel
// ============================================

// Rendu du mode Créer
function renderAtelierCreate() {
    if (forgeState.createView === 'chat' && forgeState.currentProjectId) {
        return renderForgeChat();
    }
    return renderForgeProjects();
}

// Liste des projets
function renderForgeProjects() {
    const projects = forgeState.projects || [];
    
    return `
        <div class="rounded-2xl p-6" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08);">
        <div class="space-y-6">
            <!-- Header avec retour -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <button onclick="forgeSetAtelierMode('choice')" class="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition" title="Retour">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div>
                        <h2 class="text-2xl font-bold text-white">Créer</h2>
                        <p class="text-white/60 text-sm mt-1">Vos projets de stratégies</p>
                    </div>
                </div>
                ${!forgeState.isLoadingProjects && projects.length > 0 ? `
                <button onclick="forgeShowNewProjectModal()" class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2" style="background: linear-gradient(135deg, #b45309, #d97706); color: white;">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Nouveau projet
                </button>
                ` : ''}
            </div>
            
            <!-- Liste des projets -->
            ${forgeState.isLoadingProjects ? `
                <div class="flex items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
            ` : projects.length > 0 ? `
                <div class="space-y-3">
                    ${projects.map(project => `
                        <div class="group p-4 rounded-xl transition hover:scale-[1.01]"
                            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                            <div class="flex items-center justify-between">
                                <button onclick="forgeOpenProject('${project.id}')" class="flex items-center gap-4 flex-1 text-left">
                                    <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(217, 119, 6, 0.15);">
                                        <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                        </svg>
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex items-center gap-3">
                                            <span class="text-white font-medium">${project.name}</span>
                                            <span class="px-1.5 py-0.5 rounded text-xs font-medium" style="background: rgba(217, 119, 6, 0.2); color: #fbbf24;">v${project.current_version || 0}</span>
                                            <span class="text-white/30 text-xs">${formatRelativeDate(project.updated_at)}</span>
                                        </div>
                                        <div class="text-white/40 text-sm">${project.description || 'Aucune description'}</div>
                                    </div>
                                </button>
                                <div class="flex items-center gap-3">
                                    <button onclick="event.stopPropagation(); forgeOpenProject('${project.id}')" 
                                        class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                        style="background: linear-gradient(135deg, #b45309, #d97706); color: white;">
                                        Forger
                                    </button>
                                    <button onclick="event.stopPropagation(); forgeConfirmDeleteProject('${project.id}', '${project.name.replace(/'/g, "\\'")}')" 
                                        class="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                                        title="Supprimer">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="text-center py-16">
                    <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style="background: rgba(217, 119, 6, 0.1);">
                        <svg class="w-10 h-10 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-medium text-white mb-2">Aucun projet</h3>
                    <p class="text-white/50 mb-6">Créez votre premier projet pour commencer</p>
                    <button onclick="forgeShowNewProjectModal()" class="px-6 py-3 rounded-xl text-sm font-medium transition" style="background: linear-gradient(135deg, #b45309, #d97706); color: white;">
                        Créer un projet
                    </button>
                </div>
            `}
        </div>
        </div>
        
        <!-- Modal nouveau projet -->
        <div id="forge-new-project-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.7);">
            <div class="max-w-md w-full mx-4 p-6 rounded-2xl" style="background: linear-gradient(135deg, rgba(30,27,75,0.98), rgba(15,23,42,0.98)); border: 1px solid rgba(255,255,255,0.08);">
                <h3 class="text-xl font-bold text-white mb-4">Nouveau projet</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Nom du projet</label>
                        <input type="text" id="forge-new-project-name" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            placeholder="Ex: RSI Momentum Strategy"
                            oninput="forgeValidateProjectName(this.value)"
                            onblur="forgeValidateProjectName(this.value)">
                        <div id="forge-name-error" class="hidden mt-2 text-sm text-red-400 flex items-center gap-2">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span id="forge-name-error-text">Ce nom est déjà utilisé</span>
                        </div>
                    </div>
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Auteur (optionnel)</label>
                        <input type="text" id="forge-new-project-author" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            placeholder="Votre nom ou pseudo">
                    </div>
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Description (optionnel)</label>
                        <textarea id="forge-new-project-desc" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 resize-none"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            rows="2"
                            placeholder="Décrivez brièvement votre stratégie"></textarea>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="forgeCloseNewProjectModal()" class="flex-1 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition">
                        Annuler
                    </button>
                    <button id="forge-create-btn" onclick="forgeCreateProject()" class="flex-1 px-4 py-3 rounded-xl text-white font-medium transition" style="background: linear-gradient(135deg, #b45309, #d97706);">
                        Créer
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Modal suppression projet -->
        <div id="forge-delete-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.7);">
            <div class="max-w-sm w-full mx-4 p-6 rounded-2xl" style="background: linear-gradient(135deg, rgba(30,27,75,0.98), rgba(15,23,42,0.98)); border: 1px solid rgba(255,255,255,0.08);">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style="background: rgba(239, 68, 68, 0.15);">
                        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Supprimer le projet</h3>
                    <p class="text-white/60">
                        Voulez-vous supprimer <span id="forge-delete-project-name" class="text-white font-medium"></span> ?
                    </p>
                    <p class="text-white/40 text-sm mt-2">Cette action est irréversible.</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="forgeCloseDeleteModal()" class="flex-1 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition">
                        Annuler
                    </button>
                    <button onclick="forgeDeleteProject()" class="flex-1 px-4 py-3 rounded-xl text-white font-medium transition" style="background: linear-gradient(135deg, #dc2626, #ef4444);">
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Chat conversationnel
function renderForgeChat() {
    const project = forgeState.currentProject;
    const messages = forgeState.messages || [];
    const hasMessages = messages.length > 0;
    
    if (!project) {
        return `<div class="text-center py-12 text-white/50">Chargement...</div>`;
    }
    
    return `
        <div class="space-y-4">
            <!-- Header avec métadonnées -->
            <div class="pb-4 border-b border-white/10">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-4">
                        <button onclick="forgeBackToProjects()" class="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition" title="Retour aux projets">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-xl font-bold text-white">${project.name}</h2>
                                <button onclick="forgeShowRenameModal()" class="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition" title="Renommer">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                </button>
                                <span class="px-2 py-0.5 rounded text-xs font-medium" style="background: rgba(217, 119, 6, 0.2); color: #fbbf24;">
                                    v${project.current_version || 0}
                                </span>
                                ${project.current_version > 0 ? `<button onclick="forgeReopenResult()" class="px-2.5 py-1 rounded-lg text-xs font-medium transition" style="background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08);" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.color='rgba(255,255,255,0.5)';">Voir le code</button>` : ''}
                            </div>
                            <p class="text-white/40 text-sm">${project.description || ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="forgeShowVersionsModal()" class="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition" title="Historique des versions">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                        <button onclick="forgeSaveToLibrary()" class="px-4 py-2 rounded-lg text-sm font-medium transition" style="background: linear-gradient(135deg, #10b981, #14b8a6); color: white;">
                            Sauvegarder
                        </button>
                    </div>
                </div>
                <!-- Métadonnées -->
                <div class="flex items-center gap-4 text-xs text-white/40 ml-14">
                    <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        ${project.author || 'Non spécifié'}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        Créé ${formatDateShort(project.created_at)}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Modifié ${formatRelativeDate(project.updated_at)}
                    </span>
                </div>
            </div>
            
            <!-- Zone principale: Messages + Input intégrés -->
            <div class="rounded-xl overflow-hidden" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);">
                ${hasMessages ? `
                    <!-- Header zone messages avec bouton effacer -->
                    <div class="flex items-center justify-end px-4 pt-3 pb-1">
                        <button onclick="forgeShowClearChatModal()" class="text-white/30 hover:text-red-400/70 text-xs transition flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            Effacer les messages
                        </button>
                    </div>
                    <!-- Messages existants - 75% en fullscreen -->
                    <div id="forge-chat-messages" class="overflow-y-auto px-4 pb-4 space-y-3" style="height: ${forgeState.chatFullscreen ? '550px' : '250px'};">
                        ${messages.map(msg => renderForgeChatMessage(msg)).join('')}
                    </div>
                    <!-- Séparateur -->
                    <div style="border-top: 1px solid rgba(255,255,255,0.05);"></div>
                ` : ''}
                
                <!-- Zone d'écriture - 25% en fullscreen -->
                <div class="p-4">
                    <textarea 
                        id="forge-chat-input"
                        class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 resize-none"
                        style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5); height: ${forgeState.chatFullscreen ? '150px' : (hasMessages ? '150px' : '280px')};"
                        placeholder="Décrivez votre stratégie de trading...${hasMessages ? '' : '\n\nTapez FORGE quand vous êtes prêt à générer le code.'}"
                        oninput="forgeState.chatInput = this.value"
                        onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); forgeSendMessage(); }"
                    >${forgeState.chatInput || ''}</textarea>
                    
                    <div class="flex items-center justify-between mt-3">
                        <button onclick="forgeToggleFullscreen()" class="text-white/40 hover:text-white/70 text-xs transition flex items-center gap-1">
                            ${forgeState.chatFullscreen ? `
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/></svg>
                                Réduire
                            ` : `
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
                                Grand écran
                            `}
                        </button>
                        <div class="flex items-center gap-2">
                            ${(forgeState.lastGeneratedCode || (project && project.current_version > 0)) ? `
                                <button onclick="forgeScrollToBacktest()" 
                                    class="px-4 py-2 rounded-xl text-amber-400 text-sm font-medium transition hover:bg-amber-500/20"
                                    style="border: 1px solid rgba(217, 119, 6, 0.4); background: rgba(217, 119, 6, 0.1);">
                                    Backtest
                                </button>
                            ` : `
                                <button disabled
                                    class="px-4 py-2 rounded-xl text-white/30 text-sm font-medium cursor-not-allowed"
                                    style="border: 1px solid rgba(255,255,255,0.05);"
                                    title="Générez du code avec FORGE pour activer le backtest">
                                    Backtest
                                </button>
                            `}
                            <button onclick="forgeSendMessage()" 
                                class="px-5 py-2 rounded-xl text-white text-sm font-medium transition ${forgeState.isSendingMessage ? 'opacity-50 cursor-not-allowed' : ''}"
                                style="background: linear-gradient(135deg, #b45309, #d97706);"
                                ${forgeState.isSendingMessage ? 'disabled' : ''}>
                                ${forgeState.isSendingMessage ? 'Envoi...' : 'Envoyer'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ZONE BACKTEST - EN BAS (cachée en mode fullscreen) -->
            ${!forgeState.chatFullscreen ? renderForgeBacktestModule('create') : ''}
        </div>
        
        <!-- Modal renommer -->
        <div id="forge-rename-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.8);">
            <div class="max-w-md w-full mx-4 p-5 rounded-2xl" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                <h3 class="text-lg font-semibold text-white mb-4">Renommer le projet</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Nom</label>
                        <input type="text" id="forge-rename-name" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            oninput="forgeValidateRenameName(this.value)"
                            value="${project.name}">
                        <div id="forge-rename-error" class="hidden mt-2 text-red-400 text-xs flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span id="forge-rename-error-text"></span>
                        </div>
                    </div>
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Auteur</label>
                        <input type="text" id="forge-rename-author" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            value="${project.author || ''}">
                    </div>
                    <div>
                        <label class="block text-white/60 text-sm mb-2">Description</label>
                        <textarea id="forge-rename-desc" 
                            class="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 resize-none"
                            style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); --tw-ring-color: rgba(217, 119, 6, 0.5);"
                            rows="2">${project.description || ''}</textarea>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="forgeCloseRenameModal()" class="flex-1 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition">
                        Annuler
                    </button>
                    <button id="forge-rename-btn" onclick="forgeRenameProject()" class="flex-1 px-4 py-3 rounded-xl text-white font-medium transition" style="background: linear-gradient(135deg, #b45309, #d97706);">
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Modal versions -->
        <div id="forge-versions-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.8);">
            <div class="max-w-lg w-full mx-4 p-5 rounded-2xl max-h-[80vh] overflow-hidden flex flex-col" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white">Historique des versions</h3>
                    <button onclick="forgeCloseVersionsModal()" class="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto space-y-3">
                    ${(forgeState.versions || []).length > 0 ? forgeState.versions.map(ver => `
                        <div class="p-4 rounded-xl ${ver.version === project.current_version ? 'ring-1 ring-green-500/30' : ''}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-white font-medium">v${ver.version}</span>
                                <span class="text-white/40 text-xs">${formatRelativeDate(ver.created_at)}</span>
                            </div>
                            <p class="text-white/60 text-sm mb-3">${ver.summary || 'Aucun résumé'}</p>
                            <div class="flex gap-3">
                                <button onclick="forgeViewVersionCode('${ver.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition">
                                    Voir le code
                                </button>
                                ${ver.version !== project.current_version ? `
                                    <button onclick="forgeRestoreVersion('${ver.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition">
                                        Restaurer
                                    </button>
                                ` : `
                                    <span class="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 font-medium flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                        Active
                                    </span>
                                `}
                            </div>
                        </div>
                    `).join('') : `
                        <div class="text-center py-8 text-white/40">
                            Aucune version générée. Tapez FORGE pour créer la première.
                        </div>
                    `}
                </div>
            </div>
        </div>
        
        <!-- Modal effacer les messages -->
        <div id="forge-clear-chat-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.8);">
            <div class="max-w-sm w-full mx-4 p-5 rounded-2xl" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style="background: rgba(239, 68, 68, 0.2);">
                        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">Effacer les messages</h3>
                    <p class="text-white/60">
                        Voulez-vous effacer tous les messages de cette conversation ?
                    </p>
                    <p class="text-white/40 text-sm mt-2">Cette action est irréversible.</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="forgeCloseClearChatModal()" class="flex-1 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition">
                        Annuler
                    </button>
                    <button onclick="forgeClearChatConfirmed()" class="flex-1 px-4 py-3 rounded-xl text-white font-medium transition" style="background: linear-gradient(135deg, #dc2626, #ef4444);">
                        Effacer
                    </button>
                </div>
            </div>
        </div>
    `;
}
function renderForgeChatMessage(msg) {
    const isUser = msg.role === 'user';
    const isForgeResult = msg.message_type === 'forge_result';
    
    if (isForgeResult) {
        // Message épuré avec code généré — détails dans la modale
        let metadata = {};
        try {
            metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});
        } catch(e) {}
        
        return `
            <div data-message-role="assistant" class="flex justify-start">
                <div class="max-w-[85%] rounded-2xl rounded-bl-md overflow-hidden" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
                    
                    <div class="px-5 py-4 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style="background: rgba(74, 222, 128, 0.15);">
                                <svg class="w-3.5 h-3.5" style="color: #4ade80;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                                </svg>
                            </div>
                            <p class="text-white/90 text-sm leading-relaxed">${msg.content.includes(').') ? msg.content.split(').')[0] + ')' : msg.content}</p>
                        </div>
                        ${metadata.pine_code ? `
                            <button onclick="forgeReopenResultFromMsg('${msg.id}')"
                                class="px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0"
                                style="background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08);"
                                onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';"
                                onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.color='rgba(255,255,255,0.5)';">
                                Voir le code
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Message "IA réfléchit" avec animation
    if (msg.message_type === 'thinking') {
        return `
            <div data-message-role="assistant" class="flex justify-start py-2">
                <div class="flex items-center gap-2">
                    <div class="flex gap-1">
                        <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0ms;"></span>
                        <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 150ms;"></span>
                        <span class="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 300ms;"></span>
                    </div>
                    <span class="text-amber-400 text-sm font-medium">Dtego réfléchit...</span>
                </div>
            </div>
        `;
    }
    
    // Largeurs selon le mode: fullscreen = 25% user / 75% assistant, normal = 80% / 80%
    const userWidth = forgeState.chatFullscreen ? 'max-w-[25%]' : 'max-w-[80%]';
    const assistantWidth = forgeState.chatFullscreen ? 'max-w-[75%]' : 'max-w-[80%]';
    
    return `
        <div data-message-role="${msg.role}" class="flex ${isUser ? 'justify-end' : 'justify-start'}">
            <div class="${isUser ? userWidth : assistantWidth} p-4 rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}"
                style="background: ${isUser ? 'rgba(217, 119, 6, 0.15)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${isUser ? 'rgba(217, 119, 6, 0.2)' : 'rgba(255,255,255,0.1)'};">
                <p class="text-white/90 text-sm whitespace-pre-wrap">${msg.content}</p>
                <p class="text-white/30 text-xs mt-2">${formatTime(msg.created_at)}</p>
            </div>
        </div>
    `;
}

// Fonctions utilitaires
function formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Fonctions API
async function forgeLoadProjects() {
    forgeState.isLoadingProjects = true;
    renderSection();
    
    try {
        // FORCER bypass cache avec headers + timestamp
        const response = await fetch(`${API_BASE}/api/forge/projects?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (data.success) {
            // Le backend filtre déjà par status='active'
            forgeState.projects = data.projects;
            console.log(`[Forge] Loaded ${forgeState.projects.length} projects`);
        }
    } catch (error) {
        console.error('[Forge] Error loading projects:', error);
        showCenteredModal('Erreur de chargement des projets', 'error');
    }
    
    forgeState.isLoadingProjects = false;
    renderSection();
}

async function forgeShowNewProjectModal() {
    // NE PAS recharger depuis la DB - la liste locale forgeState.projects est à jour
    
    forgeState.newProjectModalOpen = true;
    document.getElementById('forge-new-project-modal').classList.remove('hidden');
    // Réinitialiser l'état d'erreur
    document.getElementById('forge-name-error').classList.add('hidden');
    document.getElementById('forge-create-btn').disabled = false;
    document.getElementById('forge-create-btn').style.opacity = '1';
    forgeNameValidState = true;
}

function forgeCloseNewProjectModal() {
    forgeState.newProjectModalOpen = false;
    document.getElementById('forge-new-project-modal').classList.add('hidden');
    document.getElementById('forge-new-project-name').value = '';
    document.getElementById('forge-new-project-author').value = '';
    document.getElementById('forge-new-project-desc').value = '';
    document.getElementById('forge-name-error').classList.add('hidden');
}

// Validation en temps réel du nom de projet
let forgeNameValidState = true;

function forgeValidateProjectName(name) {
    const trimmedName = name.trim();
    const errorDiv = document.getElementById('forge-name-error');
    const errorText = document.getElementById('forge-name-error-text');
    const createBtn = document.getElementById('forge-create-btn');
    const inputField = document.getElementById('forge-new-project-name');
    
    if (!trimmedName) {
        errorDiv.classList.add('hidden');
        inputField.style.borderColor = 'rgba(255,255,255,0.1)';
        forgeNameValidState = true;
        createBtn.disabled = false;
        createBtn.style.opacity = '1';
        return;
    }
    
    const existingProject = forgeState.projects.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (existingProject) {
        // Nom déjà pris
        errorDiv.classList.remove('hidden');
        errorText.textContent = 'Ce nom est déjà utilisé par un autre projet';
        inputField.style.borderColor = '#ef4444';
        createBtn.disabled = true;
        createBtn.style.opacity = '0.5';
        forgeNameValidState = false;
    } else {
        // Nom valide
        errorDiv.classList.add('hidden');
        inputField.style.borderColor = 'rgba(255,255,255,0.1)';
        createBtn.disabled = false;
        createBtn.style.opacity = '1';
        forgeNameValidState = true;
    }
}

async function forgeCreateProject() {
    const name = document.getElementById('forge-new-project-name').value.trim();
    const author = document.getElementById('forge-new-project-author').value.trim();
    const description = document.getElementById('forge-new-project-desc').value.trim();
    
    if (!name) {
        document.getElementById('forge-name-error').classList.remove('hidden');
        document.getElementById('forge-name-error-text').textContent = 'Le nom du projet est requis';
        document.getElementById('forge-new-project-name').style.borderColor = '#ef4444';
        return;
    }
    
    // Vérifier unicité du nom (double check)
    if (!forgeNameValidState) {
        return;
    }
    
    const existingProject = forgeState.projects.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingProject) {
        forgeValidateProjectName(name);
        return;
    }
    
    // IMMÉDIATEMENT: fermer la modal
    forgeCloseNewProjectModal();
    
    // Créer le projet via API
    try {
        const response = await fetch(`${API_BASE}/api/forge/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, author: author || null, description })
        });
        const data = await response.json();
        
        if (data.success) {
            // Ajouter le projet à la liste IMMÉDIATEMENT
            forgeState.projects.unshift(data.project);
            renderSection();
            showCenteredModal('Projet créé', 'success');
        } else {
            showCenteredModal(data.error || 'Erreur de création', 'error');
        }
    } catch (error) {
        console.error('[Forge] Error creating project:', error);
        showCenteredModal('Erreur de création', 'error');
    }
}

async function forgeOpenProject(projectId) {
    forgeState.currentProjectId = projectId;
    forgeState.createView = 'chat';
    
    try {
        // Cache-buster pour forcer le rechargement depuis la DB
        const response = await fetch(`${API_BASE}/api/forge/projects/${projectId}?_t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            forgeState.currentProject = data.project;
            forgeState.messages = data.messages;
            forgeState.versions = data.versions;
            
            // Mettre à jour aussi dans la liste des projets
            const projectIndex = forgeState.projects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                forgeState.projects[projectIndex] = { ...forgeState.projects[projectIndex], ...data.project };
            }
        }
    } catch (error) {
        console.error('[Forge] Error opening project:', error);
        showCenteredModal('Erreur de chargement', 'error');
    }
    
    renderSection();
    
    // Scroll to bottom
    setTimeout(() => {
        const chatEl = document.getElementById('forge-chat-messages');
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 100);
}

function forgeBackToProjects() {
    forgeState.createView = 'projects';
    forgeState.currentProjectId = null;
    forgeState.currentProject = null;
    forgeState.messages = [];
    forgeState.versions = [];
    forgeState.chatInput = '';
    // NE PAS recharger les projets - utiliser la liste locale déjà mise à jour
    // forgeState.projects contient déjà les modifications locales
    renderSection();
}

async function forgeSendMessage() {
    const input = document.getElementById('forge-chat-input');
    const message = input ? input.value.trim() : '';
    
    if (!message || forgeState.isSendingMessage) return;
    
    forgeState.chatInput = '';
    forgeState.isSendingMessage = true;
    
    // 1. IMMÉDIATEMENT: Ajouter le message utilisateur au chat
    const tempUserMsg = {
        id: 'temp-user-' + Date.now(),
        role: 'user',
        content: message,
        message_type: 'user',
        created_at: new Date().toISOString()
    };
    forgeState.messages.push(tempUserMsg);
    
    // 2. IMMÉDIATEMENT: Ajouter l'indicateur "IA réfléchit"
    const thinkingMsg = {
        id: 'thinking',
        role: 'assistant',
        content: '',
        message_type: 'thinking',
        created_at: new Date().toISOString()
    };
    forgeState.messages.push(thinkingMsg);
    
    renderSection();
    
    // Auto-scroll immédiat
    setTimeout(() => {
        const messagesDiv = document.getElementById('forge-chat-messages');
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 50);
    
    // Afficher modale GENERATING seulement si commande FORGE détectée
    const isForgeCommand = /\bforge\b/i.test(message);
    if (isForgeCommand) {
        forgeShowGenerating();
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/forge/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: forgeState.currentProjectId,
                message: message
            })
        });
        const data = await response.json();
        
        if (data.success) {
            // Si c'est une commande FORGE, mettre à jour la version IMMÉDIATEMENT
            if (data.is_forge_command && data.version) {
                forgeState.currentProject.current_version = data.version;
                // Mettre à jour aussi dans la liste des projets
                const projectIndex = forgeState.projects.findIndex(p => p.id === forgeState.currentProjectId);
                if (projectIndex !== -1) {
                    forgeState.projects[projectIndex].current_version = data.version;
                }
                forgeState.lastGeneratedCode = {
                    pine: data.pine_code,
                    python: data.python_code
                };
                
                // Transition modale GENERATING → RESULT
                forgeShowResult(data.pine_code, data.python_code, data.version);
                
                // Lancer analyse granulaire en arrière-plan
                if (data.pine_code) {
                    const projectName = forgeState.currentProject?.name || 'Stratégie';
                    console.log('[FORGE CHAT] Lancement analyse granulaire en background');
                    forgeState.forgeModalGranulesLoading = true;
                    forgeModalUpdateGranulesButton();
                    
                    // Extraction + comparaison en parallèle
                    (async () => {
                        try {
                            const grResp = await fetch(`${API_BASE}/api/forge/extract-granules`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: data.pine_code, code_type: 'pine', save_new: false })
                            });
                            const grData = await grResp.json();
                            
                            if (grData.success && grData.granules && grData.granules.length > 0) {
                                const comparison = await compareGranulesWithLibrary(grData.granules);
                                forgeState.forgeModalGranules = comparison;
                                const resultMsg = [...(forgeState.messages || [])].reverse().find(m => m.message_type === 'forge_result');
                                if (resultMsg) {
                                    let meta = typeof resultMsg.metadata === 'string' ? JSON.parse(resultMsg.metadata) : (resultMsg.metadata || {});
                                    meta.granules = comparison;
                                    resultMsg.metadata = meta;
                                    // Persist to DB
                                    fetch(`${API_BASE}/api/forge/messages/${resultMsg.id}/metadata`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ granules: comparison })
                                    }).catch(e => console.error('[FORGE] Failed to persist granules:', e));
                                }
                                console.log(`[FORGE MODAL] ${comparison.length} granule(s) prêtes`);
                            } else {
                                forgeState.forgeModalGranules = [];
                            }
                        } catch (grErr) {
                            console.error('[FORGE MODAL] Erreur granules:', grErr);
                            forgeState.forgeModalGranules = [];
                        }
                        forgeState.forgeModalGranulesLoading = false;
                        forgeModalUpdateGranulesButton();
                    })();
                }
            } else {
                // Pas une commande Forge (message texte) — fermer la modale
                forgeCloseModal();
            }
            
            // Recharger les messages (remplace les temporaires)
            await forgeOpenProject(forgeState.currentProjectId);
        } else {
            // Retirer le message thinking en cas d'erreur
            forgeState.messages = forgeState.messages.filter(m => m.id !== 'thinking');
            forgeCloseModal();
            showCenteredModal(data.error || 'Erreur d\'envoi', 'error');
        }
    } catch (error) {
        console.error('[Forge] Error sending message:', error);
        forgeState.messages = forgeState.messages.filter(m => m.id !== 'thinking');
        forgeCloseModal();
        showCenteredModal('Erreur d\'envoi', 'error');
    }
    
    forgeState.isSendingMessage = false;
    renderSection();
    
    // Auto-scroll: positionner le dernier message assistant en haut de la zone visible
    setTimeout(() => {
        const messagesDiv = document.getElementById('forge-chat-messages');
        if (messagesDiv) {
            // Trouver le dernier message assistant
            const messages = messagesDiv.querySelectorAll('[data-message-role="assistant"]');
            if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                // Calculer la position du message dans le conteneur
                const msgTop = lastMsg.offsetTop;
                // Scroll le CONTENEUR (pas la page) pour que le début du message soit visible
                messagesDiv.scrollTop = msgTop - 10; // -10px de marge en haut
            } else {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        }
    }, 100);
}

function forgeShowVersionsModal() {
    document.getElementById('forge-versions-modal').classList.remove('hidden');
}

function forgeCloseVersionsModal() {
    document.getElementById('forge-versions-modal').classList.add('hidden');
}

function forgeToggleFullscreen() {
    forgeState.chatFullscreen = !forgeState.chatFullscreen;
    renderSection();
    // Scroll vers le bas après toggle
    setTimeout(() => {
        const chatEl = document.getElementById('forge-chat-messages');
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 50);
}

function forgeScrollToBacktest() {
    // Si en mode fullscreen, sortir du mode fullscreen d'abord
    if (forgeState.chatFullscreen) {
        forgeState.chatFullscreen = false;
        renderSection();
    }
    // Scroll vers le module backtest
    setTimeout(() => {
        const backtestEl = document.querySelector('[data-backtest-module]');
        if (backtestEl) {
            backtestEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

function forgeShowClearChatModal() {
    document.getElementById('forge-clear-chat-modal').classList.remove('hidden');
}

function forgeCloseClearChatModal() {
    document.getElementById('forge-clear-chat-modal').classList.add('hidden');
}

async function forgeClearChatConfirmed() {
    if (!forgeState.currentProjectId) return;
    
    // Fermer la modal immédiatement
    forgeCloseClearChatModal();
    
    // Optimistic UI: vider immédiatement
    forgeState.messages = [];
    renderSection();
    showCenteredModal('Conversation effacée', 'success');
    
    // Appel API en arrière-plan
    try {
        await fetch(`${API_BASE}/api/forge/projects/${forgeState.currentProjectId}/clear`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('[Forge] Error clearing chat:', error);
    }
}

function forgeShowResultCode(type, msgId) {
    const container = document.getElementById(`forge-result-code-${msgId}`);
    const codeEl = container.querySelector('code');
    
    // Trouver le message
    const msg = forgeState.messages.find(m => m.id === msgId);
    if (!msg) return;
    
    let metadata = {};
    try {
        metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});
    } catch(e) {}
    
    const code = type === 'pine' ? metadata.pine_code : metadata.python_code;
    codeEl.textContent = code || 'Code non disponible';
    container.classList.toggle('hidden');
}

function forgeCopyResultCode(type, msgId) {
    const msg = forgeState.messages.find(m => m.id === msgId);
    if (!msg) return;
    
    let metadata = {};
    try {
        metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});
    } catch(e) {}
    
    const code = type === 'pine' ? metadata.pine_code : metadata.python_code;
    if (code) {
        navigator.clipboard.writeText(code);
        showCenteredModal('Code copié', 'success');
    }
}

async function forgeRestoreVersion(versionId) {
    try {
        const response = await fetch(`${API_BASE}/api/forge/versions/${versionId}/restore`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showCenteredModal(data.message, 'success');
            forgeCloseVersionsModal();
            // Recharger le projet
            await forgeOpenProject(forgeState.currentProjectId);
        } else {
            showCenteredModal(data.error || 'Erreur de restauration', 'error');
        }
    } catch (error) {
        console.error('[Forge] Error restoring version:', error);
        showCenteredModal('Erreur de restauration', 'error');
    }
}

function forgeViewVersionCode(versionId) {
    const version = forgeState.versions.find(v => v.id === versionId);
    if (!version) return;

    const pineCode = version.pine_code || '';
    const pythonCode = version.python_code || '';

    if (!pineCode && !pythonCode) {
        showCenteredModal('Aucun code disponible pour cette version', 'info');
        return;
    }

    // Créer modal avec tabs
    const existing = document.getElementById('code-viewer-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'code-viewer-modal';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    const hasBothCodes = pineCode && pythonCode;
    const defaultTab = pineCode ? 'pine' : 'python';

    overlay.innerHTML = `
        <div style="
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            max-width: 900px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="color: #f1f5f9; margin: 0; font-size: 18px;">
                    Code - Version v${version.version || '?'}
                </h3>
                <button id="code-viewer-close" style="
                    background: transparent; border: none; color: #94a3b8;
                    font-size: 24px; cursor: pointer; padding: 4px 8px;
                ">&times;</button>
            </div>

            ${hasBothCodes ? `
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="tab-pine" class="code-tab active" style="
                    padding: 8px 16px; border-radius: 8px; border: none;
                    background: #0ea5e9; color: white; cursor: pointer;
                    font-weight: 500; transition: all 0.2s;
                ">Pine Script</button>
                <button id="tab-python" class="code-tab" style="
                    padding: 8px 16px; border-radius: 8px; border: none;
                    background: rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer;
                    font-weight: 500; transition: all 0.2s;
                ">Python</button>
            </div>
            ` : ''}

            <div style="flex: 1; overflow: auto; margin-bottom: 16px;">
                <pre id="code-display" style="
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 16px;
                    margin: 0;
                    overflow: auto;
                    font-family: 'Fira Code', 'Monaco', monospace;
                    font-size: 13px;
                    line-height: 1.5;
                    color: #e2e8f0;
                    white-space: pre-wrap;
                    word-break: break-word;
                "><code id="code-content"></code></pre>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button id="code-copy-btn" style="
                    padding: 10px 20px; border-radius: 8px; border: none;
                    background: linear-gradient(135deg, #0ea5e9, #06b6d4);
                    color: white; cursor: pointer; font-weight: 500;
                    display: flex; align-items: center; gap: 8px;
                    transition: transform 0.2s;
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copier
                </button>
                <button id="code-close-btn" style="
                    padding: 10px 20px; border-radius: 8px; border: none;
                    background: rgba(255,255,255,0.1); color: #e2e8f0;
                    cursor: pointer; font-weight: 500; transition: all 0.2s;
                ">Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let currentTab = defaultTab;
    const codeContent = document.getElementById('code-content');
    const tabPine = document.getElementById('tab-pine');
    const tabPython = document.getElementById('tab-python');

    function updateCodeDisplay() {
        const code = currentTab === 'pine' ? pineCode : pythonCode;
        codeContent.textContent = code || 'Aucun code disponible';
    }

    function updateTabStyles() {
        if (!hasBothCodes) return;
        if (currentTab === 'pine') {
            tabPine.style.background = '#0ea5e9';
            tabPine.style.color = 'white';
            tabPython.style.background = 'rgba(255,255,255,0.1)';
            tabPython.style.color = '#94a3b8';
        } else {
            tabPython.style.background = '#10b981';
            tabPython.style.color = 'white';
            tabPine.style.background = 'rgba(255,255,255,0.1)';
            tabPine.style.color = '#94a3b8';
        }
    }

    updateCodeDisplay();

    if (hasBothCodes) {
        tabPine.addEventListener('click', () => {
            currentTab = 'pine';
            updateTabStyles();
            updateCodeDisplay();
        });
        tabPython.addEventListener('click', () => {
            currentTab = 'python';
            updateTabStyles();
            updateCodeDisplay();
        });
    }

    document.getElementById('code-copy-btn').addEventListener('click', async () => {
        const code = currentTab === 'pine' ? pineCode : pythonCode;
        try {
            await navigator.clipboard.writeText(code);
            const btn = document.getElementById('code-copy-btn');
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copié !
            `;
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            setTimeout(() => {
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copier
                `;
                btn.style.background = 'linear-gradient(135deg, #0ea5e9, #06b6d4)';
            }, 2000);
        } catch (err) {
            showCenteredModal('Erreur lors de la copie', 'error');
        }
    });

    const closeModal = () => overlay.remove();
    document.getElementById('code-viewer-close').addEventListener('click', closeModal);
    document.getElementById('code-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

// Fonctions Rename
function forgeShowRenameModal() {
    // NE PAS recharger depuis la DB - la liste locale est à jour
    
    document.getElementById('forge-rename-modal').classList.remove('hidden');
    document.getElementById('forge-rename-name').value = forgeState.currentProject?.name || '';
    document.getElementById('forge-rename-author').value = forgeState.currentProject?.author || '';
    document.getElementById('forge-rename-desc').value = forgeState.currentProject?.description || '';
    // Reset état validation
    forgeRenameValidState = true;
    document.getElementById('forge-rename-error').classList.add('hidden');
    document.getElementById('forge-rename-btn').disabled = false;
    document.getElementById('forge-rename-btn').style.opacity = '1';
    document.getElementById('forge-rename-name').style.borderColor = 'rgba(255,255,255,0.1)';
}

function forgeCloseRenameModal() {
    document.getElementById('forge-rename-modal').classList.add('hidden');
    // Reset erreur
    document.getElementById('forge-rename-error').classList.add('hidden');
}

// État de validation pour le renommage
let forgeRenameValidState = true;

function forgeValidateRenameName(name) {
    const trimmedName = name.trim();
    const errorDiv = document.getElementById('forge-rename-error');
    const errorText = document.getElementById('forge-rename-error-text');
    const renameBtn = document.getElementById('forge-rename-btn');
    const inputField = document.getElementById('forge-rename-name');
    const currentName = forgeState.currentProject?.name || '';
    
    if (!trimmedName) {
        errorDiv.classList.add('hidden');
        inputField.style.borderColor = 'rgba(255,255,255,0.1)';
        forgeRenameValidState = true;
        renameBtn.disabled = false;
        renameBtn.style.opacity = '1';
        return;
    }
    
    // Si c'est le même nom que le projet actuel, c'est OK
    if (trimmedName.toLowerCase() === currentName.toLowerCase()) {
        errorDiv.classList.add('hidden');
        inputField.style.borderColor = 'rgba(255,255,255,0.1)';
        forgeRenameValidState = true;
        renameBtn.disabled = false;
        renameBtn.style.opacity = '1';
        return;
    }
    
    // Vérifier si le nom existe déjà dans un autre projet
    const existingProject = forgeState.projects.find(p => 
        p.name.toLowerCase() === trimmedName.toLowerCase() && 
        p.id !== forgeState.currentProjectId
    );
    
    if (existingProject) {
        // Nom déjà pris
        errorDiv.classList.remove('hidden');
        errorText.textContent = 'Ce nom est déjà utilisé par un autre projet';
        inputField.style.borderColor = '#ef4444';
        renameBtn.disabled = true;
        renameBtn.style.opacity = '0.5';
        forgeRenameValidState = false;
    } else {
        // Nom valide
        errorDiv.classList.add('hidden');
        inputField.style.borderColor = 'rgba(255,255,255,0.1)';
        renameBtn.disabled = false;
        renameBtn.style.opacity = '1';
        forgeRenameValidState = true;
    }
}

async function forgeRenameProject() {
    const name = document.getElementById('forge-rename-name').value.trim();
    const author = document.getElementById('forge-rename-author').value.trim();
    const description = document.getElementById('forge-rename-desc').value.trim();
    
    if (!name) {
        showCenteredModal('Le nom est requis', 'error');
        return;
    }
    
    // Vérifier la validation
    if (!forgeRenameValidState) {
        return;
    }
    
    // IMMÉDIATEMENT: Mettre à jour le state et fermer la modale
    const oldProject = { ...forgeState.currentProject };
    forgeState.currentProject.name = name;
    forgeState.currentProject.author = author || null;
    forgeState.currentProject.description = description;
    
    // Mettre à jour aussi dans la liste des projets
    const projectIndex = forgeState.projects.findIndex(p => p.id === forgeState.currentProjectId);
    if (projectIndex !== -1) {
        forgeState.projects[projectIndex].name = name;
        forgeState.projects[projectIndex].author = author || null;
        forgeState.projects[projectIndex].description = description;
    }
    
    forgeCloseRenameModal();
    renderSection();
    showCenteredModal('Projet modifié', 'success');
    
    // Appel API en arrière-plan
    try {
        const response = await fetch(`${API_BASE}/api/forge/projects/${forgeState.currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, author: author || null, description })
        });
        const data = await response.json();
        
        if (!data.success) {
            // Rollback si erreur
            forgeState.currentProject = oldProject;
            if (projectIndex !== -1) {
                forgeState.projects[projectIndex] = oldProject;
            }
            renderSection();
            showCenteredModal(data.error || 'Erreur', 'error');
        }
    } catch (error) {
        console.error('[Forge] Error renaming project:', error);
        showCenteredModal('Erreur de modification', 'error');
    }
}

// Fonctions de suppression de projet
let projectToDelete = null;

function forgeConfirmDeleteProject(projectId, projectName) {
    projectToDelete = { id: projectId, name: projectName };
    document.getElementById('forge-delete-modal').classList.remove('hidden');
    document.getElementById('forge-delete-project-name').textContent = projectName;
}

function forgeCloseDeleteModal() {
    document.getElementById('forge-delete-modal').classList.add('hidden');
    projectToDelete = null;
}

async function forgeDeleteProject() {
    if (!projectToDelete) return;
    
    const projectId = projectToDelete.id;
    
    // Fermer la modal
    forgeCloseDeleteModal();
    showCenteredModal('Suppression en cours...', 'info');
    
    // Appeler l'API et ATTENDRE la confirmation
    try {
        const response = await fetch(`${API_BASE}/api/forge/projects/${projectId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showCenteredModal('Projet supprimé', 'success');
            // FORCER rechargement complet depuis l'API
            await forgeLoadProjects();
            // Aussi vider le cache library pour éviter données stale
            libraryData.items = [];
            libraryData.total = 0;
        } else {
            console.error('[Forge] Delete failed:', data.error);
            showCenteredModal('Erreur de suppression', 'error');
        }
    } catch (error) {
        console.error('[Forge] Error deleting project:', error);
        showCenteredModal('Erreur de suppression', 'error');
    }
}

// Fonctions Backtest depuis le chat
function forgeStartBacktestFromChat(msgId) {
    const msg = forgeState.messages.find(m => m.id === msgId);
    if (!msg) return;
    
    let metadata = {};
    try {
        metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});
    } catch(e) {}
    
    if (!metadata.python_code) {
        showCenteredModal('Code Python non disponible', 'error');
        return;
    }
    
    // Charger le code dans forgeState pour le backtest
    forgeState.pineCode = metadata.pine_code || '';
    forgeState.pythonCode = metadata.python_code || '';
    forgeState.strategyType = 'strategy';
    
    // Afficher la modal de backtest
    forgeState.showChatBacktest = true;
    forgeState.chatBacktestMsgId = msgId;
    renderSection();
    
    // Scroll vers la zone de backtest si elle existe
    setTimeout(() => {
        const backtestEl = document.getElementById('forge-chat-backtest-zone');
        if (backtestEl) backtestEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

async function forgeRunChatBacktest() {
    if (!forgeState.pythonCode) {
        showCenteredModal('Code Python requis', 'error');
        return;
    }
    
    forgeState.isSimulating = true;
    renderSection();
    
    const assets = forgeState.selectedAssets.split(',').map(a => a.trim()).filter(a => a);
    const timeframe = forgeState.selectedTimeframe || '1h';
    const period = forgeState.selectedPeriod || '3M';
    
    try {
        const response = await fetch(`${API_BASE}/api/lab/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                python_code: forgeState.pythonCode,
                assets: assets,
                timeframe: timeframe,
                period: period
            })
        });
        const data = await response.json();
        
        if (data.success) {
            forgeState.chatBacktestResults = data.results;
            showCenteredModal('Backtest terminé', 'success');
        } else {
            showCenteredModal(data.error || 'Erreur de backtest', 'error');
        }
    } catch (error) {
        console.error('[Forge] Backtest error:', error);
        showCenteredModal('Erreur de backtest', 'error');
    }
    
    forgeState.isSimulating = false;
    renderSection();
}

function forgeCancelChatBacktest() {
    forgeState.showChatBacktest = false;
    forgeState.chatBacktestMsgId = null;
    forgeState.chatBacktestResults = null;
    renderSection();
}

// ============================================
// SYSTÃˆME DE CONVERSION INTELLIGENT
// ============================================

// A1: Détection automatique du type de contenu
function detectContentType(content) {
    if (!content || content.length < 20) return null;
    
    // Patterns Pine Script (prioritaire car plus spécifique)
    const pinePatterns = [
        /@version/i,
        /\bstrategy\s*\(/i,
        /\bindicator\s*\(/i,
        /\bta\.(rsi|sma|ema|macd|bb|atr|stoch|crossover|crossunder)\b/i,
        /\binput\.(int|float|bool|string|source)\s*\(/i,
        /\bstrategy\.(entry|close|exit|long|short)\b/i,
        /\bplot(shape|char|arrow|candle)?\s*\(/i,
        /\bhline\s*\(/i
    ];
    
    for (const pattern of pinePatterns) {
        if (pattern.test(content)) return 'pine';
    }
    
    // Patterns Python
    const pythonPatterns = [
        /^import\s+\w+/m,
        /^from\s+\w+\s+import/m,
        /^class\s+\w+.*:/m,
        /\bdef\s+\w+\s*\(/,
        /\bself\.\w+/,
        /\.ewm\(|\.rolling\(|\.shift\(/,
        /pandas|numpy|pd\.|np\./i
    ];
    
    for (const pattern of pythonPatterns) {
        if (pattern.test(content)) return 'python';
    }
    
    // Sinon c'est du langage naturel
    return 'natural';
}

// B3: Parser Pine Script â†’ Structure JSON
function parsePineScript(code) {
    const structure = {
        name: '',
        type: 'strategy',
        indicators: [],
        params: [],
        conditions: { long: [], exit: [] },
        orders: [],
        riskManagement: {}
    };
    
    // Extraire nom et type
    const strategyMatch = code.match(/strategy\s*\(\s*["']([^"']+)["']/i);
    const indicatorMatch = code.match(/indicator\s*\(\s*["']([^"']+)["']/i);
    
    if (strategyMatch) {
        structure.name = strategyMatch[1];
        structure.type = 'strategy';
    } else if (indicatorMatch) {
        structure.name = indicatorMatch[1];
        structure.type = 'indicator';
    }
    
    // Extraire les paramètres input
    const inputPatterns = [
        { regex: /(\w+)\s*=\s*input\.int\s*\(\s*([^,]+),\s*["']([^"']+)["'](?:[^)]*minval\s*=\s*(\d+))?(?:[^)]*maxval\s*=\s*(\d+))?/gi, type: 'int' },
        { regex: /(\w+)\s*=\s*input\.float\s*\(\s*([^,]+),\s*["']([^"']+)["']/gi, type: 'float' },
        { regex: /(\w+)\s*=\s*input\.bool\s*\(\s*([^,]+),\s*["']([^"']+)["']/gi, type: 'bool' }
    ];
    
    for (const { regex, type } of inputPatterns) {
        let match;
        const regexCopy = new RegExp(regex.source, regex.flags);
        while ((match = regexCopy.exec(code)) !== null) {
            structure.params.push({
                variable: match[1],
                type: type,
                default: match[2].trim(),
                label: match[3],
                minval: match[4] || null,
                maxval: match[5] || null
            });
        }
    }
    
    // Détecter les indicateurs
    const indicatorPatterns = [
        { regex: /(\w+)\s*=\s*ta\.rsi\s*\(\s*(\w+),\s*(\w+)\)/gi, type: 'RSI' },
        { regex: /(\w+)\s*=\s*ta\.sma\s*\(\s*(\w+),\s*(\w+)\)/gi, type: 'SMA' },
        { regex: /(\w+)\s*=\s*ta\.ema\s*\(\s*(\w+),\s*(\w+)\)/gi, type: 'EMA' },
        { regex: /(\w+)\s*=\s*ta\.atr\s*\(\s*(\w+)\)/gi, type: 'ATR' },
        { regex: /\[(\w+),\s*(\w+),\s*(\w+)\]\s*=\s*ta\.macd\s*\(\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+)\)/gi, type: 'MACD' },
        { regex: /\[(\w+),\s*(\w+),\s*(\w+)\]\s*=\s*ta\.bb\s*\(\s*(\w+),\s*(\w+),\s*(\w+)\)/gi, type: 'BB' },
        { regex: /(\w+)\s*=\s*ta\.stoch\s*\(\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+)\)/gi, type: 'STOCH' }
    ];
    
    for (const { regex, type } of indicatorPatterns) {
        let match;
        const regexCopy = new RegExp(regex.source, regex.flags);
        while ((match = regexCopy.exec(code)) !== null) {
            if (type === 'RSI' || type === 'SMA' || type === 'EMA') {
                structure.indicators.push({
                    type: type,
                    variable: match[1],
                    source: match[2],
                    period: match[3]
                });
            } else if (type === 'ATR') {
                structure.indicators.push({
                    type: type,
                    variable: match[1],
                    period: match[2]
                });
            } else if (type === 'MACD') {
                structure.indicators.push({
                    type: type,
                    variables: { macd: match[1], signal: match[2], hist: match[3] },
                    source: match[4],
                    fastPeriod: match[5],
                    slowPeriod: match[6],
                    signalPeriod: match[7]
                });
            } else if (type === 'BB') {
                structure.indicators.push({
                    type: type,
                    variables: { middle: match[1], upper: match[2], lower: match[3] },
                    source: match[4],
                    period: match[5],
                    mult: match[6]
                });
            }
        }
    }
    
    // Détecter les conditions crossover/crossunder
    const crossoverRegex = /(\w+)\s*=\s*ta\.crossover\s*\(\s*(\w+),\s*(\w+)\)/gi;
    let match;
    while ((match = crossoverRegex.exec(code)) !== null) {
        structure.conditions.long.push({
            variable: match[1],
            type: 'crossover',
            source1: match[2],
            source2: match[3]
        });
    }
    
    const crossunderRegex = /(\w+)\s*=\s*ta\.crossunder\s*\(\s*(\w+),\s*(\w+)\)/gi;
    while ((match = crossunderRegex.exec(code)) !== null) {
        structure.conditions.exit.push({
            variable: match[1],
            type: 'crossunder',
            source1: match[2],
            source2: match[3]
        });
    }
    
    // Détecter comparaisons simples dans les conditions
    const comparisonRegex = /(\w+)\s*=\s*(\w+)\s*([<>]=?)\s*(\w+)/gi;
    while ((match = comparisonRegex.exec(code)) !== null) {
        const condition = {
            variable: match[1],
            type: 'comparison',
            source1: match[2],
            operator: match[3],
            source2: match[4]
        };
        // Heuristique: si contient "long" c'est une entrée, sinon sortie
        if (/long|buy|entry/i.test(match[1])) {
            structure.conditions.long.push(condition);
        } else if (/exit|close|short|sell/i.test(match[1])) {
            structure.conditions.exit.push(condition);
        }
    }
    
    // Détecter les ordres
    if (/strategy\.entry\s*\(\s*["'](\w+)["']\s*,\s*strategy\.long/i.test(code)) {
        structure.orders.push({ type: 'entry', direction: 'long' });
    }
    if (/strategy\.entry\s*\(\s*["'](\w+)["']\s*,\s*strategy\.short/i.test(code)) {
        structure.orders.push({ type: 'entry', direction: 'short' });
    }
    if (/strategy\.close\s*\(/i.test(code)) {
        structure.orders.push({ type: 'close' });
    }
    
    // Détecter stop loss / take profit
    const exitMatch = code.match(/strategy\.exit\s*\([^)]*loss\s*=\s*(\d+)/i);
    if (exitMatch) structure.riskManagement.stopLoss = parseInt(exitMatch[1]);
    
    const profitMatch = code.match(/strategy\.exit\s*\([^)]*profit\s*=\s*(\d+)/i);
    if (profitMatch) structure.riskManagement.takeProfit = parseInt(profitMatch[1]);
    
    return structure;
}

// B4: Générateur Structure â†’ Description Naturelle
function generateNaturalFromStructure(structure) {
    let desc = '';
    
    // Titre
    if (structure.name) {
        desc += `${structure.type === 'strategy' ? 'Stratégie' : 'Indicateur'} "${structure.name}"\n\n`;
    }
    
    // Section INDICATEURS
    if (structure.indicators.length > 0) {
        desc += `INDICATEURS:\n`;
        for (const ind of structure.indicators) {
            switch (ind.type) {
                case 'RSI':
                    const rsiPeriod = getParamValue(structure.params, ind.period) || ind.period;
                    desc += `â€¢ RSI (Relative Strength Index) sur ${rsiPeriod} périodes\n`;
                    break;
                case 'SMA':
                    const smaPeriod = getParamValue(structure.params, ind.period) || ind.period;
                    desc += `â€¢ Moyenne mobile simple (SMA) sur ${smaPeriod} périodes\n`;
                    break;
                case 'EMA':
                    const emaPeriod = getParamValue(structure.params, ind.period) || ind.period;
                    desc += `â€¢ Moyenne mobile exponentielle (EMA) sur ${emaPeriod} périodes\n`;
                    break;
                case 'MACD':
                    desc += `â€¢ MACD (${ind.fastPeriod}, ${ind.slowPeriod}, ${ind.signalPeriod})\n`;
                    break;
                case 'BB':
                    desc += `â€¢ Bandes de Bollinger (${ind.period} périodes, ${ind.mult} écarts-types)\n`;
                    break;
                case 'ATR':
                    desc += `â€¢ ATR (Average True Range) sur ${ind.period} périodes\n`;
                    break;
                case 'STOCH':
                    desc += `â€¢ Stochastique\n`;
                    break;
            }
        }
        desc += `\n`;
    }
    
    // Section CONDITIONS D'ENTRÉE
    if (structure.conditions.long.length > 0) {
        desc += `CONDITIONS D'ENTRÉE (LONG):\n`;
        for (const cond of structure.conditions.long) {
            if (cond.type === 'crossover') {
                const src1 = translateSource(cond.source1, structure);
                const src2 = translateSource(cond.source2, structure);
                desc += `â€¢ Quand ${src1} croise au-dessus de ${src2}\n`;
            } else if (cond.type === 'comparison') {
                const src1 = translateSource(cond.source1, structure);
                const src2 = translateSource(cond.source2, structure);
                const op = cond.operator === '>' ? 'supérieur à' : 
                           cond.operator === '<' ? 'inférieur à' :
                           cond.operator === '>=' ? 'supérieur ou égal à' : 'inférieur ou égal à';
                desc += `â€¢ Quand ${src1} est ${op} ${src2}\n`;
            }
        }
        desc += `\n`;
    }
    
    // Section CONDITIONS DE SORTIE
    if (structure.conditions.exit.length > 0) {
        desc += `CONDITIONS DE SORTIE:\n`;
        for (const cond of structure.conditions.exit) {
            if (cond.type === 'crossunder') {
                const src1 = translateSource(cond.source1, structure);
                const src2 = translateSource(cond.source2, structure);
                desc += `â€¢ Quand ${src1} croise en-dessous de ${src2}\n`;
            } else if (cond.type === 'comparison') {
                const src1 = translateSource(cond.source1, structure);
                const src2 = translateSource(cond.source2, structure);
                const op = cond.operator === '>' ? 'supérieur à' : 
                           cond.operator === '<' ? 'inférieur à' :
                           cond.operator === '>=' ? 'supérieur ou égal à' : 'inférieur ou égal à';
                desc += `â€¢ Quand ${src1} est ${op} ${src2}\n`;
            }
        }
        desc += `\n`;
    }
    
    // Section PARAMÃˆTRES
    if (structure.params.length > 0) {
        desc += `PARAMÃˆTRES CONFIGURABLES:\n`;
        for (const param of structure.params) {
            let paramDesc = `â€¢ ${param.label}: ${param.default}`;
            if (param.minval || param.maxval) {
                paramDesc += ` (${param.minval ? 'min: ' + param.minval : ''}${param.minval && param.maxval ? ', ' : ''}${param.maxval ? 'max: ' + param.maxval : ''})`;
            }
            desc += paramDesc + `\n`;
        }
        desc += `\n`;
    }
    
    // Section GESTION DU RISQUE
    if (structure.riskManagement.stopLoss || structure.riskManagement.takeProfit) {
        desc += `GESTION DU RISQUE:\n`;
        if (structure.riskManagement.stopLoss) {
            desc += `â€¢ Stop Loss: ${structure.riskManagement.stopLoss}%\n`;
        }
        if (structure.riskManagement.takeProfit) {
            desc += `â€¢ Take Profit: ${structure.riskManagement.takeProfit}%\n`;
        }
    }
    
    return desc.trim() || 'Stratégie importée. Analyse détaillée non disponible.';
}

// Helper: récupérer la valeur d'un paramètre
function getParamValue(params, varName) {
    const param = params.find(p => p.variable === varName);
    return param ? param.default : null;
}

// Helper: traduire une source en français
function translateSource(source, structure) {
    // Si c'est un nombre
    if (!isNaN(source)) {
        // Chercher si c'est un seuil connu
        const param = structure.params.find(p => p.variable === source);
        if (param) {
            if (/oversold|survente/i.test(param.label)) return `le niveau de survente (${param.default})`;
            if (/overbought|surachat/i.test(param.label)) return `le niveau de surachat (${param.default})`;
            return `${param.label} (${param.default})`;
        }
        return source;
    }
    
    // Si c'est une variable d'indicateur
    const indicator = structure.indicators.find(i => i.variable === source);
    if (indicator) {
        switch (indicator.type) {
            case 'RSI': return 'le RSI';
            case 'SMA': return `la SMA ${indicator.period}`;
            case 'EMA': return `l'EMA ${indicator.period}`;
            case 'ATR': return `l'ATR`;
        }
    }
    
    // Si c'est un paramètre
    const param = structure.params.find(p => p.variable === source);
    if (param) {
        if (/oversold|survente/i.test(param.label) || /oversold|survente/i.test(param.variable)) {
            return `le niveau de survente (${param.default})`;
        }
        if (/overbought|surachat/i.test(param.label) || /overbought|surachat/i.test(param.variable)) {
            return `le niveau de surachat (${param.default})`;
        }
        return `${param.label}`;
    }
    
    // Sources par défaut
    if (source === 'close') return 'le prix de clôture';
    if (source === 'open') return 'le prix d\'ouverture';
    if (source === 'high') return 'le plus haut';
    if (source === 'low') return 'le plus bas';
    
    return source;
}

// B1: Parser Langage Naturel â†’ Structure JSON
function parseNaturalLanguage(text) {
    const structure = {
        name: '',
        type: 'strategy',
        indicators: [],
        params: [],
        conditions: { long: [], exit: [] },
        orders: [],
        riskManagement: {}
    };
    
    const textLower = text.toLowerCase();
    
    // Extraire le nom (première ligne ou après "stratégie")
    const nameMatch = text.match(/^([^\n.]+)|stratégie\s+["']?([^"'\n.]+)/i);
    if (nameMatch) {
        structure.name = (nameMatch[1] || nameMatch[2] || '').trim().substring(0, 50);
    }
    
    // Détecter RSI
    if (/\b(rsi|force\s+relative|survente|surachat)\b/i.test(textLower)) {
        // Extraire la période
        const periodMatch = text.match(/rsi\s*(\d+)|rsi\s+(?:sur\s+)?(\d+)\s*(?:périodes?|barres?|bougies?)/i);
        const period = periodMatch ? (periodMatch[1] || periodMatch[2] || '14') : '14';
        
        structure.indicators.push({ type: 'RSI', variable: 'rsi', source: 'close', period: period });
        structure.params.push({ variable: 'rsiLength', type: 'int', default: period, label: 'Période RSI' });
        
        // Détecter seuil survente
        const oversoldMatch = text.match(/(?:survente|oversold|sous|inférieur\s+à|<)\s*(?:à\s+)?(\d+)/i);
        if (oversoldMatch) {
            const oversold = oversoldMatch[1];
            structure.params.push({ variable: 'oversold', type: 'int', default: oversold, label: 'Survente', minval: '0', maxval: '50' });
            structure.conditions.long.push({ type: 'crossover', source1: 'rsi', source2: 'oversold' });
        }
        
        // Détecter seuil surachat
        const overboughtMatch = text.match(/(?:surachat|overbought|dessus|supérieur\s+à|>)\s*(?:à\s+)?(\d+)/i);
        if (overboughtMatch) {
            const overbought = overboughtMatch[1];
            structure.params.push({ variable: 'overbought', type: 'int', default: overbought, label: 'Surachat', minval: '50', maxval: '100' });
            structure.conditions.exit.push({ type: 'crossunder', source1: 'rsi', source2: 'overbought' });
        }
        
        // Si pas de seuils explicites, utiliser les défauts
        if (!oversoldMatch && /survente|acheter|long|entrer/i.test(textLower)) {
            structure.params.push({ variable: 'oversold', type: 'int', default: '30', label: 'Survente', minval: '0', maxval: '50' });
            structure.conditions.long.push({ type: 'crossover', source1: 'rsi', source2: 'oversold' });
        }
        if (!overboughtMatch && /surachat|vendre|sortir|fermer/i.test(textLower)) {
            structure.params.push({ variable: 'overbought', type: 'int', default: '70', label: 'Surachat', minval: '50', maxval: '100' });
            structure.conditions.exit.push({ type: 'crossunder', source1: 'rsi', source2: 'overbought' });
        }
    }
    
    // Détecter SMA
    if (/\b(sma|moyenne\s+mobile\s+simple|ma\s+simple)\b/i.test(textLower)) {
        const smaMatches = text.matchAll(/(?:sma|moyenne\s+mobile(?:\s+simple)?)\s*(\d+)/gi);
        let smaCount = 0;
        for (const match of smaMatches) {
            const period = match[1];
            const varName = smaCount === 0 ? 'smaFast' : 'smaSlow';
            const label = smaCount === 0 ? 'SMA Rapide' : 'SMA Lente';
            structure.indicators.push({ type: 'SMA', variable: varName, source: 'close', period: period });
            structure.params.push({ variable: varName + 'Length', type: 'int', default: period, label: label });
            smaCount++;
        }
        
        // Si 2 SMA, ajouter condition de croisement
        if (smaCount >= 2) {
            structure.conditions.long.push({ type: 'crossover', source1: 'smaFast', source2: 'smaSlow' });
            structure.conditions.exit.push({ type: 'crossunder', source1: 'smaFast', source2: 'smaSlow' });
        }
    }
    
    // Détecter EMA
    if (/\b(ema|moyenne\s+(?:mobile\s+)?exponentielle)\b/i.test(textLower)) {
        const emaMatches = text.matchAll(/(?:ema|moyenne\s+(?:mobile\s+)?exponentielle)\s*(\d+)/gi);
        let emaCount = 0;
        for (const match of emaMatches) {
            const period = match[1];
            const varName = emaCount === 0 ? 'emaFast' : 'emaSlow';
            const label = emaCount === 0 ? 'EMA Rapide' : 'EMA Lente';
            structure.indicators.push({ type: 'EMA', variable: varName, source: 'close', period: period });
            structure.params.push({ variable: varName + 'Length', type: 'int', default: period, label: label });
            emaCount++;
        }
        
        if (emaCount >= 2) {
            structure.conditions.long.push({ type: 'crossover', source1: 'emaFast', source2: 'emaSlow' });
            structure.conditions.exit.push({ type: 'crossunder', source1: 'emaFast', source2: 'emaSlow' });
        }
    }
    
    // Détecter MACD
    if (/\b(macd|convergence\s+divergence)\b/i.test(textLower)) {
        structure.indicators.push({
            type: 'MACD',
            variables: { macd: 'macdLine', signal: 'signalLine', hist: 'histLine' },
            source: 'close',
            fastPeriod: '12',
            slowPeriod: '26',
            signalPeriod: '9'
        });
        structure.params.push({ variable: 'macdFast', type: 'int', default: '12', label: 'MACD Rapide' });
        structure.params.push({ variable: 'macdSlow', type: 'int', default: '26', label: 'MACD Lent' });
        structure.params.push({ variable: 'macdSignal', type: 'int', default: '9', label: 'MACD Signal' });
        
        structure.conditions.long.push({ type: 'crossover', source1: 'macdLine', source2: 'signalLine' });
        structure.conditions.exit.push({ type: 'crossunder', source1: 'macdLine', source2: 'signalLine' });
    }
    
    // Détecter Bollinger
    if (/\b(bollinger|bandes?\s+de\s+bollinger|écart[s-]?type)\b/i.test(textLower)) {
        const periodMatch = text.match(/bollinger\s*(\d+)|(\d+)\s*périodes?/i);
        const period = periodMatch ? (periodMatch[1] || periodMatch[2] || '20') : '20';
        const multMatch = text.match(/(\d+(?:\.\d+)?)\s*écart/i);
        const mult = multMatch ? multMatch[1] : '2';
        
        structure.indicators.push({
            type: 'BB',
            variables: { middle: 'bbMiddle', upper: 'bbUpper', lower: 'bbLower' },
            source: 'close',
            period: period,
            mult: mult
        });
        structure.params.push({ variable: 'bbLength', type: 'int', default: period, label: 'Période Bollinger' });
        structure.params.push({ variable: 'bbMult', type: 'float', default: mult, label: 'Multiplicateur' });
    }
    
    // Détecter Stop Loss
    const slMatch = text.match(/stop\s*loss\s*(?:à\s*)?(\d+(?:\.\d+)?)\s*%?/i);
    if (slMatch) {
        structure.riskManagement.stopLoss = parseFloat(slMatch[1]);
    }
    
    // Détecter Take Profit
    const tpMatch = text.match(/take\s*profit\s*(?:à\s*)?(\d+(?:\.\d+)?)\s*%?|objectif\s*(?:à\s*)?(\d+(?:\.\d+)?)\s*%?/i);
    if (tpMatch) {
        structure.riskManagement.takeProfit = parseFloat(tpMatch[1] || tpMatch[2]);
    }
    
    // Ajouter les ordres par défaut si des conditions existent
    if (structure.conditions.long.length > 0) {
        structure.orders.push({ type: 'entry', direction: 'long' });
    }
    if (structure.conditions.exit.length > 0) {
        structure.orders.push({ type: 'close' });
    }
    
    return structure;
}

// B2: Générateur Structure â†’ Code Pine Script
function generatePineFromStructure(structure) {
    let pine = `//@version=6\n`;
    pine += `strategy("${structure.name || 'Ma Stratégie'}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)\n\n`;
    
    // Paramètres
    pine += `// === PARAMÃˆTRES ===\n`;
    for (const param of structure.params) {
        if (param.type === 'int') {
            pine += `${param.variable} = input.int(${param.default}, "${param.label}"`;
            if (param.minval) pine += `, minval=${param.minval}`;
            if (param.maxval) pine += `, maxval=${param.maxval}`;
            pine += `)\n`;
        } else if (param.type === 'float') {
            pine += `${param.variable} = input.float(${param.default}, "${param.label}")\n`;
        } else if (param.type === 'bool') {
            pine += `${param.variable} = input.bool(${param.default}, "${param.label}")\n`;
        }
    }
    pine += `\n`;
    
    // Indicateurs
    pine += `// === INDICATEURS ===\n`;
    for (const ind of structure.indicators) {
        switch (ind.type) {
            case 'RSI':
                const rsiPeriod = structure.params.find(p => p.variable === 'rsiLength') ? 'rsiLength' : ind.period;
                pine += `${ind.variable} = ta.rsi(${ind.source}, ${rsiPeriod})\n`;
                break;
            case 'SMA':
                const smaPeriod = structure.params.find(p => p.variable === ind.variable + 'Length') ? ind.variable + 'Length' : ind.period;
                pine += `${ind.variable} = ta.sma(${ind.source}, ${smaPeriod})\n`;
                break;
            case 'EMA':
                const emaPeriod = structure.params.find(p => p.variable === ind.variable + 'Length') ? ind.variable + 'Length' : ind.period;
                pine += `${ind.variable} = ta.ema(${ind.source}, ${emaPeriod})\n`;
                break;
            case 'MACD':
                pine += `[${ind.variables.macd}, ${ind.variables.signal}, ${ind.variables.hist}] = ta.macd(${ind.source}, macdFast, macdSlow, macdSignal)\n`;
                break;
            case 'BB':
                pine += `[${ind.variables.middle}, ${ind.variables.upper}, ${ind.variables.lower}] = ta.bb(${ind.source}, bbLength, bbMult)\n`;
                break;
            case 'ATR':
                pine += `${ind.variable} = ta.atr(${ind.period})\n`;
                break;
        }
    }
    pine += `\n`;
    
    // Conditions
    pine += `// === CONDITIONS ===\n`;
    if (structure.conditions.long.length > 0) {
        const longConditions = structure.conditions.long.map((cond, i) => {
            if (cond.type === 'crossover') {
                return `ta.crossover(${cond.source1}, ${cond.source2})`;
            } else if (cond.type === 'comparison') {
                return `${cond.source1} ${cond.operator} ${cond.source2}`;
            }
            return '';
        }).filter(c => c);
        pine += `longCondition = ${longConditions.join(' and ')}\n`;
    }
    
    if (structure.conditions.exit.length > 0) {
        const exitConditions = structure.conditions.exit.map((cond, i) => {
            if (cond.type === 'crossunder') {
                return `ta.crossunder(${cond.source1}, ${cond.source2})`;
            } else if (cond.type === 'comparison') {
                return `${cond.source1} ${cond.operator} ${cond.source2}`;
            }
            return '';
        }).filter(c => c);
        pine += `exitCondition = ${exitConditions.join(' and ')}\n`;
    }
    pine += `\n`;
    
    // Ordres
    pine += `// === ORDRES ===\n`;
    if (structure.orders.find(o => o.type === 'entry' && o.direction === 'long')) {
        pine += `if longCondition\n    strategy.entry("Long", strategy.long)\n\n`;
    }
    if (structure.orders.find(o => o.type === 'close')) {
        pine += `if exitCondition\n    strategy.close("Long")\n\n`;
    }
    
    // Stop Loss / Take Profit
    if (structure.riskManagement.stopLoss || structure.riskManagement.takeProfit) {
        pine += `// === GESTION DU RISQUE ===\n`;
        let exitParams = [];
        if (structure.riskManagement.stopLoss) {
            exitParams.push(`loss=${structure.riskManagement.stopLoss}`);
        }
        if (structure.riskManagement.takeProfit) {
            exitParams.push(`profit=${structure.riskManagement.takeProfit}`);
        }
        pine += `strategy.exit("Exit", "Long", ${exitParams.join(', ')})\n\n`;
    }
    
    // Visualisation
    pine += `// === VISUALISATION ===\n`;
    for (const ind of structure.indicators) {
        switch (ind.type) {
            case 'RSI':
                pine += `plot(${ind.variable}, "${ind.type}", color.blue)\n`;
                // Ajouter les lignes de seuil
                const oversoldParam = structure.params.find(p => /oversold|survente/i.test(p.variable));
                const overboughtParam = structure.params.find(p => /overbought|surachat/i.test(p.variable));
                if (oversoldParam) pine += `hline(${oversoldParam.variable}, "Survente", color.green)\n`;
                if (overboughtParam) pine += `hline(${overboughtParam.variable}, "Surachat", color.red)\n`;
                break;
            case 'SMA':
            case 'EMA':
                const color = ind.variable.includes('Fast') ? 'color.green' : 'color.red';
                pine += `plot(${ind.variable}, "${ind.type}", ${color})\n`;
                break;
            case 'MACD':
                pine += `plot(${ind.variables.macd}, "MACD", color.blue)\n`;
                pine += `plot(${ind.variables.signal}, "Signal", color.orange)\n`;
                break;
            case 'BB':
                pine += `plot(${ind.variables.middle}, "BB Middle", color.yellow)\n`;
                pine += `plot(${ind.variables.upper}, "BB Upper", color.red)\n`;
                pine += `plot(${ind.variables.lower}, "BB Lower", color.green)\n`;
                break;
        }
    }
    
    return pine;
}

// ============================================
// FIN SYSTÃˆME DE CONVERSION
// ============================================

// Gestion de l'input dans la zone unifiée
let forgeInputDebounceTimer = null;
let forgeAutoGenerateTimer = null;
let forgeIsGenerating = false;

function forgeHandleInput(value) {
    const previousHadContent = forgeState.description || forgeState.pineCode || forgeState.pythonCode;
    
    // A1: Détection automatique du type de contenu
    const detectedType = detectContentType(value);
    
    // A2: Bascule automatique si le type détecté est différent du mode actuel
    if (detectedType && detectedType !== forgeState.inputMode && value.length >= 30) {
        // Basculer vers le type détecté
        forgeState.inputMode = detectedType;
        
        // Stocker le contenu dans le bon slot
        if (detectedType === 'pine') {
            forgeState.pineCode = value;
            // Ne pas effacer les autres - ils seront générés
        } else if (detectedType === 'python') {
            forgeState.pythonCode = value;
        } else {
            forgeState.description = value;
        }
        
        console.log(`[Forge] Auto-détection: ${detectedType} détecté, bascule automatique`);
    } else {
        // Comportement normal: stocker selon le mode actuel
        if (forgeState.inputMode === 'natural') {
            forgeState.description = value;
        } else if (forgeState.inputMode === 'pine') {
            forgeState.pineCode = value;
        } else {
            forgeState.pythonCode = value;
        }
    }
    
    // Masquer l'overlay drop zone si contenu
    const overlay = document.getElementById('forge-dropzone-overlay');
    if (overlay) {
        overlay.style.display = value ? 'none' : 'flex';
    }
    
    const nowHasContent = forgeState.description || forgeState.pineCode || forgeState.pythonCode;
    
    // Debounce: rafraîchir les boutons après 300ms d'inactivité
    clearTimeout(forgeInputDebounceTimer);
    forgeInputDebounceTimer = setTimeout(() => {
        // Sauvegarder le focus et la position du curseur
        const textarea = document.getElementById('forge-input-unified');
        const selectionStart = textarea?.selectionStart;
        const selectionEnd = textarea?.selectionEnd;
        const hadFocus = document.activeElement === textarea;
        
        renderSection();
        
        // Restaurer le focus et la position du curseur
        if (hadFocus) {
            const newTextarea = document.getElementById('forge-input-unified');
            if (newTextarea) {
                newTextarea.focus();
                newTextarea.setSelectionRange(selectionStart, selectionEnd);
            }
        }
    }, 300);
    
    // A3: Routage intelligent de génération
    clearTimeout(forgeAutoGenerateTimer);
    
    // Déterminer quel type de contenu on a réellement
    const actualType = detectedType || forgeState.inputMode;
    
    if (actualType === 'natural' && value.length >= 30) {
        // Naturel â†’ Générer Pine + Python
        forgeUpdateGenerationStatus('waiting');
        forgeAutoGenerateTimer = setTimeout(() => {
            forgeAutoGenerate();
        }, 2000);
    } else if (actualType === 'pine' && value.length >= 50) {
        // Pine â†’ Générer Description + Python (JAMAIS Pine!)
        forgeUpdateGenerationStatus('waiting-desc');
        forgeAutoGenerateTimer = setTimeout(() => {
            forgeAutoGenerateFromPine();
        }, 2000);
    } else if (actualType === 'python' && value.length >= 50) {
        // Python â†’ Générer Description seulement
        forgeUpdateGenerationStatus('waiting-desc');
        forgeAutoGenerateTimer = setTimeout(() => {
            forgeAutoGenerateFromPython();
        }, 2000);
    } else {
        forgeUpdateGenerationStatus('');
    }
}

// Mettre à jour l'indicateur de génération
function forgeUpdateGenerationStatus(status) {
    const indicator = document.getElementById('forge-generation-status');
    if (!indicator) return;
    
    if (status === 'waiting') {
        indicator.innerHTML = '<span class="text-white/30 text-xs">Génération Pine + Python dans 2s...</span>';
        indicator.className = 'mt-2';
    } else if (status === 'waiting-desc') {
        indicator.innerHTML = '<span class="text-white/30 text-xs">Analyse du code dans 2s...</span>';
        indicator.className = 'mt-2';
    } else if (status === 'generating') {
        indicator.innerHTML = '<span class="text-amber-400/70 text-xs flex items-center gap-1"><svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Génération en cours...</span>';
        indicator.className = 'mt-2';
    } else if (status === 'analyzing') {
        indicator.innerHTML = '<span class="text-amber-400/70 text-xs flex items-center gap-1"><svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Analyse en cours...</span>';
        indicator.className = 'mt-2';
    } else if (status === 'ready') {
        indicator.innerHTML = '<span class="text-green-400/70 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Pine + Python prêts</span>';
        indicator.className = 'mt-2';
    } else if (status === 'ready-desc') {
        indicator.innerHTML = '<span class="text-green-400/70 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Description générée</span>';
        indicator.className = 'mt-2';
    } else {
        indicator.innerHTML = '';
        indicator.className = 'hidden';
    }
}

// Génération automatique Pine + Python (depuis Naturel)
function forgeAutoGenerate() {
    if (!forgeState.description || forgeState.description.length < 30) return;
    if (forgeIsGenerating) return;
    
    forgeIsGenerating = true;
    forgeUpdateGenerationStatus('generating');
    
    setTimeout(() => {
        // VRAIE CONVERSION: Naturel â†’ Structure â†’ Pine
        const structure = parseNaturalLanguage(forgeState.description);
        
        // Extraire le nom pour sourceMeta
        if (structure.name) {
            forgeState.sourceMeta = { name: structure.name };
        }
        
        // Générer le vrai code Pine
        forgeState.pineCode = generatePineFromStructure(structure);
        
        // Puis générer Python
        setTimeout(() => {
            forgeConvertToPythonAuto();
            forgeIsGenerating = false;
            forgeUpdateGenerationStatus('ready');
            renderSection();
        }, 200);
    }, 300);
}

// Génération automatique depuis Pine (Description + Python)
function forgeAutoGenerateFromPine() {
    if (!forgeState.pineCode || forgeState.pineCode.length < 50) return;
    if (forgeIsGenerating) return;
    
    forgeIsGenerating = true;
    forgeUpdateGenerationStatus('analyzing');
    
    setTimeout(() => {
        // VRAIE CONVERSION: Pine â†’ Structure â†’ Description
        const structure = parsePineScript(forgeState.pineCode);
        
        // Extraire le nom pour sourceMeta
        if (structure.name) {
            forgeState.sourceMeta = { name: structure.name };
        }
        
        // Générer la vraie description
        forgeState.description = generateNaturalFromStructure(structure);
        
        // Générer aussi le Python si pas déjà présent
        if (!forgeState.pythonCode) {
            forgeConvertToPythonAuto();
        }
        
        forgeIsGenerating = false;
        forgeUpdateGenerationStatus('ready-desc');
        renderSection();
    }, 500);
}

// Génération automatique depuis Python (Description seulement)
function forgeAutoGenerateFromPython() {
    if (!forgeState.pythonCode || forgeState.pythonCode.length < 50) return;
    if (forgeIsGenerating) return;
    
    forgeIsGenerating = true;
    forgeUpdateGenerationStatus('analyzing');
    
    setTimeout(() => {
        // Analyse basique du Python pour générer une description
        let description = '';
        
        // Extraire le nom de la classe
        const classMatch = forgeState.pythonCode.match(/class\s+(\w+)/);
        if (classMatch) {
            description += `Stratégie "${classMatch[1]}"\n\n`;
            forgeState.sourceMeta = { name: classMatch[1] };
        }
        
        // Détecter les indicateurs dans le code Python
        const indicators = [];
        if (/\.rsi\(|rsi\s*=/i.test(forgeState.pythonCode)) indicators.push('RSI');
        if (/\.rolling\(.*\)\.mean\(\)|sma/i.test(forgeState.pythonCode)) indicators.push('SMA');
        if (/\.ewm\(|ema/i.test(forgeState.pythonCode)) indicators.push('EMA');
        if (/macd/i.test(forgeState.pythonCode)) indicators.push('MACD');
        if (/bollinger/i.test(forgeState.pythonCode)) indicators.push('Bandes de Bollinger');
        
        if (indicators.length > 0) {
            description += `INDICATEURS:\n`;
            indicators.forEach(ind => description += `â€¢ ${ind}\n`);
            description += `\n`;
        }
        
        // Détecter les conditions
        if (/crossover|cross.*over/i.test(forgeState.pythonCode)) {
            description += `CONDITIONS:\nâ€¢ Utilise des croisements\n\n`;
        }
        
        // Extraire les paramètres de __init__
        const params = [];
        const paramMatches = forgeState.pythonCode.matchAll(/self\.(\w+)\s*=\s*(\d+)/g);
        for (const match of paramMatches) {
            params.push(`${match[1]}: ${match[2]}`);
        }
        if (params.length > 0) {
            description += `PARAMÃˆTRES:\n`;
            params.forEach(p => description += `â€¢ ${p}\n`);
        }
        
        forgeState.description = description.trim() || 'Stratégie Python importée. Analyse détaillée non disponible.';
        
        forgeIsGenerating = false;
        forgeUpdateGenerationStatus('ready-desc');
        renderSection();
    }, 500);
}

// Version auto de la conversion Python (utilise la structure Pine)
function forgeConvertToPythonAuto() {
    if (!forgeState.pineCode) return;
    
    // Parser le Pine pour obtenir la structure
    const structure = parsePineScript(forgeState.pineCode);
    
    const className = (structure.name || 'Strategy').replace(/[^a-zA-Z0-9]/g, '');
    
    // Générer le vrai code Python fonctionnel
    let pythonCode = `"""
${structure.name || 'Ma Stratégie'}
Auto-généré par Dtego Trading Forge
"""

import pandas as pd
import numpy as np

class ${className}:
    def __init__(self):
`;
    
    // Paramètres depuis la structure
    for (const param of structure.params) {
        pythonCode += `        self.${param.variable} = ${param.default}\n`;
    }
    if (structure.params.length === 0) {
        pythonCode += `        self.length = 14\n`;
    }
    
    pythonCode += `    
    def calculate_indicators(self, df):
df = df.copy()
`;
    
    // Générer le code des indicateurs
    for (const ind of structure.indicators) {
        switch (ind.type) {
            case 'RSI':
                pythonCode += `        # RSI
delta = df['close'].diff()
gain = (delta.where(delta > 0, 0)).rolling(window=self.${ind.period.match(/\d/) ? 'rsiLength' : ind.period}).mean()
loss = (-delta.where(delta < 0, 0)).rolling(window=self.${ind.period.match(/\d/) ? 'rsiLength' : ind.period}).mean()
rs = gain / loss
df['${ind.variable}'] = 100 - (100 / (1 + rs))
`;
                break;
            case 'SMA':
                pythonCode += `        # SMA
df['${ind.variable}'] = df['close'].rolling(window=self.${ind.variable}Length).mean()
`;
                break;
            case 'EMA':
                pythonCode += `        # EMA
df['${ind.variable}'] = df['close'].ewm(span=self.${ind.variable}Length, adjust=False).mean()
`;
                break;
            case 'MACD':
                pythonCode += `        # MACD
df['ema_fast'] = df['close'].ewm(span=self.macdFast, adjust=False).mean()
df['ema_slow'] = df['close'].ewm(span=self.macdSlow, adjust=False).mean()
df['${ind.variables?.macd || 'macd'}'] = df['ema_fast'] - df['ema_slow']
df['${ind.variables?.signal || 'signal'}'] = df['${ind.variables?.macd || 'macd'}'].ewm(span=self.macdSignal, adjust=False).mean()
df['${ind.variables?.hist || 'histogram'}'] = df['${ind.variables?.macd || 'macd'}'] - df['${ind.variables?.signal || 'signal'}']
`;
                break;
            case 'BB':
                pythonCode += `        # Bollinger Bands
df['bb_middle'] = df['close'].rolling(window=self.bbLength).mean()
df['bb_std'] = df['close'].rolling(window=self.bbLength).std()
df['${ind.variables?.upper || 'bb_upper'}'] = df['bb_middle'] + (df['bb_std'] * self.bbMult)
df['${ind.variables?.lower || 'bb_lower'}'] = df['bb_middle'] - (df['bb_std'] * self.bbMult)
`;
                break;
        }
    }
    
    pythonCode += `        return df
    
    def generate_signals(self, df):
df = self.calculate_indicators(df)
`;
    
    // Générer les signaux depuis les conditions
    if (structure.conditions.long.length > 0) {
        const longConds = structure.conditions.long.map(cond => {
            if (cond.type === 'crossover') {
                const src1 = cond.source1;
                const src2 = isNaN(cond.source2) ? `df['${cond.source2}']` : `self.${cond.source2}`;
                return `(df['${src1}'] > ${src2}) & (df['${src1}'].shift(1) <= ${src2.replace('df[', 'df[').replace(']', '].shift(1)') || src2})`;
            }
            return 'True';
        });
        pythonCode += `        # Signal d'entrée (crossover)
df['long_signal'] = ${longConds.join(' & ')}
`;
    }
    
    if (structure.conditions.exit.length > 0) {
        const exitConds = structure.conditions.exit.map(cond => {
            if (cond.type === 'crossunder') {
                const src1 = cond.source1;
                const src2 = isNaN(cond.source2) ? `df['${cond.source2}']` : `self.${cond.source2}`;
                return `(df['${src1}'] < ${src2}) & (df['${src1}'].shift(1) >= ${src2.replace('df[', 'df[').replace(']', '].shift(1)') || src2})`;
            }
            return 'True';
        });
        pythonCode += `        # Signal de sortie (crossunder)
df['exit_signal'] = ${exitConds.join(' & ')}
`;
    }
    
    pythonCode += `        return df
    
    def backtest(self, df, initial_capital=10000, position_size=0.1):
"""
Exécute un backtest simple de la stratégie.
"""
df = self.generate_signals(df)

capital = initial_capital
position = 0
entry_price = 0
trades = []
equity_curve = [capital]

for i in range(1, len(df)):
    row = df.iloc[i]
    
    # Entrée en position
    if row.get('long_signal', False) and position == 0:
        position_value = capital * position_size
        position = position_value / row['close']
        entry_price = row['close']
        capital -= position_value
    
    # Sortie de position
    elif row.get('exit_signal', False) and position > 0:
        exit_value = position * row['close']
        pnl = exit_value - (position * entry_price)
        capital += exit_value
        trades.append({
            'entry_price': entry_price,
            'exit_price': row['close'],
            'pnl': pnl,
            'pnl_pct': (row['close'] / entry_price - 1) * 100
        })
        position = 0
    
    # Equity curve
    current_equity = capital + (position * row['close'] if position > 0 else 0)
    equity_curve.append(current_equity)

# Statistiques
total_trades = len(trades)
winning = len([t for t in trades if t['pnl'] > 0])

return {
    'final_capital': equity_curve[-1],
    'total_return_pct': (equity_curve[-1] / initial_capital - 1) * 100,
    'total_trades': total_trades,
    'win_rate': (winning / total_trades * 100) if total_trades > 0 else 0,
    'trades': trades
}
`;
    
    forgeState.pythonCode = pythonCode;
}

// Gestion du drag over
function forgeHandleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const container = document.getElementById('forge-dropzone-container');
    if (container) {
        container.style.borderColor = 'rgba(217, 119, 6, 0.5)';
        container.querySelector('textarea').style.borderColor = 'rgba(217, 119, 6, 0.5)';
    }
}

// Gestion du drag leave
function forgeHandleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const container = document.getElementById('forge-dropzone-container');
    if (container) {
        container.querySelector('textarea').style.borderColor = 'rgba(255,255,255,0.1)';
    }
}

// Gestion du drop de fichier
function forgeHandleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const container = document.getElementById('forge-dropzone-container');
    if (container) {
        container.querySelector('textarea').style.borderColor = 'rgba(255,255,255,0.1)';
    }
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validExtensions = ['.pine', '.txt', '.py', '.pinescript'];
    const fileName = file.name.toLowerCase();
    
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
        showCenteredModal('Format non supporté. Utilisez .pine, .txt ou .py', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        
        // Déterminer le mode selon l'extension
        if (fileName.endsWith('.py')) {
            forgeState.inputMode = 'python';
            forgeState.pythonCode = content;
        } else if (fileName.endsWith('.pine') || fileName.endsWith('.pinescript') || content.includes('@version')) {
            forgeState.inputMode = 'pine';
            forgeState.pineCode = content;
            
            // Extraire le nom si possible
            const nameMatch = content.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
            if (nameMatch) {
                forgeState.sourceMeta = { name: nameMatch[1] };
            }
        } else {
            forgeState.inputMode = 'natural';
            forgeState.description = content;
        }
        
        renderSection();
        showCenteredModal(`Fichier "${file.name}" importé`, 'success');
    };
    
    reader.onerror = () => {
        showCenteredModal('Erreur de lecture du fichier', 'error');
    };
    
    reader.readAsText(file);
}

// Importer via sélecteur de fichier
function forgeImportFile(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    
    const validExtensions = ['.pine', '.txt', '.py', '.pinescript'];
    const fileName = file.name.toLowerCase();
    
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
        showCenteredModal('Format non supporté. Utilisez .pine, .txt ou .py', 'error');
        event.target.value = ''; // Reset input
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        
        // Déterminer le mode selon l'extension/contenu
        if (fileName.endsWith('.py')) {
            forgeState.inputMode = 'python';
            forgeState.pythonCode = content;
        } else if (fileName.endsWith('.pine') || fileName.endsWith('.pinescript') || content.includes('@version')) {
            forgeState.inputMode = 'pine';
            forgeState.pineCode = content;
            
            // Extraire le nom si possible
            const nameMatch = content.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
            if (nameMatch) {
                forgeState.sourceMeta = { name: nameMatch[1] };
            }
        } else {
            forgeState.inputMode = 'natural';
            forgeState.description = content;
        }
        
        renderSection();
        showCenteredModal(`"${file.name}" importé`, 'success');
    };
    
    reader.onerror = () => {
        showCenteredModal('Erreur de lecture du fichier', 'error');
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset pour permettre de réimporter le même fichier
}

// Sauvegarde rapide dans la Bibliothèque
function forgeQuickSave() {
    const content = forgeState.inputMode === 'natural' ? forgeState.description 
                  : forgeState.inputMode === 'pine' ? forgeState.pineCode 
                  : forgeState.pythonCode;
    
    if (!content) {
        showCenteredModal('Rien à sauvegarder', 'error');
        return;
    }
    
    // Déterminer le nom
    let defaultName = forgeState.sourceMeta?.name || '';
    if (!defaultName && forgeState.pineCode) {
        const nameMatch = forgeState.pineCode.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
        if (nameMatch) defaultName = nameMatch[1];
    }
    if (!defaultName) {
        defaultName = 'Ma ' + (forgeState.strategyType === 'strategy' ? 'Stratégie' : 'Indicateur');
    }
    

    showPromptModal('Nom pour la sauvegarde:', defaultName, (name) => {
        forgeState.sourceMeta = { ...forgeState.sourceMeta, name };
        const nameInput = document.getElementById('forge-strategy-name');
        if (nameInput) nameInput.value = name;
        forgeSaveToLibrary();
    });
}

// Exporter le fichier selon le mode actuel
function forgeExport() {
    let content, extension, mimeType;
    
    if (forgeState.inputMode === 'python' && forgeState.pythonCode) {
        content = forgeState.pythonCode;
        extension = '.py';
        mimeType = 'text/x-python';
    } else if (forgeState.inputMode === 'pine' && forgeState.pineCode) {
        content = forgeState.pineCode;
        extension = '.pine';
        mimeType = 'text/plain';
    } else if (forgeState.description) {
        content = forgeState.description;
        extension = '.txt';
        mimeType = 'text/plain';
    } else {
        showCenteredModal('Rien à exporter', 'error');
        return;
    }
    
    // Déterminer le nom du fichier
    let fileName = forgeState.sourceMeta?.name || 'export';
    fileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showCenteredModal(`Fichier ${fileName}${extension} exporté`, 'success');
}

// Afficher la modale de confirmation d'effacement
function forgeShowClearModal() {
    const currentMode = forgeState.inputMode;
    const modeLabels = { natural: 'Naturel', pine: 'Pine Script', python: 'Python' };
    
    // Compter le contenu de chaque mode
    const contents = {
        natural: forgeState.description ? `${forgeState.description.length} caractères` : null,
        pine: forgeState.pineCode ? `${forgeState.pineCode.split('\\n').length} lignes` : null,
        python: forgeState.pythonCode ? `${forgeState.pythonCode.split('\\n').length} lignes` : null
    };
    
    // Construire le HTML de la modale
    const modalHTML = `
        <div id="forge-clear-modal" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
            <div class="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                <div class="p-5">
                    <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(239, 68, 68, 0.2);">
                            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </div>
                        Effacer le contenu ?
                    </h3>
                    
                    <div class="mb-5 p-4 rounded-xl" style="background: rgba(0,0,0,0.3);">
                        <p class="text-white/50 text-xs uppercase tracking-wider mb-3">Contenu actuel dans l'Atelier</p>
                        <div class="space-y-2">
                            ${contents.natural ? `
                                <div class="flex items-center justify-between text-sm">
                                    <span class="text-white/70 flex items-center gap-2">
                                        <span class="w-2 h-2 rounded-full ${currentMode === 'natural' ? 'bg-amber-400' : 'bg-white/30'}"></span>
                                        Naturel
                                    </span>
                                    <span class="${currentMode === 'natural' ? 'text-red-400' : 'text-green-400/70'}">${contents.natural} ${currentMode === 'natural' ? 'â† sera effacé' : 'âœ“'}</span>
                                </div>
                            ` : ''}
                            ${contents.pine ? `
                                <div class="flex items-center justify-between text-sm">
                                    <span class="text-white/70 flex items-center gap-2">
                                        <span class="w-2 h-2 rounded-full ${currentMode === 'pine' ? 'bg-amber-400' : 'bg-white/30'}"></span>
                                        Pine Script
                                    </span>
                                    <span class="${currentMode === 'pine' ? 'text-red-400' : 'text-green-400/70'}">${contents.pine} ${currentMode === 'pine' ? 'â† sera effacé' : 'âœ“'}</span>
                                </div>
                            ` : ''}
                            ${contents.python ? `
                                <div class="flex items-center justify-between text-sm">
                                    <span class="text-white/70 flex items-center gap-2">
                                        <span class="w-2 h-2 rounded-full ${currentMode === 'python' ? 'bg-amber-400' : 'bg-white/30'}"></span>
                                        Python
                                    </span>
                                    <span class="${currentMode === 'python' ? 'text-red-400' : 'text-green-400/70'}">${contents.python} ${currentMode === 'python' ? 'â† sera effacé' : 'âœ“'}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <button onclick="forgeClearCurrent()" class="w-full p-4 rounded-xl text-left transition hover:scale-[1.02]" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                            <div class="font-medium text-white mb-1">Effacer "${modeLabels[currentMode]}" uniquement</div>
                            <div class="text-white/40 text-sm">${currentMode === 'natural' ? 'Pine Script et Python seront conservés' : currentMode === 'pine' ? 'Naturel et Python seront conservés' : 'Naturel et Pine Script seront conservés'}</div>
                        </button>
                        
                        <button onclick="forgeClearAll()" class="w-full p-4 rounded-xl text-left transition hover:scale-[1.02]" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);">
                            <div class="font-medium text-red-400 mb-1">Tout réinitialiser</div>
                            <div class="text-white/40 text-sm">Naturel + Pine Script + Python</div>
                        </button>
                    </div>
                    
                    <button onclick="forgeCloseClearModal()" class="w-full mt-4 p-3 rounded-xl text-center text-white/50 hover:text-white/70 hover:bg-white/5 transition text-sm">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter au DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Fermer la modale
function forgeCloseClearModal() {
    const modal = document.getElementById('forge-clear-modal');
    if (modal) modal.remove();
}

// Effacer le mode actuel uniquement
function forgeClearCurrent() {
    const currentMode = forgeState.inputMode;
    
    if (currentMode === 'natural') {
        forgeState.description = '';
    } else if (currentMode === 'pine') {
        forgeState.pineCode = '';
    } else {
        forgeState.pythonCode = '';
    }
    
    forgeCloseClearModal();
    renderSection();
    
    const modeLabels = { natural: 'Naturel', pine: 'Pine Script', python: 'Python' };
    showCenteredModal(`${modeLabels[currentMode]} effacé`, 'success');
}

// Tout réinitialiser
function forgeClearAll() {
    forgeState.description = '';
    forgeState.pineCode = '';
    forgeState.pythonCode = '';
    forgeState.sourceMeta = null;
    forgeState.inputMode = 'natural';
    
    forgeCloseClearModal();
    renderSection();
    showCenteredModal('Atelier réinitialisé', 'success');
}

function toggleForgeLibraryDropdown() {
    const dropdown = document.getElementById('forge-library-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function loadFromLibraryDropdown(id, type) {
    toggleForgeLibraryDropdown();
    // Utilise la fonction de chargement via API
    loadLibraryItemInForge(id);
}

function forgeSimulateBacktest() {
    console.log('[Forge] Simulation started');
    
    // Feedback immédiat
    forgeState.isSimulating = true;
    renderSection();
    
    // Exécuter après un court délai pour afficher le spinner
    setTimeout(() => {
        try {
            // Génère des résultats aléatoires
            function generateRandomResults(timeframe) {
                const tfMultiplier = { '1m': 0.7, '5m': 0.85, '15m': 1.0, '30m': 0.95, '1h': 0.9, '4h': 0.8, '1D': 0.6 };
                const mult = tfMultiplier[timeframe] || 1;
                
                const winRate = (45 + Math.random() * 25) * mult;
                const profitFactor = (0.8 + Math.random() * 1.2) * mult;
                const sharpe = (0.5 + Math.random() * 1.5) * mult;
                const maxDD = 5 + Math.random() * 15;
                const totalProfit = ((Math.random() - 0.3) * 30) * mult;
                const trades = Math.floor((50 + Math.random() * 150) / (timeframe === '1D' ? 5 : timeframe === '4h' ? 3 : 1));
                
                const score = Math.round(
                    (Math.min(winRate, 70) / 70) * 25 +
                    (Math.min(profitFactor, 2) / 2) * 25 +
                    (Math.min(Math.max(sharpe, 0), 2) / 2) * 25 +
                    ((20 - Math.min(maxDD, 20)) / 20) * 25
                );
                
                const totalTrades = Math.max(trades, 10);
                const wins = Math.round(totalTrades * Math.min(winRate, 80) / 100);
                const losses = totalTrades - wins;
                
                return {
                    timeframe,
                    win_rate: Math.min(winRate, 80),
                    profit_factor: Math.max(profitFactor, 0.5),
                    sharpe_ratio: Math.max(sharpe, -0.5),
                    max_drawdown: maxDD,
                    total_profit_pct: totalProfit,
                    total_trades: totalTrades,
                    wins: wins,
                    losses: losses,
                    score: score
                };
            }
            
            // Simuler un code Pine si nécessaire
            if (!forgeState.pineCode) {
                forgeState.pineCode = `//@version=6
strategy("Stratégie Simulée", overlay=true)
length = input.int(14, "RSI Period")
rsi = ta.rsi(close, length)
if ta.crossover(rsi, 30)
    strategy.entry("Long", strategy.long)
if ta.crossunder(rsi, 70)
    strategy.close("Long")`;
                forgeState.sourceMeta = { name: 'RSI Strategy (Simulé)' };
            }
            
            console.log('[Forge] Mode:', forgeState.backtestMode);
            
            if (forgeState.backtestMode === 'comparative') {
                // Mode comparatif
                const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
                forgeState.comparativeResults = timeframes.map(tf => generateRandomResults(tf));
                forgeState.backtestResults = null;
                
                // Trouver le meilleur
                let best = forgeState.comparativeResults[0];
                forgeState.comparativeResults.forEach(r => {
                    if (r.score > best.score) best = r;
                });
                forgeState.bestTimeframe = best.timeframe;
                
                console.log('[Forge] Comparative results:', forgeState.comparativeResults.length, 'Best:', best.timeframe);
                showCenteredModal('Simulation comparative terminée', 'success');
            } else {
                // Mode simple
                forgeState.backtestResults = generateRandomResults(forgeState.selectedTimeframe || '1h');
                forgeState.comparativeResults = null;
                forgeState.bestTimeframe = null;
                
                console.log('[Forge] Simple result:', forgeState.backtestResults);
                showCenteredModal('Simulation terminée', 'success');
            }
            
            // Sauvegarder dans l'historique
            const historyItem = {
                id: 'bt_' + Date.now(),
                timestamp: new Date().toISOString(),
                strategyName: forgeState.sourceMeta?.name || 'Stratégie sans nom',
                strategyFamily: detectStrategyFamily(forgeState.pineCode),
                mode: forgeState.backtestMode,
                params: {
                    timeframe: forgeState.backtestMode === 'simple' ? forgeState.selectedTimeframe : 'all',
                    period: forgeState.selectedPeriod,
                    assets: forgeState.selectedAssets
                },
                results: forgeState.backtestMode === 'comparative' ? forgeState.comparativeResults : forgeState.backtestResults,
                bestTimeframe: forgeState.bestTimeframe,
                globalScore: forgeState.backtestMode === 'comparative' 
                    ? forgeState.comparativeResults.find(r => r.timeframe === forgeState.bestTimeframe)?.score 
                    : forgeState.backtestResults?.score
            };
            backtestHistory.unshift(historyItem);
            saveBacktestHistory();
            console.log('[Forge] Saved to history');
            
            forgeState.aiAnalysis = null;
            forgeState.isSimulating = false;
            renderSection();
            console.log('[Forge] Simulation complete');
            
        } catch (error) {
            console.error('[Forge] Simulation error:', error);
            forgeState.isSimulating = false;
            showCenteredModal('Erreur de simulation: ' + error.message, 'error');
            renderSection();
        }
    }, 150);
}

// Calculer le classement d'une stratégie parmi l'historique
function calculateRanking(currentScore) {
    if (!backtestHistory || backtestHistory.length === 0) {
        return { position: 1, total: 1, percentile: 100 };
    }
    
    // Extraire tous les scores de l'historique
    const allScores = backtestHistory
        .map(bt => bt.globalScore || 0)
        .filter(s => s > 0);
    
    if (allScores.length === 0) {
        return { position: 1, total: 1, percentile: 100 };
    }
    
    // Trier par score décroissant
    allScores.sort((a, b) => b - a);
    
    // Trouver la position du score actuel
    let position = 1;
    for (let i = 0; i < allScores.length; i++) {
        if (currentScore >= allScores[i]) {
            position = i + 1;
            break;
        }
        position = i + 2;
    }
    
    // Limiter à la taille de l'historique
    position = Math.min(position, allScores.length + 1);
    const total = allScores.length + 1; // +1 pour inclure le test actuel
    const percentile = Math.round((position / total) * 100);
    
    return { position, total, percentile };
}

// Générer le bandeau "Meilleur intervalle" avec classement
function renderBestTimeframeBanner() {
    if (!forgeState.bestTimeframe || !forgeState.comparativeResults) return '';
    
    const best = forgeState.comparativeResults.find(r => r.timeframe === forgeState.bestTimeframe);
    if (!best) return '';
    
    const score = best.score || 0;
    const winRate = best.win_rate?.toFixed(1) || '-';
    const pf = best.profit_factor?.toFixed(2) || '-';
    const trades = best.total_trades || 0;
    const wins = best.wins || Math.round(trades * (best.win_rate || 0) / 100);
    const losses = trades - wins;
    const profit = best.total_profit_pct?.toFixed(1) || '0';
    const drawdown = best.max_drawdown?.toFixed(1) || '-';
    const ranking = calculateRanking(score);
    
    const colorClass = ranking.percentile <= 10 ? 'text-green-400' : ranking.percentile <= 30 ? 'text-yellow-400' : 'text-white/50';
    const profitColor = parseFloat(profit) >= 0 ? 'text-green-400' : 'text-red-400';
    
    return `
        <div class="p-4 rounded-lg mb-4" style="background: rgba(217, 119, 6, 0.15); border: 1px solid rgba(217, 119, 6, 0.3);">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div class="flex-1">
                    <div class="text-amber-400 font-semibold text-lg flex items-center gap-2 mb-2">
                        <span>â˜…</span>
                        <span>Meilleur intervalle: ${forgeState.bestTimeframe}</span>
                    </div>
                    <div class="grid grid-cols-4 lg:grid-cols-7 gap-2 text-sm">
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="text-white font-bold">${score}</div>
                            <div class="text-white/40 text-xs">Score</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="text-white font-bold">${winRate}%</div>
                            <div class="text-white/40 text-xs">Win Rate</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="text-white font-bold">${trades}</div>
                            <div class="text-white/40 text-xs">Trades</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="text-green-400 font-bold">${wins}</div>
                            <div class="text-white/40 text-xs">Wins</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="text-red-400 font-bold">${losses}</div>
                            <div class="text-white/40 text-xs">Losses</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);" title="Profit Factor = Gains / Pertes">
                            <div class="text-white font-bold">${pf}</div>
                            <div class="text-white/40 text-xs">Profit Factor</div>
                        </div>
                        <div class="text-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <div class="${profitColor} font-bold">${parseFloat(profit) >= 0 ? '+' : ''}${profit}%</div>
                            <div class="text-white/40 text-xs">Profit</div>
                        </div>
                    </div>
                </div>
                <div class="text-center p-3 rounded-lg" style="background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.3);">
                    <div class="text-white/40 text-xs uppercase mb-1">Classement</div>
                    <div class="text-white font-bold text-lg">#${ranking.position} <span class="text-white/40 font-normal text-sm">/ ${ranking.total}</span></div>
                    <div class="text-xs ${colorClass}">Top ${ranking.percentile}%</div>
                </div>
            </div>
        </div>
    `;
}

// Générer le bandeau de classement pour mode simple
function renderSimpleRankingBanner() {
    if (!forgeState.backtestResults) return '';
    
    const score = forgeState.backtestResults.score || 0;
    const ranking = calculateRanking(score);
    
    if (ranking.total <= 1) return '';
    
    const colorClass = ranking.percentile <= 10 ? 'bg-green-500/20 text-green-400' : ranking.percentile <= 30 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/50';
    
    return `
        <div class="mt-3 p-3 rounded-lg flex items-center justify-between" style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2);">
            <div class="text-white/70 text-sm">
                <span class="text-purple-400 font-medium">Score global: ${score}/100</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-white/40 text-xs">Classement:</span>
                <span class="text-white font-bold">#${ranking.position} <span class="text-white/40 font-normal">/ ${ranking.total}</span></span>
                <span class="text-xs px-2 py-0.5 rounded ${colorClass}">Top ${ranking.percentile}%</span>
            </div>
        </div>
    `;
}

// Détecter la famille de stratégie depuis le code Pine
function detectStrategyFamily(pineCode) {
    if (!pineCode) return 'custom';
    const code = pineCode.toLowerCase();
    if (code.includes('rsi')) return 'oscillator';
    if (code.includes('macd')) return 'momentum';
    if (code.includes('ema') || code.includes('sma') || code.includes('moving')) return 'trend';
    if (code.includes('bollinger') || code.includes('bb')) return 'volatility';
    if (code.includes('volume') || code.includes('obv')) return 'volume';
    if (code.includes('stoch')) return 'oscillator';
    return 'custom';
}

// Module Backtest réutilisable (identique pour Convertir et Créer)
function renderForgeBacktestModule(mode = 'convert') {
    const radioName = mode === 'create' ? 'backtest-mode-create' : 'backtest-mode';
    
    // Si résultats affichés
    if (forgeState.backtestResults || forgeState.comparativeResults) {
        return `
            <div data-backtest-module class="rounded-xl overflow-hidden transition-all duration-300 mt-4" style="background: rgba(217, 119, 6, 0.08); border: 1px solid rgba(217, 119, 6, 0.25);">
                <div class="p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-amber-400 font-semibold flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                            BACKTEST ${forgeState.comparativeResults ? 'â€¢ Comparatif' : 'â€¢ ' + forgeState.selectedTimeframe}
                            <span class="text-white/40 font-normal text-sm ml-2">Période: ${forgeState.selectedPeriod}</span>
                        </h3>
                        <button onclick="forgeCloseBacktest()" 
                            class="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    
                    ${forgeState.comparativeResults ? renderComparativeTable() : renderSimpleResults()}
                    
                    <div class="flex items-center gap-3 mt-4 pt-4 border-t border-amber-500/20">
                        <button onclick="forgeNewTest()" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            Nouveau test
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // État configuration
    return `
        <div data-backtest-module class="rounded-xl overflow-hidden transition-all duration-300 mt-4" style="background: rgba(217, 119, 6, 0.08); border: 1px solid rgba(217, 119, 6, 0.25);">
            <div class="p-5">
                <h3 class="text-amber-400 font-semibold flex items-center gap-2 mb-4">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                    BACKTEST
                </h3>
                
                <!-- Mode Simple / Comparatif -->
                <div class="flex items-center gap-4 mb-4 p-3 rounded-lg" style="background: rgba(0,0,0,0.2);">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="${radioName}" value="simple" ${forgeState.backtestMode === 'simple' ? 'checked' : ''} class="accent-amber-500" onchange="forgeState.backtestMode = 'simple'; renderSection();">
                        <span class="text-white text-sm">Simple</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="${radioName}" value="comparative" ${forgeState.backtestMode === 'comparative' ? 'checked' : ''} class="accent-amber-500" onchange="forgeState.backtestMode = 'comparative'; renderSection();">
                        <span class="text-white text-sm">Comparatif</span>
                        <span class="text-white/40 text-xs">(tous les intervalles)</span>
                    </label>
                </div>
                
                <!-- Sélection Intervalle (mode simple uniquement) -->
                ${forgeState.backtestMode === 'simple' ? `
                    <div class="mb-4">
                        <label class="text-white/60 text-xs block mb-2">Intervalle</label>
                        <div class="flex flex-wrap gap-2">
                            ${BACKTEST_TIMEFRAMES.map(tf => `
                                <button onclick="forgeState.selectedTimeframe = '${tf.value}'; renderSection();"
                                    class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${forgeState.selectedTimeframe === tf.value ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}"
                                >${tf.label}</button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Sélection Période -->
                <div class="mb-4">
                    <label class="text-white/60 text-xs block mb-2">Période</label>
                    <div class="flex flex-wrap gap-2">
                        ${BACKTEST_PERIODS.map(p => `
                            <button onclick="forgeState.selectedPeriod = '${p.value}'; renderSection();"
                                class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${forgeState.selectedPeriod === p.value ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}"
                            >${p.label}</button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Monnaies + Boutons -->
                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex items-center gap-2">
                        <label class="text-white/60 text-sm">Monnaies :</label>
                        <button onclick="forgeOpenAssetSelector()" 
                            class="px-3 py-2 rounded-lg text-sm text-white border border-amber-500/30 hover:border-amber-500/50 focus:outline-none cursor-pointer flex items-center gap-2 transition"
                            style="background: rgba(0,0,0,0.3);">
                            <span>${(() => {
                                const assets = forgeState.selectedAssets ? forgeState.selectedAssets.split(',') : [];
                                const count = assets.length;
                                if (count === 0) return 'Aucun';
                                if (count <= 3) return assets.map(a => a.replace('USDT', '')).join(', ');
                                return count + ' sélectionné' + (count > 1 ? 's' : '');
                            })()}</span>
                            <svg class="w-4 h-4 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </button>
                    </div>
                    
                    <div class="flex-1"></div>
                    
                    <button onclick="forgeGenerateAndTest()" 
                        class="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 ${forgeState.isGenerating || !forgeState.pythonCode ? 'opacity-50 cursor-not-allowed' : ''}"
                        style="background: linear-gradient(135deg, #b45309, #d97706);"
                        ${forgeState.isGenerating || !forgeState.pythonCode ? 'disabled' : ''}>
                        ${forgeState.isGenerating ? `
                            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            Test en cours...
                        ` : !forgeState.pythonCode ? `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                            Code Python requis
                        ` : `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Backtester
                        `}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Helper pour tableau comparatif
function renderComparativeTable() {
    if (!forgeState.comparativeResults) return '';
    return `
        <div class="overflow-x-auto mb-4">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-amber-400/80 text-xs uppercase">
                        <th class="text-left py-2 px-3">Intervalle</th>
                        <th class="text-center py-2 px-2">Score</th>
                        <th class="text-center py-2 px-2">Win Rate</th>
                        <th class="text-center py-2 px-2">Trades</th>
                        <th class="text-center py-2 px-2">Drawdown</th>
                        <th class="text-center py-2 px-2">P.F.</th>
                        <th class="text-center py-2 px-2">Profit</th>
                    </tr>
                </thead>
                <tbody>
                    ${forgeState.comparativeResults.map(r => {
                        const score = r.score || 0;
                        const scoreColor = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';
                        const isBest = r.timeframe === forgeState.bestTimeframe;
                        return `
                            <tr class="${isBest ? 'bg-amber-500/10' : ''}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td class="py-2 px-3 font-medium text-white">${isBest ? '<span class="text-amber-400">â˜…</span> ' : ''}${r.timeframe}</td>
                                <td class="py-2 px-2 text-center"><span style="color: ${scoreColor};">${score}</span></td>
                                <td class="text-center py-2 px-2 text-white/80">${r.win_rate?.toFixed(1)}%</td>
                                <td class="text-center py-2 px-2 text-white/60">${r.total_trades}</td>
                                <td class="text-center py-2 px-2 text-white/80">${r.max_drawdown?.toFixed(1)}%</td>
                                <td class="text-center py-2 px-2 text-white/80">${r.profit_factor?.toFixed(2)}</td>
                                <td class="text-center py-2 px-2 font-medium ${r.total_profit_pct >= 0 ? 'text-green-400' : 'text-red-400'}">
                                    ${r.total_profit_pct >= 0 ? '+' : ''}${r.total_profit_pct?.toFixed(1)}%
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper pour résultats simples
function renderSimpleResults() {
    if (!forgeState.backtestResults) return '';
    const r = forgeState.backtestResults;
    return `
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                <div class="text-2xl font-bold text-white">${r.win_rate?.toFixed(1) || '--'}%</div>
                <div class="text-white/50 text-xs mt-1">Win Rate</div>
            </div>
            <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                <div class="text-2xl font-bold text-white">${r.profit_factor?.toFixed(2) || '--'}</div>
                <div class="text-white/50 text-xs mt-1">Profit Factor</div>
            </div>
            <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                <div class="text-2xl font-bold text-white">${r.sharpe_ratio?.toFixed(2) || '--'}</div>
                <div class="text-white/50 text-xs mt-1">Sharpe Ratio</div>
            </div>
            <div class="p-4 rounded-xl text-center" style="background: rgba(0,0,0,0.3);">
                <div class="text-2xl font-bold text-white">${r.max_drawdown?.toFixed(1) || '--'}%</div>
                <div class="text-white/50 text-xs mt-1">Max Drawdown</div>
            </div>
            <div class="p-4 rounded-xl text-center" style="background: ${(r.total_profit_pct || 0) >= 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)'}; border: 1px solid ${(r.total_profit_pct || 0) >= 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'};">
                <div class="text-2xl font-bold ${(r.total_profit_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
                    ${(r.total_profit_pct || 0) >= 0 ? '+' : ''}${r.total_profit_pct?.toFixed(2) || '0.00'}%
                </div>
                <div class="text-white/50 text-xs mt-1">${r.total_trades || 0} trades</div>
            </div>
        </div>
    `;
}

function forgeCloseBacktest() {
    forgeState.backtestResults = null;
    forgeState.comparativeResults = null;
    forgeState.bestTimeframe = null;
    forgeState.aiAnalysis = null;
    renderSection();
}

function forgeNewTest() {
    forgeState.backtestResults = null;
    forgeState.comparativeResults = null;
    forgeState.bestTimeframe = null;
    forgeState.aiAnalysis = null;
    renderSection();
}

function forgeDownloadPine() {
    if (!forgeState.pineCode) {
        showCenteredModal('Aucun code à télécharger', 'error');
        return;
    }
    
    const name = forgeState.sourceMeta?.name || 'strategy';
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const blob = new Blob([forgeState.pineCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.pine`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showCenteredModal('Fichier .pine téléchargé', 'success');
}

function forgeDownloadPython() {
    if (!forgeState.pythonCode) {
        showCenteredModal('Aucun code Python à télécharger', 'error');
        return;
    }
    
    const name = forgeState.sourceMeta?.name || 'strategy';
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const blob = new Blob([forgeState.pythonCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showCenteredModal('Fichier .py téléchargé', 'success');
}

// Générer du code Pine depuis la description naturelle (placeholder - nécessite AI)
function forgeGeneratePine() {
    if (!forgeState.description || forgeState.description.length < 20) {
        showCenteredModal('Description trop courte (min 20 caractères)', 'error');
        return;
    }
    
    // Pour l'instant: template basique basé sur la description
    // TODO: Intégrer Claude API pour génération intelligente
    showCenteredModal('Génération Pine Script... (fonctionnalité AI à venir)', 'info');
    
    // Template basique en attendant l'intégration AI
    const template = `//@version=6
strategy("${forgeState.sourceMeta?.name || 'Ma Stratégie'}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// Description: ${forgeState.description.substring(0, 100)}...

// === PARAMÃˆTRES ===
length = input.int(14, "Période", minval=1)
oversold = input.int(30, "Survente", minval=0, maxval=50)
overbought = input.int(70, "Surachat", minval=50, maxval=100)

// === INDICATEURS ===
rsi = ta.rsi(close, length)

// === CONDITIONS ===
longCondition = ta.crossover(rsi, oversold)
shortCondition = ta.crossunder(rsi, overbought)

// === ENTRÉES ===
if longCondition
    strategy.entry("Long", strategy.long)

if shortCondition
    strategy.close("Long")

// === VISUALISATION ===
plot(rsi, "RSI", color.blue)
hline(oversold, "Survente", color.green)
hline(overbought, "Surachat", color.red)
`;
    
    forgeState.pineCode = template;
    forgeState.inputMode = 'pine';
    renderSection();
    showCenteredModal('Template Pine généré - Personnalisez-le!', 'success');
}

// Convertir Pine Script en Python via API avec Claude AI
async function forgeConvertToPython() {
    if (!forgeState.pineCode) {
        showCenteredModal('Aucun code Pine à convertir', 'error');
        return;
    }

    showCenteredModal('Conversion IA en cours...', 'info');
    forgeState.isConverting = true;
    renderSection();

    try {
        const response = await fetch(`${API_BASE}/api/forge/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pine_code: forgeState.pineCode,
                use_ai: true
            })
        });

        const data = await response.json();

        if (data.success && data.python_code) {
            forgeState.pythonCode = data.python_code;
            forgeState.inputMode = 'python';
            renderSection();
            showCenteredModal(`Conversion IA réussie (${data.conversion_method})`, 'success');

            // Analyse granulaire automatique
            setTimeout(() => {
                analyzeAndShowGranules(
                    forgeState.pineCode,
                    'pine',
                    forgeState.projectName || 'Code converti'
                );
            }, 500);
        } else {
            throw new Error(data.error || 'Erreur de conversion');
        }
    } catch (error) {
        console.error('Conversion error:', error);
        showCenteredModal(`Erreur: ${error.message}`, 'error');
    } finally {
        forgeState.isConverting = false;
        renderSection();
    }
}

function forgeIgnoreSuggestion(index) {
    if (forgeState.aiAnalysis && forgeState.aiAnalysis.suggestions) {
        forgeState.aiAnalysis.suggestions.splice(index, 1);
        renderSection();
    }
}

// Modal d'erreur centré (design system)
function showErrorModal(message, title = 'Erreur') {
    // Supprimer modal existant si présent
    const existing = document.getElementById('error-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'error-modal-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1000; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); text-align: center;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(248,113,113,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                <svg width="24" height="24" fill="none" stroke="#f87171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <h3 style="color: white; font-size: 16px; font-weight: 600; margin: 0 0 0.5rem;">${title}</h3>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; margin: 0 0 1.5rem;">${message}</p>
            <button onclick="this.closest('#error-modal-overlay').remove()" style="padding: 0.5rem 1.5rem; border-radius: 12px; border: none; background: #f87171; color: white; font-weight: 500; cursor: pointer;">
                Compris
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
}

async function forgeSaveToLibrary() {
    // Si projet ouvert, utiliser son nom directement
    const name = forgeState.currentProject?.name
        || document.getElementById('forge-strategy-name')?.value?.trim()
        || forgeState.sourceMeta?.name
        || 'Ma stratégie';

    // Récupérer le code depuis le projet ou forgeState
    const pineCode = forgeState.currentProject?.currentVersion?.pine_code || forgeState.pineCode;
    const pythonCode = forgeState.currentProject?.currentVersion?.python_code || forgeState.pythonCode;

    if (!pineCode && !pythonCode) {
        showErrorModal('Aucun code à sauvegarder. Générez d\'abord du code Pine ou Python.', 'Code manquant');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                type: forgeState.strategyType === 'strategy' ? 'strategy' : 'indicator',
                category: 'other',
                version: 'v6',
                description: forgeState.description,
                pine_code: pineCode,
                python_code: pythonCode,
                parameters: [],
                status: 'draft'
            })
        });

        const data = await response.json();

        if (data.success) {
            showCenteredModal(`"${name}" sauvegardé dans la bibliothèque`, 'success');
            await loadLibrary();
        } else {
            showErrorModal(data.error || 'Une erreur est survenue lors de la sauvegarde.', 'Erreur de sauvegarde');
        }
    } catch (e) {
        console.error('Save error:', e);
        showErrorModal('Impossible de contacter le serveur. Vérifiez votre connexion internet.', 'Erreur de connexion');
    }
}

function forgeDeployTest() {
    showCenteredModal('Déploiement TEST - Fonctionnalité à venir', 'info');
}

function forgeDeployActive() {
    showCenteredModal('Déploiement ACTIF - Fonctionnalité à venir', 'info');
}

// Fonction unifiée de conversion
function forgeConvertTo(target) {
    if (target === 'natural') {
        // Générer description depuis Pine ou Python
        if (forgeState.pineCode) {
            forgeAnalyzeCode('pine');
        } else if (forgeState.pythonCode) {
            forgeAnalyzeCode('python');
        } else {
            showCenteredModal('Aucune source disponible', 'error');
        }
    } else if (target === 'pine') {
        // Générer Pine depuis description ou Python
        if (forgeState.description && forgeState.description.length >= 20) {
            forgeGeneratePine();
        } else if (forgeState.pythonCode) {
            showCenteredModal('Conversion Python â†’ Pine à venir', 'info');
        } else {
            showCenteredModal('Aucune source disponible', 'error');
        }
    } else if (target === 'python') {
        // Générer Python depuis Pine ou description
        if (forgeState.pineCode) {
            forgeConvertToPython();
        } else if (forgeState.description && forgeState.description.length >= 20) {
            showCenteredModal('Conversion Description â†’ Python à venir', 'info');
        } else {
            showCenteredModal('Aucune source disponible', 'error');
        }
    }
}

// Analyser code pour générer description
function forgeAnalyzeCode(source) {
    let code = source === 'pine' ? forgeState.pineCode : forgeState.pythonCode;
    if (!code) {
        showCenteredModal('Aucun code à analyser', 'error');
        return;
    }
    
    showCenteredModal('Analyse en cours...', 'info');
    
    // Extraction basique des informations
    let description = '';
    
    if (source === 'pine') {
        // Extraire le nom
        const nameMatch = code.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
        const name = nameMatch ? nameMatch[1] : 'Stratégie';
        
        // Extraire les indicateurs
        const indicators = [];
        if (/ta\.rsi/i.test(code)) indicators.push('RSI');
        if (/ta\.sma/i.test(code)) indicators.push('SMA');
        if (/ta\.ema/i.test(code)) indicators.push('EMA');
        if (/ta\.macd/i.test(code)) indicators.push('MACD');
        if (/ta\.bb/i.test(code)) indicators.push('Bandes de Bollinger');
        if (/ta\.atr/i.test(code)) indicators.push('ATR');
        if (/ta\.stoch/i.test(code)) indicators.push('Stochastique');
        if (/ta\.supertrend/i.test(code)) indicators.push('SuperTrend');
        
        // Extraire les conditions
        const longMatch = code.match(/longCondition\s*=\s*(.+)/);
        const shortMatch = code.match(/shortCondition\s*=\s*(.+)/);
        
        description = `**${name}**\n\n`;
        description += indicators.length > 0 ? `Cette stratégie utilise les indicateurs suivants: ${indicators.join(', ')}.\n\n` : '';
        description += longMatch ? `Condition d'entrée LONG: ${longMatch[1].trim()}\n` : '';
        description += shortMatch ? `Condition de sortie/SHORT: ${shortMatch[1].trim()}\n` : '';
    } else {
        // Analyse Python
        const classMatch = code.match(/class\s+(\w+)/);
        const name = classMatch ? classMatch[1] : 'Stratégie';
        description = `**${name}**\n\nStratégie Python avec backtesting intégré.`;
    }
    
    forgeState.description = description || 'Description générée automatiquement.';
    forgeState.inputMode = 'natural';
    renderSection();
    showCenteredModal('Description générée', 'success');
}

async function forgeGenerate() {
    const description = forgeState.description.trim();
    if (!description) {
        showCenteredModal('Décrivez votre stratégie', 'error');
        return;
    }
    
    forgeState.isGenerating = true;
    renderSection();
    forgeShowGenerating();
    
    try {
        console.log('[FORGE] Requête envoyée vers API avec project_id:', forgeState.currentProjectId);
        const response = await fetch(`${API_BASE}/api/forge/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({project_id: forgeState.currentProjectId})
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.pine_code) {
            forgeState.pineCode = data.pine_code;
            forgeState.pythonCode = data.python_code || '';
            
            // Transition modale vers RESULT
            forgeShowResult(data.pine_code, data.python_code || '', null);

            // Analyse granulaire en arrière-plan
            forgeState.forgeModalGranulesLoading = true;
            forgeModalUpdateGranulesButton();
            
            (async () => {
                try {
                    const grResp = await fetch(`${API_BASE}/api/forge/extract-granules`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: data.pine_code, code_type: 'pine', save_new: false })
                    });
                    const grData = await grResp.json();
                    
                    if (grData.success && grData.granules && grData.granules.length > 0) {
                        const comparison = await compareGranulesWithLibrary(grData.granules);
                        forgeState.forgeModalGranules = comparison;
                    } else {
                        forgeState.forgeModalGranules = [];
                    }
                } catch (grErr) {
                    console.error('[FORGE] Erreur granules:', grErr);
                    forgeState.forgeModalGranules = [];
                }
                forgeState.forgeModalGranulesLoading = false;
                forgeModalUpdateGranulesButton();
            })();
        } else {
            forgeCloseModal();
            showCenteredModal(data.error || 'Erreur de génération', 'error');
        }
    } catch (e) {
        console.error('Forge generate error:', e);
        forgeCloseModal();
        showCenteredModal('Erreur de connexion', 'error');
    } finally {
        forgeState.isGenerating = false;
        renderSection();
    }
}

async function forgeRefine() {
    const refinement = forgeState.refinement.trim();
    if (!refinement) {
        showCenteredModal('Indiquez une modification', 'error');
        return;
    }
    
    forgeState.isGenerating = true;
    renderSection();
    
    try {
        const response = await fetch(`${API_BASE}/api/forge/refine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pine_code: forgeState.pineCode,
                refinement: refinement,
                type: forgeState.strategyType
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.pine_code) {
            forgeState.pineCode = data.pine_code;
            forgeState.pythonCode = data.python_code || '';
            forgeState.conversationHistory.push(refinement);
            forgeState.refinement = '';
            forgeState.backtestResults = null; // Reset backtest après modification
            showCenteredModal('Code modifié', 'success');
        } else {
            showCenteredModal(data.error || 'Erreur de modification', 'error');
        }
    } catch (e) {
        console.error('Forge refine error:', e);
        showCenteredModal('Erreur de connexion', 'error');
    } finally {
        forgeState.isGenerating = false;
        renderSection();
    }
}

function forgeCopyCode(type = 'pine') {
    const code = type === 'python' ? forgeState.pythonCode : forgeState.pineCode;
    if (code) {
        navigator.clipboard.writeText(code)
            .then(() => showCenteredModal(`Code ${type === 'python' ? 'Python' : 'Pine'} copié`, 'success'))
            .catch(() => showCenteredModal('Erreur de copie', 'error'));
    }
}

function forgeTogglePineCode() {
    forgeState.showPineCode = !forgeState.showPineCode;
    renderSection();
}

function forgeViewSource() {
    forgeState.showPineCode = true;
    renderSection();
}

async function forgeRunBacktest() {
    if (!forgeState.pineCode) {
        showCenteredModal('Aucun code à tester', 'error');
        return;
    }
    
    forgeState.isGenerating = true;
    forgeState.backtestResults = null;
    forgeState.aiAnalysis = null;
    renderSection();
    
    try {
        // Convertir Pine â†’ Python si pas encore fait
        if (!forgeState.pythonCode) {
            const convertRes = await fetch(`${API_BASE}/api/forge/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pine_code: forgeState.pineCode, use_ai: true })
            });
            const convertData = await convertRes.json();
            if (convertData.success) {
                forgeState.pythonCode = convertData.python_code;
            }
        }
        
        // Lancer le backtest
        const btResponse = await fetch(`${API_BASE}/api/forge/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_code: forgeState.pythonCode,
                pine_code: forgeState.pineCode,
                description: forgeState.description || forgeState.sourceMeta?.name || '',
                assets: forgeState.selectedAssets.split(','),
                period: forgeState.selectedPeriod,
                timeframe: '1h',
                initial_capital: 10000
            })
        });
        
        const btData = await btResponse.json();
        
        if (btData.success) {
            forgeState.backtestResults = btData;
            showCenteredModal('Backtest terminé', 'success');
        } else {
            showCenteredModal(btData.error || 'Erreur backtest', 'error');
        }
    } catch (e) {
        console.error('Backtest error:', e);
        showCenteredModal(e.message || 'Erreur de test', 'error');
    } finally {
        forgeState.isGenerating = false;
        renderSection();
    }
}

async function forgeGenerateAndTest() {
    const description = forgeState.description.trim();
    if (!description) {
        showCenteredModal('Décrivez votre stratégie', 'error');
        return;
    }
    
    forgeState.isGenerating = true;
    forgeState.backtestResults = null;
    forgeState.aiAnalysis = null;
    renderSection();
    
    try {
        // Étape 1: Générer le code Pine
        const genResponse = await fetch(`${API_BASE}/api/forge/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description,
                type: forgeState.strategyType
            })
        });
        
        const genData = await genResponse.json();
        
        if (!genData.success || !genData.pine_code) {
            throw new Error(genData.error || 'Erreur de génération');
        }
        
        forgeState.pineCode = genData.pine_code;
        forgeState.pythonCode = genData.python_code || '';
        renderSection();
        
        // Étape 2: Lancer le backtest
        const assetsStr = forgeState.selectedAssets;
        const period = forgeState.selectedPeriod;
        
        // Convertir Pine â†’ Python si nécessaire
        if (!forgeState.pythonCode) {
            const convertRes = await fetch(`${API_BASE}/api/forge/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pine_code: forgeState.pineCode, use_ai: true })
            });
            const convertData = await convertRes.json();
            if (convertData.success) {
                forgeState.pythonCode = convertData.python_code;
            }
        }
        
        const btResponse = await fetch(`${API_BASE}/api/forge/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_code: forgeState.pythonCode,
                pine_code: forgeState.pineCode,
                description: forgeState.description,
                assets: assetsStr.split(','),
                period: period,
                timeframe: '1h',
                initial_capital: 10000
            })
        });
        
        const btData = await btResponse.json();
        
        if (btData.success) {
            forgeState.backtestResults = btData;
            showCenteredModal('Stratégie générée et testée', 'success');
        } else {
            showCenteredModal(btData.error || 'Erreur backtest', 'error');
        }
    } catch (e) {
        console.error('Forge generate and test error:', e);
        showCenteredModal(e.message || 'Erreur de génération', 'error');
    } finally {
        forgeState.isGenerating = false;
        renderSection();
    }
}

async function forgeRequestAnalysis() {
    if (!forgeState.backtestResults) {
        showCenteredModal('Lancez d\'abord un backtest', 'error');
        return;
    }
    
    forgeState.isAnalyzing = true;
    renderSection();
    
    try {
        const response = await fetch(`${API_BASE}/api/forge/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pine_code: forgeState.pineCode,
                description: forgeState.description,
                backtest_results: forgeState.backtestResults
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            forgeState.aiAnalysis = {
                summary: data.summary,
                suggestions: data.suggestions || []
            };
            showCenteredModal('Analyse terminée', 'success');
        } else {
            showCenteredModal(data.error || 'Erreur d\'analyse', 'error');
        }
    } catch (e) {
        console.error('Forge analysis error:', e);
        showCenteredModal('Erreur de connexion', 'error');
    } finally {
        forgeState.isAnalyzing = false;
        renderSection();
    }
}

async function forgeApplySuggestion(index) {
    if (!forgeState.aiAnalysis || !forgeState.aiAnalysis.suggestions[index]) {
        return;
    }
    
    const suggestion = forgeState.aiAnalysis.suggestions[index];
    forgeState.refinement = suggestion.text;
    
    // Appeler forgeRefine directement
    await forgeRefine();
}

async function forgeRunBacktest() {
    if (!forgeState.pineCode) {
        showCenteredModal('Génère d\'abord le code', 'error');
        return;
    }
    
    forgeState.isBacktesting = true;
    renderSection();
    
    const assetsStr = document.getElementById('forge-assets')?.value || 'BTCUSDT';
    const period = document.getElementById('forge-period')?.value || '3M';
    
    try {
        // D'abord convertir Pine â†’ Python si pas déjà fait
        if (!forgeState.pythonCode) {
            const convertRes = await fetch(`${API_BASE}/api/forge/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pine_code: forgeState.pineCode, use_ai: true })
            });
            const convertData = await convertRes.json();
            if (convertData.success) {
                forgeState.pythonCode = convertData.python_code;
            } else {
                throw new Error(convertData.error || 'Erreur de conversion');
            }
        }
        
        // Ensuite lancer le backtest
        const response = await fetch(`${API_BASE}/api/forge/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_code: forgeState.pythonCode,
                pine_code: forgeState.pineCode,
                description: forgeState.description,
                assets: assetsStr.split(','),
                period: period,
                timeframe: '1h',
                initial_capital: 10000
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            forgeState.backtestResults = data;
            showCenteredModal('Backtest terminé', 'success');
        } else {
            showCenteredModal(data.error || 'Erreur backtest', 'error');
        }
    } catch (e) {
        console.error('Forge backtest error:', e);
        showCenteredModal(e.message || 'Erreur de backtest', 'error');
    } finally {
        forgeState.isBacktesting = false;
        renderSection();
    }
}

async function forgeDeployTest() {
    const name = document.getElementById('forge-strategy-name')?.value?.trim();
    if (!name) {
        showCenteredModal('Nom de stratégie requis', 'error');
        return;
    }
    
    // TODO: Implémenter le déploiement en mode TEST
    showCenteredModal('Déploiement TEST - À implémenter', 'info');
}

async function forgeDeployActive() {
    const name = document.getElementById('forge-strategy-name')?.value?.trim();
    if (!name) {
        showCenteredModal('Nom de stratégie requis', 'error');
        return;
    }

    // Confirmation avant déploiement actif
    showConfirmModal(`Activer "${name}" sur le Scanner?\n\nCette stratégie sera utilisée pour les signaux de trading.`, () => {
        // TODO: Implémenter le déploiement ACTIF
        showCenteredModal('Déploiement ACTIF - À implémenter', 'info');
    });
}

function forgeShowHistory() {
    const modal = document.getElementById('forge-history-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Remplir le select des stratégies
        forgePopulateStrategyFilter();
        forgeRenderHistoryList();
    }
}

// Remplir dynamiquement le filtre des stratégies
function forgePopulateStrategyFilter() {
    const select = document.getElementById('history-filter-strategy');
    if (!select) return;
    
    // Extraire les noms uniques de stratégies
    const strategyNames = [...new Set(backtestHistory.map(bt => bt.strategyName).filter(Boolean))];
    strategyNames.sort();
    
    // Reconstruire les options
    select.innerHTML = '<option value="all">Toutes</option>';
    strategyNames.forEach(name => {
        const count = backtestHistory.filter(bt => bt.strategyName === name).length;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${name} (${count})`;
        select.appendChild(opt);
    });
}

function forgeCloseHistory() {
    const modal = document.getElementById('forge-history-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ========================================
// SÉLECTEUR D'ASSETS AVEC CATÉGORIES
// ========================================

// Catégories d'assets pour le backtest (TOUS les 200+ assets)
const BACKTEST_ASSET_CATEGORIES = {
    'Layer 1': ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR', 'APT', 'SUI', 'SEI', 'INJ', 'TIA', 'FTM', 'ALGO', 'XLM', 'HBAR', 'ICP', 'VET', 'EOS', 'XTZ', 'EGLD', 'FLOW', 'MINA', 'KAVA', 'ONE', 'ZIL', 'CELO', 'ROSE', 'KDA', 'CKB', 'TONCOIN'],
    'Layer 2': ['MATIC', 'ARB', 'OP', 'IMX', 'MNT', 'STRK', 'ZK', 'METIS', 'BOBA', 'SKL'],
    'DeFi': ['UNI', 'AAVE', 'MKR', 'SNX', 'COMP', 'CRV', 'SUSHI', '1INCH', 'BAL', 'YFI', 'DYDX', 'GMX', 'LDO', 'RPL', 'FXS', 'PENDLE', 'JUP', 'RAY', 'ORCA'],
    'Gaming': ['AXS', 'SAND', 'MANA', 'ENJ', 'GALA', 'ILV', 'IMX', 'RONIN', 'PRIME', 'PIXEL', 'PORTAL', 'XAI', 'BEAM', 'MYRIA', 'BIGTIME'],
    'Meme': ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'COQ', 'SATS', 'ORDI', 'BOME', 'SLERF', 'MEW', 'POPCAT', 'NEIRO', 'BRETT', 'TURBO', 'BABYDOGE'],
    'AI': ['FET', 'AGIX', 'OCEAN', 'RNDR', 'TAO', 'AKT', 'ARKM', 'WLD', 'AI', 'NMR', 'CTXC', 'ALI', 'VANA', 'GRIFFAIN'],
    'Exchange': ['BNB', 'BGB', 'OKB', 'CRO', 'KCS', 'HT', 'GT', 'MX', 'LEO'],
    'Infrastructure': ['LINK', 'GRT', 'FIL', 'AR', 'THETA', 'PYTH', 'API3', 'BAND', 'TRB', 'STORJ'],
    'Privacy': ['XMR', 'ZEC', 'DASH', 'DCR', 'SCRT', 'ARRR', 'FIRO', 'ZEN', 'PIVX'],
    'RWA': ['ONDO', 'POLYX', 'PROPC', 'RIO', 'NXRA', 'TRU'],
    'Social': ['MASK', 'GAL', 'ID', 'ENS', 'CYBER', 'HOOK', 'RSS3', 'PHB'],
    'Storage': ['FIL', 'AR', 'STORJ', 'SC', 'BLZ', 'HOT'],
    'Forex': ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'USDCAD'],
    'Metals': ['XAUUSD', 'XAGUSD']
};

// État temporaire de sélection (avant validation)
let tempSelectedAssets = new Set();

// Charger les listes sauvegardées
function forgeGetSavedAssetLists() {
    try {
        return JSON.parse(localStorage.getItem('dtego_asset_lists') || '{}');
    } catch {
        return {};
    }
}

// Sauvegarder les listes
function forgeSaveAssetLists(lists) {
    localStorage.setItem('dtego_asset_lists', JSON.stringify(lists));
}

// Créer la modale dynamiquement si elle n'existe pas
function forgeEnsureAssetModal() {
    if (document.getElementById('forge-assets-modal-dynamic')) return;
    
    const modal = document.createElement('div');
    modal.id = 'forge-assets-modal-dynamic';
    modal.className = 'hidden fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.cssText = 'background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);';
    
    modal.innerHTML = `
        <div class="w-full max-w-5xl rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
            <div class="flex items-center justify-between p-5 border-b border-white/10">
                <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                    <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                    Sélection des Assets
                    <span id="assets-selected-count" class="text-white/40 text-sm font-normal ml-2"></span>
                </h3>
                <button onclick="forgeCloseAssetSelector()" class="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="px-5 py-3 border-b border-white/10 flex flex-wrap items-center gap-3" style="background: rgba(0,0,0,0.2);">
                <div class="flex items-center gap-2">
                    <label class="text-white/50 text-xs">Mes listes:</label>
                    <select id="asset-lists-select" onchange="forgeLoadAssetList()" 
                        class="px-3 py-1.5 rounded-lg text-xs border border-white/20 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                        style="background: rgba(0,0,0,0.4); color: white; min-width: 140px;">
                        <option value="">-- Charger --</option>
                    </select>
                </div>
                <button onclick="forgeSaveAssetList()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition">Sauvegarder</button>
                <button onclick="forgeDeleteAssetList()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">Supprimer</button>
                <div class="flex-1"></div>
                <button onclick="forgeSelectAllAssets()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition">Tout sélect.</button>
                <button onclick="forgeDeselectAllAssets()" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition">Tout désélect.</button>
            </div>
            
            <div class="p-5 overflow-y-auto" style="max-height: 55vh;">
                <div id="asset-categories-grid" class="space-y-4"></div>
            </div>
            
            <div class="p-4 border-t border-white/10 flex justify-between items-center">
                <span class="text-white/50 text-sm"><span id="total-assets-count">0</span> <span id="assets-plural-text">asset sélectionné</span> sur ${Object.values(BACKTEST_ASSET_CATEGORIES).flat().length}</span>
                <button onclick="forgeApplyAssetSelection()" class="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5" style="background: linear-gradient(135deg, #b45309, #d97706);">
                    Appliquer
                </button>
            </div>
        </div>
    `;
    
    // Fermer en cliquant sur le fond
    modal.addEventListener('click', (e) => {
        if (e.target === modal) forgeCloseAssetSelector();
    });
    
    document.body.appendChild(modal);
}

// Ouvrir le sélecteur d'assets
function forgeOpenAssetSelector() {
    forgeEnsureAssetModal();
    const modal = document.getElementById('forge-assets-modal-dynamic');
    if (modal) {
        // Initialiser avec les assets actuellement sélectionnés
        const currentAssets = (forgeState.selectedAssets || '').split(',').filter(Boolean);
        tempSelectedAssets = new Set(currentAssets.map(a => a.replace('USDT', '').toUpperCase()));
        
        modal.classList.remove('hidden');
        forgeRenderAssetCategories();
        forgeUpdateAssetListsDropdown();
        forgeUpdateAssetCounts();
    }
}

// Fermer le sélecteur
function forgeCloseAssetSelector() {
    const modal = document.getElementById('forge-assets-modal-dynamic');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Mettre à jour le dropdown des listes
function forgeUpdateAssetListsDropdown() {
    const select = document.getElementById('asset-lists-select');
    if (!select) return;
    
    const lists = forgeGetSavedAssetLists();
    select.innerHTML = '<option value="">-- Charger --</option>';
    
    Object.keys(lists).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${name} (${lists[name].length})`;
        select.appendChild(opt);
    });
}

// Render les catégories avec checkboxes
function forgeRenderAssetCategories() {
    const container = document.getElementById('asset-categories-grid');
    if (!container) return;
    
    let html = '';
    
    Object.entries(BACKTEST_ASSET_CATEGORIES).forEach(([category, assets]) => {
        const selectedInCategory = assets.filter(a => tempSelectedAssets.has(a.toUpperCase())).length;
        const allSelected = selectedInCategory === assets.length;
        
        html += `
            <div class="rounded-xl p-4" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);">
                <div class="flex items-center gap-3 mb-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" 
                            onchange="forgeToggleCategory('${category}')"
                            ${allSelected ? 'checked' : ''} 
                            class="w-4 h-4 rounded border-white/30 bg-transparent text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500">
                        <span class="text-amber-400 font-semibold">${category}</span>
                        <span class="text-white/40 text-xs">(${selectedInCategory}/${assets.length})</span>
                    </label>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${assets.map(asset => {
                        const isSelected = tempSelectedAssets.has(asset.toUpperCase());
                        return `
                            <label class="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition ${isSelected ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}">
                                <input type="checkbox" 
                                    onchange="forgeToggleAsset('${asset}')"
                                    ${isSelected ? 'checked' : ''}
                                    class="w-3 h-3 rounded border-white/30 bg-transparent focus:ring-amber-500 cursor-pointer accent-amber-500">
                                <span class="text-xs">${asset}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Toggle une catégorie entière
function forgeToggleCategory(category) {
    const assets = BACKTEST_ASSET_CATEGORIES[category] || [];
    const selectedInCategory = assets.filter(a => tempSelectedAssets.has(a.toUpperCase())).length;
    const allSelected = selectedInCategory === assets.length;
    
    if (allSelected) {
        assets.forEach(a => tempSelectedAssets.delete(a.toUpperCase()));
    } else {
        assets.forEach(a => tempSelectedAssets.add(a.toUpperCase()));
    }
    
    forgeRenderAssetCategories();
    forgeUpdateAssetCounts();
}

// Toggle un asset individuel
function forgeToggleAsset(asset) {
    const key = asset.toUpperCase();
    if (tempSelectedAssets.has(key)) {
        tempSelectedAssets.delete(key);
    } else {
        tempSelectedAssets.add(key);
    }
    
    forgeRenderAssetCategories();
    forgeUpdateAssetCounts();
}

// Tout sélectionner
function forgeSelectAllAssets() {
    Object.values(BACKTEST_ASSET_CATEGORIES).flat().forEach(a => {
        tempSelectedAssets.add(a.toUpperCase());
    });
    forgeRenderAssetCategories();
    forgeUpdateAssetCounts();
}

// Tout désélectionner
function forgeDeselectAllAssets() {
    tempSelectedAssets = new Set();
    forgeRenderAssetCategories();
    forgeUpdateAssetCounts();
}

// Mettre à jour les compteurs
function forgeUpdateAssetCounts() {
    const count = tempSelectedAssets.size;
    const countEl = document.getElementById('assets-selected-count');
    const totalEl = document.getElementById('total-assets-count');
    const pluralEl = document.getElementById('assets-plural-text');
    
    if (countEl) countEl.textContent = `(${count} sélectionné${count > 1 ? 's' : ''})`;
    if (totalEl) totalEl.textContent = count;
    if (pluralEl) pluralEl.textContent = count > 1 ? 'assets sélectionnés' : 'asset sélectionné';
}

// Sauvegarder une liste
function forgeSaveAssetList() {
    if (tempSelectedAssets.size === 0) {
        showCenteredModal('Sélectionnez au moins un asset', 'error');
        return;
    }

    showPromptModal('Nom de la liste:', '', (name) => {
        const lists = forgeGetSavedAssetLists();
        lists[name] = Array.from(tempSelectedAssets);
        forgeSaveAssetLists(lists);
        forgeUpdateAssetListsDropdown();
        showCenteredModal(`Liste "${name}" sauvegardée (${tempSelectedAssets.size} assets)`, 'success');
    });
}

// Charger une liste
function forgeLoadAssetList() {
    const select = document.getElementById('asset-lists-select');
    const listName = select?.value;
    if (!listName) return;
    
    const lists = forgeGetSavedAssetLists();
    const assets = lists[listName] || [];
    
    tempSelectedAssets = new Set(assets.map(a => a.toUpperCase()));
    forgeRenderAssetCategories();
    forgeUpdateAssetCounts();
    
    showCenteredModal(`Liste "${listName}" chargée`, 'success');
}

// Supprimer une liste
function forgeDeleteAssetList() {
    const select = document.getElementById('asset-lists-select');
    const listName = select?.value;
    if (!listName) {
        showCenteredModal('Sélectionnez une liste à supprimer', 'error');
        return;
    }
    
    showConfirmModal(`Supprimer la liste "${listName}"?`, () => {
        const lists = forgeGetSavedAssetLists();
        delete lists[listName];
        forgeSaveAssetLists(lists);
        forgeUpdateAssetListsDropdown();
        showCenteredModal(`Liste "${listName}" supprimée`, 'success');
    });
}

// Appliquer la sélection
function forgeApplyAssetSelection() {
    if (tempSelectedAssets.size === 0) {
        showCenteredModal('Sélectionnez au moins un asset', 'error');
        return;
    }
    
    // Assets qui n'ont pas besoin de "USDT" (Forex, Metals)
    const noUsdtSuffix = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'USDCAD', 'XAUUSD', 'XAGUSD'];
    
    // Convertir en format approprié
    const assetsArray = Array.from(tempSelectedAssets).map(a => {
        const upper = a.toUpperCase();
        return noUsdtSuffix.includes(upper) ? upper : upper + 'USDT';
    });
    forgeState.selectedAssets = assetsArray.join(',');
    
    // Mettre à jour le bouton avec affichage intelligent
    const count = tempSelectedAssets.size;
    const countBtn = document.getElementById('forge-assets-count');
    const btn = document.getElementById('forge-assets-btn');
    
    if (countBtn) {
        if (count <= 3) {
            // Afficher les noms
            countBtn.textContent = Array.from(tempSelectedAssets).join(', ');
        } else {
            // Afficher le compteur avec bon pluriel
            countBtn.textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
        }
    }
    
    // Tooltip avec la liste complète
    if (btn) {
        btn.title = Array.from(tempSelectedAssets).join(', ');
    }
    
    forgeCloseAssetSelector();
    showCenteredModal(`${count} asset${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`, 'success');
}


function forgeRenderHistoryList() {
    const tbody = document.getElementById('forge-history-body');
    const countEl = document.getElementById('history-count');
    const loadBestBtn = document.getElementById('load-best-btn');
    if (!tbody) return;
    
    // Récupérer les filtres
    const filterType = document.getElementById('history-filter-type')?.value || 'all';
    const filterFamily = document.getElementById('history-filter-family')?.value || 'all';
    const filterStrategy = document.getElementById('history-filter-strategy')?.value || 'all';
    const sortBy = document.getElementById('history-sort')?.value || 'date-desc';
    
    // Afficher/masquer le bouton "Charger la meilleure" si une stratégie est sélectionnée
    if (loadBestBtn) {
        if (filterStrategy !== 'all') {
            const strategyTests = backtestHistory.filter(bt => bt.strategyName === filterStrategy);
            if (strategyTests.length > 1) {
                loadBestBtn.classList.remove('hidden');
            } else {
                loadBestBtn.classList.add('hidden');
            }
        } else {
            loadBestBtn.classList.add('hidden');
        }
    }
    
    // Filtrer
    let filtered = backtestHistory.filter(bt => {
        if (filterType !== 'all' && bt.mode !== filterType) return false;
        if (filterFamily !== 'all' && bt.strategyFamily !== filterFamily) return false;
        if (filterStrategy !== 'all' && bt.strategyName !== filterStrategy) return false;
        return true;
    });
    
    // Trier
    filtered.sort((a, b) => {
        const aResult = a.mode === 'comparative' ? a.results?.find(r => r.timeframe === a.bestTimeframe) : a.results;
        const bResult = b.mode === 'comparative' ? b.results?.find(r => r.timeframe === b.bestTimeframe) : b.results;
        
        switch(sortBy) {
            case 'date-asc':
                return new Date(a.timestamp) - new Date(b.timestamp);
            case 'score-desc':
                return (b.globalScore || 0) - (a.globalScore || 0);
            case 'score-asc':
                return (a.globalScore || 0) - (b.globalScore || 0);
            case 'profit-desc':
                return (bResult?.total_profit_pct || 0) - (aResult?.total_profit_pct || 0);
            case 'profit-asc':
                return (aResult?.total_profit_pct || 0) - (bResult?.total_profit_pct || 0);
            default: // date-desc
                return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });
    
    // Mettre à jour le compteur
    if (countEl) {
        countEl.textContent = `(${filtered.length}/${backtestHistory.length})`;
    }
    
    // Traduire les familles
    const familyLabels = {
        oscillator: 'Oscillateur',
        trend: 'Tendance',
        momentum: 'Momentum',
        volatility: 'Volatilité',
        volume: 'Volume',
        custom: 'Custom'
    };
    
    // Couleur selon le score
    function getScoreColor(score) {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    }
    
    function getScoreBarColor(score) {
        if (score >= 80) return '#4ade80';
        if (score >= 60) return '#facc15';
        if (score >= 40) return '#fb923c';
        return '#f87171';
    }
    
    if (filtered && filtered.length > 0) {
        tbody.innerHTML = filtered.map(bt => {
            const isComparative = bt.mode === 'comparative';
            const bestResult = isComparative && bt.results ? bt.results.find(r => r.timeframe === bt.bestTimeframe) : bt.results;
            const profit = bestResult?.total_profit_pct || 0;
            const profitClass = profit >= 0 ? 'text-green-400' : 'text-red-400';
            const score = bt.globalScore || bestResult?.score || 0;
            const dateStr = bt.timestamp ? new Date(bt.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
            const family = familyLabels[bt.strategyFamily] || 'Custom';
            
            return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-2 font-medium text-white">${bt.strategyName || 'Sans nom'}</td>
                    <td class="py-3 px-2 text-white/50 text-xs">${family}</td>
                    <td class="py-3 px-2 text-center">
                        <span class="px-2 py-0.5 rounded text-xs ${isComparative ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}">
                            ${isComparative ? 'Comparatif' : 'Simple'}
                        </span>
                    </td>
                    <td class="py-3 px-2 text-center text-white/70">
                        ${isComparative ? `<span class="text-amber-400">â˜…</span> ${bt.bestTimeframe}` : bt.params?.timeframe || '-'}
                    </td>
                    <td class="py-3 px-2 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <div class="w-16 h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.1);">
                                <div class="h-full rounded-full" style="width: ${score}%; background: ${getScoreBarColor(score)};"></div>
                            </div>
                            <span class="${getScoreColor(score)} text-xs font-medium">${score}</span>
                        </div>
                    </td>
                    <td class="py-3 px-2 text-center ${profitClass} font-medium">
                        ${profit >= 0 ? '+' : ''}${profit.toFixed(1)}%
                    </td>
                    <td class="py-3 px-2 text-center text-white/50 text-xs">${bt.params?.period || '-'}</td>
                    <td class="py-3 px-2 text-white/50 text-xs">${dateStr}</td>
                    <td class="py-3 px-2 text-center">
                        <button onclick="forgeLoadFromHistory('${bt.id}')" class="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition">
                            Charger
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-white/40">Aucun historique correspondant aux filtres</td></tr>';
    }
}

function forgeLoadFromHistory(id) {
    const item = backtestHistory.find(h => h.id === id);
    if (!item) return;
    
    // Restaurer les résultats
    if (item.mode === 'comparative') {
        forgeState.comparativeResults = item.results;
        forgeState.backtestResults = null;
        forgeState.bestTimeframe = item.bestTimeframe;
        forgeState.backtestMode = 'comparative';
    } else {
        forgeState.backtestResults = item.results;
        forgeState.comparativeResults = null;
        forgeState.bestTimeframe = null;
        forgeState.backtestMode = 'simple';
        forgeState.selectedTimeframe = item.params?.timeframe || '1h';
    }
    
    forgeState.selectedPeriod = item.params?.period || '3M';
    forgeState.selectedAssets = item.params?.assets || forgeState.selectedAssets;
    forgeState.sourceMeta = { name: item.strategyName };
    
    forgeCloseHistory();
    renderSection();
    showCenteredModal(`Historique "${item.strategyName}" chargé`, 'success');
}

// Charger la meilleure version d'une stratégie sélectionnée
function forgeLoadBestVersion() {
    const filterStrategy = document.getElementById('history-filter-strategy')?.value;
    if (!filterStrategy || filterStrategy === 'all') {
        showCenteredModal('Sélectionnez d\'abord une stratégie', 'error');
        return;
    }
    
    // Filtrer les backtests de cette stratégie
    const strategyTests = backtestHistory.filter(bt => bt.strategyName === filterStrategy);
    if (strategyTests.length === 0) {
        showCenteredModal('Aucun test trouvé pour cette stratégie', 'error');
        return;
    }
    
    // Trouver celui avec le meilleur score
    let best = strategyTests[0];
    strategyTests.forEach(bt => {
        if ((bt.globalScore || 0) > (best.globalScore || 0)) {
            best = bt;
        }
    });
    
    // Charger cette version
    forgeLoadHistoryItem(best.id);
    
    const date = best.timestamp ? new Date(best.timestamp).toLocaleDateString('fr-FR') : '';
    showCenteredModal(`Meilleure version chargée: Score ${best.globalScore || 0} (${date})`, 'success');
}

function forgeExportHistory() {
    if (backtestHistory.length === 0) {
        showCenteredModal('Aucun historique à exporter', 'error');
        return;
    }
    
    const exportData = {
        exportedAt: new Date().toISOString(),
        version: 'v2.9.9',
        count: backtestHistory.length,
        backtests: backtestHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dtego_backtest_history_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showCenteredModal(`${backtestHistory.length} backtests exportés`, 'success');
}

function forgeClearHistory() {
    showConfirmModal('Vider tout l\'historique des backtests?\n\nVous pouvez d\'abord exporter l\'historique en JSON.', () => {
        backtestHistory = [];
        saveBacktestHistory();
        forgeRenderHistoryList();
        showCenteredModal('Historique vidé', 'success');
    });
}

// Charger un item de l'historique dans la Forge
function forgeLoadHistoryItem(id) {
    const item = backtestHistory.find(bt => bt.id === id);
    if (!item) {
        showCenteredModal('Backtest non trouvé', 'error');
        return;
    }
    
    // Charger les données dans forgeState
    forgeState.pineCode = item.pineCode || '';
    forgeState.description = item.description || item.strategyName || '';
    forgeState.strategyType = item.strategyType || 'strategy';
    forgeState.inputMode = item.pineCode ? 'pine' : 'natural';
    forgeState.backtestResults = item.mode === 'simple' ? item.results : null;
    forgeState.comparativeResults = item.mode === 'comparative' ? item.results : null;
    forgeState.bestTimeframe = item.bestTimeframe || null;
    forgeState.selectedPeriod = item.params?.period || '3M';
    forgeState.selectedTimeframe = item.params?.timeframe || '1h';
    forgeState.selectedAssets = item.params?.assets || 'BTCUSDT';
    forgeState.backtestMode = item.mode || 'simple';
    forgeState.sourceMeta = { name: item.strategyName };
    
    forgeCloseHistory();
    renderSection();
    showCenteredModal(`Historique "${item.strategyName}" chargé`, 'success');
}

async function forgeLoadHistory() {
    // Cette fonction n'est plus utilisée (localStorage remplace l'API)
    forgeRenderHistoryList();
}

function renderLibraryCard(item, type) {
    const colors = {
        indicator: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', icon: '#3b82f6' },
        strategy: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', icon: '#10b981' },
        project: { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', icon: '#a855f7' }
    };
    const color = colors[type] || colors.indicator;
    
    const statusColors = {
        active: { bg: 'rgba(74, 222, 128, 0.2)', text: '#4ade80', label: 'Actif' },
        tested: { bg: 'rgba(250, 204, 21, 0.2)', text: '#facc15', label: 'Testé' },
        draft: { bg: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af', label: 'Prototype' },
        archived: { bg: 'rgba(107, 114, 128, 0.2)', text: '#6b7280', label: 'Archivé' }
    };
    const status = statusColors[item.status] || statusColors.draft;
    
    const categoryLabels = {
        momentum: 'Momentum', trend: 'Tendance', volatility: 'Volatilité', volume: 'Volume', support: 'Support/Rés.',
        scalping: 'Scalping', swing: 'Swing', mean: 'Mean Reversion',
        indicator: 'Indicateur', strategy: 'Stratégie'
    };
    
    // Icône selon le type
    const icons = {
        indicator: `<svg class="w-4 h-4" style="color: ${color.icon};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>`,
        strategy: `<svg class="w-4 h-4" style="color: ${color.icon};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>`,
        project: `<svg class="w-4 h-4" style="color: ${color.icon};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>`
    };
    
    // Subtitle selon le type
    const subtitle = `${item.version || 'v5'} ${item.author ? 'â€¢ ' + item.author : ''}`;
    
    // Formatage des dates
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-CA');
    };
    
    // Fonction pour afficher une jauge de score
    const renderScoreGauge = (score) => {
        if (score === null || score === undefined) {
            return '<span class="text-white/30 text-xs">Non évalué</span>';
        }
        let scoreColor;
        if (score < 40) scoreColor = '#ef4444';
        else if (score < 60) scoreColor = '#f97316';
        else if (score < 80) scoreColor = '#eab308';
        else scoreColor = '#22c55e';
        const percentage = Math.min(100, Math.max(0, score));
        return `
            <div class="flex items-center gap-2">
                <div class="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width: ${percentage}%; background: ${scoreColor};"></div>
                </div>
                <span class="text-white font-medium" style="min-width: 24px;">${score}</span>
            </div>
        `;
    };
    
    // Indicateurs de représentation [N] [P] [Py]
    const hasNatural = item.has_natural;
    const hasPine = item.has_pine;
    const hasPython = item.has_python;
    
    const renderFormatBadge = (hasFormat, label, title, color) => {
        return `<span class="px-1.5 py-0.5 rounded text-xs font-mono transition cursor-default" 
            style="background: ${hasFormat ? color + '20' : 'rgba(255,255,255,0.05)'}; 
                   color: ${hasFormat ? color : 'rgba(255,255,255,0.2)'}; 
                   border: 1px solid ${hasFormat ? color + '40' : 'transparent'};"
            title="${title}: ${hasFormat ? 'Disponible' : 'Non disponible'}">${label}</span>`;
    };
    
    // État sélectionné
    const isSelected = selectedLibraryItemId === item.id;
    const selectedStyle = isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-transparent';
    const isFavorite = item.is_favorite;
    
    return `
        <div class="library-card p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition group border ${selectedStyle} hover:border-white/20"
            data-item-id="${item.id}"
            onclick="openLibraryItem('${item.id}', '${type}')">
            
            <!-- Header: Icône type + Format badges + Info -->
            <div class="flex items-start justify-between mb-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: ${color.bg};">
                    ${icons[type]}
                </div>
                
                <!-- Format badges [N] [P] [Py] -->
                <div class="flex items-center gap-1">
                    ${renderFormatBadge(hasNatural, 'N', 'Naturel', '#d97706')}
                    ${renderFormatBadge(hasPine, 'P', 'Pine Script', '#10b981')}
                    ${renderFormatBadge(hasPython, 'Py', 'Python', '#3b82f6')}
                </div>
                
                <!-- Info button -->
                <div class="relative ml-2">
                    <button onclick="event.stopPropagation(); toggleLibraryInfo('${item.id}')" 
                        class="w-7 h-7 rounded-full flex items-center justify-center transition"
                        style="background: rgba(217, 119, 6, 0.15); color: #d97706;">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </button>
                    
                    <!-- Info popover -->
                    <div id="info-popover-${item.id}" class="hidden absolute top-8 right-0 w-72 rounded-xl shadow-2xl border border-white/20 z-50 overflow-hidden"
                        style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                        
                        <div class="p-4 space-y-2 text-xs">
                            <div class="flex justify-between">
                                <span class="text-white/50">Auteur</span>
                                <span class="text-white">${item.author || 'Inconnu'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-white/50">Créé le</span>
                                <span class="text-white">${formatDate(item.created_at)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-white/50">Modifié le</span>
                                <span class="text-white">${formatDate(item.updated_at)}</span>
                            </div>
                        </div>
                        
                        ${type !== 'project' ? `
                        <div class="p-4 space-y-2 text-xs" style="background: rgba(217, 119, 6, 0.05); border-top: 1px solid rgba(217, 119, 6, 0.2);">
                            <div class="text-amber-500 text-xs font-medium mb-2 flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                                Performances
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-white/50">Score Backtest</span>
                                ${renderScoreGauge(item.score_backtest)}
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-white/50">Score Réel</span>
                                ${renderScoreGauge(item.score_real)}
                            </div>
                            
                            <button onclick="event.stopPropagation(); openScoreDetails('${item.id}', '${type}')"
                                class="w-full mt-3 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 transition"
                                style="background: rgba(217, 119, 6, 0.15); border: 1px solid rgba(217, 119, 6, 0.3);">
                                Voir les détails
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Nom + Étoile alignés -->
            <div class="flex items-center gap-2 mb-1">
                <h4 class="font-medium text-sm text-white truncate">${item.name}</h4>
                ${type !== 'project' ? `
                <button onclick="event.stopPropagation(); toggleLibraryFavorite('${item.id}', '${type}')" 
                    class="flex-shrink-0 transition ${isFavorite ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}">
                    <svg class="w-4 h-4 ${isFavorite ? 'text-yellow-400' : 'text-white/50'}" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                </button>
                ` : ''}
            </div>
            
            <p class="text-white/40 text-xs mb-3">${subtitle}</p>
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs px-2 py-0.5 rounded" style="background: ${color.bg}; color: ${color.icon};">
                    ${categoryLabels[item.category] || item.category || type}
                </span>
                <span class="text-xs px-2 py-0.5 rounded" style="background: ${status.bg}; color: ${status.text};">
                    ${status.label}
                </span>
            </div>
            
            <!-- Boutons d'action -->
            <div class="flex gap-2 pt-2 border-t border-white/10 opacity-0 group-hover:opacity-100 transition">
                <button onclick="event.stopPropagation(); openLibraryItemInForge('${item.id}', '${type}')"
                    class="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                    style="background: linear-gradient(135deg, rgba(180, 83, 9, 0.3), rgba(217, 119, 6, 0.2)); color: #d97706;">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Charger
                </button>
                <button onclick="event.stopPropagation(); exportLibraryItem('${item.id}', '${type}')"
                    class="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition"
                    title="Exporter">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
                <button onclick="event.stopPropagation(); deleteLibraryItem('${item.id}', '${type}')"
                    class="px-2 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-red-500/20 hover:text-red-400 transition"
                    title="Supprimer">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
    `;
}

// Fonction de chargement depuis l'API
async function loadLibrary() {
    libraryLoading = true;
    renderSection();
    
    try {
        const params = new URLSearchParams({
            type: 'all',  // On charge tout, filtrage côté client pour rapidité
            format: libraryFormat,
            search: librarySearch,
            sort: librarySort,
            limit: '200'
        });
        
        // FORCER bypass cache avec headers + timestamp
        const response = await fetch(`${API_BASE}/api/library?${params}&_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (data.success) {
            libraryData.items = data.items || [];
            libraryData.total = data.total || 0;
            console.log(`[Library] Loaded ${libraryData.items.length} items`);
        } else {
            console.error('[Library] Load error:', data.error);
            libraryData.items = [];
            libraryData.total = 0;
        }
    } catch (error) {
        console.error('[Library] Load error:', error);
        libraryData.items = [];
        libraryData.total = 0;
    }
    
    libraryLoading = false;
    renderSection();
}

function setLibraryTab(tab) {
    libraryTab = tab;
    libraryCategory = 'all';
    renderSection();
}

function setLibraryCategory(category) {
    libraryCategory = category;
    renderSection();
}

function setLibrarySearch(search) {
    librarySearch = search;
    // Debounce pour éviter trop de requêtes
    clearTimeout(window.librarySearchTimeout);
    window.librarySearchTimeout = setTimeout(() => {
        loadLibrary();
    }, 300);
}

function setLibrarySort(sort) {
    librarySort = sort;
    loadLibrary();
}

function toggleLibrarySortDropdown() {
    const dropdown = document.getElementById('library-sort-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function selectLibrarySort(sort) {
    librarySort = sort;
    const dropdown = document.getElementById('library-sort-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    loadLibrary();
}

// Fermer le dropdown si clic ailleurs
document.addEventListener('click', function(e) {
    if (!e.target.closest('#library-sort-btn') && !e.target.closest('#library-sort-dropdown')) {
        const dropdown = document.getElementById('library-sort-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }
});

function setLibraryFormat(format) {
    libraryFormat = format;
    loadLibrary();
}

async function toggleLibraryFavorite(id, type) {
    try {
        const response = await fetch(`${API_BASE}/api/library/${id}/favorite`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            // Mettre à jour localement
            const item = libraryData.items.find(i => i.id === id);
            if (item) {
                item.is_favorite = data.is_favorite;
            }
            renderSection();
        }
    } catch (error) {
        console.error('[Library] Toggle favorite error:', error);
    }
}

function toggleLibraryInfo(id) {
    // Fermer tous les autres popovers
    document.querySelectorAll('[id^="info-popover-"]').forEach(el => {
        if (el.id !== `info-popover-${id}`) {
            el.classList.add('hidden');
        }
    });
    
    // Toggle le popover actuel
    const popover = document.getElementById(`info-popover-${id}`);
    if (popover) {
        popover.classList.toggle('hidden');
    }
}

function openScoreDetails(id, type) {
    // Fermer le popover
    document.querySelectorAll('[id^="info-popover-"]').forEach(el => el.classList.add('hidden'));
    
    const item = libraryData[type].find(i => i.id === id);
    if (!item) return;
    
    // Définir les critères selon le type
    const isIndicator = type === 'indicators';
    const criteriaLabels = isIndicator ? {
        precision: { label: 'Précision des signaux', desc: '% de signaux profitables' },
        falsePositives: { label: 'Taux de faux positifs', desc: 'Signaux sans résultat (inversé)' },
        timing: { label: 'Timing', desc: 'Délai signal â†’ mouvement' },
        consistency: { label: 'Consistance', desc: 'Performance multi-marchés' },
        clarity: { label: 'Clarté', desc: 'Netteté des signaux' }
    } : {
        winRate: { label: 'Win Rate', desc: '% de trades gagnants' },
        profitFactor: { label: 'Profit Factor', desc: 'Gains / Pertes' },
        sharpe: { label: 'Sharpe Ratio', desc: 'Rendement ajusté au risque' },
        maxDrawdown: { label: 'Max Drawdown', desc: 'Protection contre pertes (inversé)' },
        avgDuration: { label: 'Durée moyenne', desc: 'Efficacité temporelle' },
        consistency: { label: 'Consistance', desc: 'Régularité des profits' }
    };
    
    // Fonction pour générer une barre de score
    const renderScoreBar = (score, label, desc) => {
        if (score === null || score === undefined) {
            return `
                <div class="flex items-center justify-between py-2">
                    <div>
                        <div class="text-white text-sm">${label}</div>
                        <div class="text-white/40 text-xs">${desc}</div>
                    </div>
                    <span class="text-white/30 text-sm">N/A</span>
                </div>
            `;
        }
        
        let color;
        if (score < 40) color = '#ef4444';
        else if (score < 60) color = '#f97316';
        else if (score < 80) color = '#eab308';
        else color = '#22c55e';
        
        return `
            <div class="py-2">
                <div class="flex items-center justify-between mb-1">
                    <div>
                        <div class="text-white text-sm">${label}</div>
                        <div class="text-white/40 text-xs">${desc}</div>
                    </div>
                    <span class="text-white font-semibold">${score}</span>
                </div>
                <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width: ${score}%; background: ${color};"></div>
                </div>
            </div>
        `;
    };
    
    // Générer les barres de score
    let criteriaHtml = '';
    if (item.scores) {
        Object.entries(criteriaLabels).forEach(([key, { label, desc }]) => {
            criteriaHtml += renderScoreBar(item.scores[key], label, desc);
        });
    } else {
        criteriaHtml = '<div class="text-white/50 text-center py-8">Aucune évaluation disponible.<br>Lancez un backtest pour obtenir un score.</div>';
    }
    
    // Score global avec grande jauge
    const renderGlobalScore = (score, label) => {
        if (score === null || score === undefined) {
            return `
                <div class="text-center">
                    <div class="text-white/50 text-sm mb-2">${label}</div>
                    <div class="text-white/30 text-2xl font-light">Non évalué</div>
                </div>
            `;
        }
        
        let color;
        if (score < 40) color = '#ef4444';
        else if (score < 60) color = '#f97316';
        else if (score < 80) color = '#eab308';
        else color = '#22c55e';
        
        return `
            <div class="text-center">
                <div class="text-white/50 text-sm mb-2">${label}</div>
                <div class="text-4xl font-bold mb-2" style="color: ${color};">${score}</div>
                <div class="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width: ${score}%; background: ${color};"></div>
                </div>
            </div>
        `;
    };
    
    // Créer la modale
    const modal = document.createElement('div');
    modal.id = 'score-details-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity opacity-0';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 transform scale-95 transition-all"
            style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); max-height: 90vh; overflow-y: auto;">
            
            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                    <h3 class="text-white font-semibold text-lg">${item.name}</h3>
                    <p class="text-white/50 text-sm">${isIndicator ? 'Indicateur' : 'Stratégie'} â€¢ ${item.category}</p>
                </div>
                <button onclick="document.getElementById('score-details-modal').remove()"
                    class="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <!-- Scores globaux -->
            <div class="grid grid-cols-2 gap-4 p-5 border-b border-white/10">
                ${renderGlobalScore(item.scoreBacktest, 'Score Backtest')}
                ${renderGlobalScore(item.scoreReal, 'Score Réel')}
            </div>
            
            <!-- Détails des critères -->
            <div class="p-5">
                <h4 class="text-white/70 text-sm font-medium mb-3">Détails des critères</h4>
                <div class="divide-y divide-white/5">
                    ${criteriaHtml}
                </div>
            </div>
            
            <!-- Footer -->
            <div class="p-5 border-t border-white/10 bg-white/5">
                <p class="text-white/40 text-xs text-center">
                    Les scores sont calculés automatiquement sur base des performances ${item.scoreReal ? 'historiques et réelles' : 'historiques'}.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animation d'entrée
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    });
}

// Fermer les popovers info quand on clique ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.library-card')) {
        document.querySelectorAll('[id^="info-popover-"]').forEach(el => {
            el.classList.add('hidden');
        });
    }
});

async function openLibraryItem(id, type) {
    try {
        const response = await fetch(`${API_BASE}/api/library/${id}?_t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success && data.item) {
            // Afficher le détail dans une modale
            showLibraryItemDetail(data.item);
        } else {
            showCenteredModal('Élément non trouvé', 'error');
        }
    } catch (error) {
        console.error('[Library] Open item error:', error);
        showCenteredModal('Erreur de chargement', 'error');
    }
}

function showLibraryItemDetail(item) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const typeLabels = { indicator: 'Indicateur', strategy: 'Stratégie', project: 'Projet' };
    
    modal.innerHTML = `
        <div class="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl border border-white/20"
            style="background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
            <div class="p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white font-semibold text-lg">${item.name}</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-white/50 hover:text-white">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="flex gap-2 mb-4">
                    <span class="px-2 py-1 rounded text-xs" style="background: rgba(217, 119, 6, 0.2); color: #d97706;">${typeLabels[item.type] || item.type}</span>
                    <span class="px-2 py-1 rounded text-xs bg-white/10 text-white/70">${item.category || '-'}</span>
                    <span class="px-2 py-1 rounded text-xs bg-white/10 text-white/70">${item.version || 'v5'}</span>
                </div>
                
                ${item.description ? `
                <div class="mb-4">
                    <h4 class="text-white/50 text-xs mb-2">Description</h4>
                    <p class="text-white/80 text-sm bg-white/5 p-3 rounded-lg">${item.description.substring(0, 500)}${item.description.length > 500 ? '...' : ''}</p>
                </div>
                ` : ''}
                
                ${item.pine_code ? `
                <div class="mb-4">
                    <h4 class="text-white/50 text-xs mb-2">Pine Script</h4>
                    <pre class="text-green-400 text-xs bg-white/5 p-3 rounded-lg overflow-x-auto max-h-40">${escapeHtml(item.pine_code.substring(0, 1000))}${item.pine_code.length > 1000 ? '\n...' : ''}</pre>
                </div>
                ` : ''}
                
                ${item.python_code ? `
                <div class="mb-4">
                    <h4 class="text-white/50 text-xs mb-2">Python</h4>
                    <pre class="text-blue-400 text-xs bg-white/5 p-3 rounded-lg overflow-x-auto max-h-40">${escapeHtml(item.python_code.substring(0, 1000))}${item.python_code.length > 1000 ? '\n...' : ''}</pre>
                </div>
                ` : ''}
                
                <div class="flex gap-2 pt-4 border-t border-white/10">
                    <button onclick="this.closest('.fixed').remove(); loadLibraryItemInForge('${item.id}')" 
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition"
                        style="background: linear-gradient(135deg, #b45309, #d97706); color: white;">
                        Charger dans l'Atelier
                    </button>
                    <button onclick="this.closest('.fixed').remove(); exportLibraryItem('${item.id}', '${item.type}')" 
                        class="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 transition">
                        Exporter
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function openLibraryItemInForge(id, type) {
    await loadLibraryItemInForge(id);
}

async function loadLibraryItemInForge(id) {
    try {
        const response = await fetch(`${API_BASE}/api/library/${id}?_t=${Date.now()}`);
        const data = await response.json();
        
        if (!data.success || !data.item) {
            showCenteredModal('Élément non trouvé', 'error');
            return;
        }
        
        const item = data.item;
        
        // Charger dans la Forge (Atelier Convertir)
        forgeState.pineCode = item.pine_code || '';
        forgeState.pythonCode = item.python_code || '';
        forgeState.description = item.description || item.name || '';
        forgeState.strategyType = item.type === 'strategy' ? 'strategy' : 'indicator';
        forgeState.inputMode = item.pine_code ? 'pine' : (item.description ? 'natural' : 'python');
        forgeState.backtestResults = null;
        forgeState.aiAnalysis = null;
        forgeState.conversationHistory = [];
        forgeState.refinement = '';
        
        // Stocker la source pour traçabilité
        forgeState.source = 'library';
        forgeState.sourceId = id;
        forgeState.sourceMeta = {
            name: item.name,
            author: item.author,
            version: item.version,
            category: item.category
        };
        
        // Naviguer vers l'Atelier Convertir
        forgeState.atelierMode = 'convert';
        currentSection = 'atelier';
        renderSection();
        showCenteredModal(`"${item.name}" chargé dans l'Atelier`, 'success');
        
    } catch (error) {
        console.error('[Library] Load in forge error:', error);
        showCenteredModal('Erreur de chargement', 'error');
    }
}

function goToConverter() {
    currentSection = 'converter';
    renderSection();
}

// =====================================================
// renderLab() - COMMENTÉ (retiré du menu System)
// =====================================================

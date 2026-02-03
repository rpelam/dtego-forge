// ============================================================================
// SESSION 41: FONCTIONS JAVASCRIPT IMPORT PINE SCRIPT
// À ajouter AVANT la fermeture </body> dans bibliotheque.html
// ============================================================================

// Configuration API
const API_BASE = 'https://api.dtego.net';

// État global import
let currentImportData = null;

// ============================================================================
// GESTION MODES PASTE/FILE
// ============================================================================

function showPasteMode() {
    document.getElementById('pasteMode').classList.remove('hidden');
    document.getElementById('fileMode').classList.add('hidden');
    document.getElementById('btnPasteMode').classList.remove('bg-white/10', 'hover:bg-white/20');
    document.getElementById('btnPasteMode').classList.add('bg-purple-500', 'hover:bg-purple-600');
    document.getElementById('btnFileMode').classList.add('bg-white/10', 'hover:bg-white/20');
    document.getElementById('btnFileMode').classList.remove('bg-purple-500', 'hover:bg-purple-600');
}

function showFileMode() {
    document.getElementById('pasteMode').classList.add('hidden');
    document.getElementById('fileMode').classList.remove('hidden');
    document.getElementById('btnFileMode').classList.remove('bg-white/10', 'hover:bg-white/20');
    document.getElementById('btnFileMode').classList.add('bg-purple-500', 'hover:bg-purple-600');
    document.getElementById('btnPasteMode').classList.add('bg-white/10', 'hover:bg-white/20');
    document.getElementById('btnPasteMode').classList.remove('bg-purple-500', 'hover:bg-purple-600');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    const btnImport = document.getElementById('btnImportFile');
    
    if (file) {
        btnImport.disabled = false;
        btnImport.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnImport.disabled = true;
        btnImport.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// ============================================================================
// IMPORT PINE CODE (MODE PASTE)
// ============================================================================

async function importPineCode() {
    const pineCode = document.getElementById('pineCodeInput').value.trim();
    const name = document.getElementById('strategyName').value.trim();
    
    // Validation
    if (!pineCode) {
        showError('Veuillez coller du code Pine Script');
        return;
    }
    
    if (!name) {
        showError('Veuillez entrer un nom de stratégie');
        return;
    }
    
    // Afficher modal analyse
    showAnalysisModal();
    
    try {
        // Étape 1: Pattern recognition (25%)
        updateAnalysisProgress(25, 'Détection des indicateurs...');
        await sleep(500);
        
        // Étape 2: Décomposition atomes (50%)
        updateAnalysisProgress(50, 'Décomposition en atomes...');
        await sleep(500);
        
        // Étape 3: Validation conversion (75%)
        updateAnalysisProgress(75, 'Validation de la conversion Python...');
        
        // Appel API
        const response = await fetch(`${API_BASE}/api/library/import-pine`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pine_code: pineCode,
                name: name,
                auto_approve_threshold: 0.85
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de l\'import');
        }
        
        const result = await response.json();
        
        // Étape 4: Terminé (100%)
        updateAnalysisProgress(100, 'Analyse terminée!');
        await sleep(300);
        
        // Masquer modal analyse
        hideAnalysisModal();
        
        // Stocker données
        currentImportData = result;
        
        // Afficher résultats
        showResultsModal(result);
        
    } catch (error) {
        console.error('Erreur import:', error);
        hideAnalysisModal();
        showError(`Erreur: ${error.message}`);
    }
}

// ============================================================================
// IMPORT PINE FILE (MODE FILE)
// ============================================================================

async function importPineFile() {
    const fileInput = document.getElementById('pineFileInput');
    const name = document.getElementById('strategyNameFile').value.trim();
    
    if (!fileInput.files[0]) {
        showError('Veuillez sélectionner un fichier');
        return;
    }
    
    if (!name) {
        showError('Veuillez entrer un nom de stratégie');
        return;
    }
    
    // Lire fichier
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const pineCode = e.target.result;
        
        // Remplir textarea (mode paste) et lancer import
        document.getElementById('pineCodeInput').value = pineCode;
        document.getElementById('strategyName').value = name;
        
        // Basculer en mode paste et importer
        showPasteMode();
        await importPineCode();
    };
    
    reader.onerror = () => {
        showError('Erreur lors de la lecture du fichier');
    };
    
    reader.readAsText(file);
}

// ============================================================================
// MODAL ANALYSE
// ============================================================================

function showAnalysisModal() {
    const modal = document.getElementById('analysisModal');
    modal.classList.remove('hidden');
    
    // Reset progression
    updateAnalysisProgress(0, 'Initialisation...');
    
    // Étapes statiques
    const stepsHtml = `
        <div class="flex items-center gap-3 text-gray-400">
            <div class="w-6 h-6 rounded-full border-2 border-purple-500 flex items-center justify-center">
                <div class="w-3 h-3 rounded-full bg-purple-500"></div>
            </div>
            <span>Parsing du code Pine Script</span>
        </div>
        <div class="flex items-center gap-3 text-gray-400">
            <div class="w-6 h-6 rounded-full border-2 border-gray-600"></div>
            <span>Pattern recognition indicateurs</span>
        </div>
        <div class="flex items-center gap-3 text-gray-400">
            <div class="w-6 h-6 rounded-full border-2 border-gray-600"></div>
            <span>Décomposition en atomes</span>
        </div>
        <div class="flex items-center gap-3 text-gray-400">
            <div class="w-6 h-6 rounded-full border-2 border-gray-600"></div>
            <span>Génération code Python</span>
        </div>
        <div class="flex items-center gap-3 text-gray-400">
            <div class="w-6 h-6 rounded-full border-2 border-gray-600"></div>
            <span>Validation multi-niveaux</span>
        </div>
    `;
    
    document.getElementById('analysisSteps').innerHTML = stepsHtml;
}

function hideAnalysisModal() {
    document.getElementById('analysisModal').classList.add('hidden');
}

function updateAnalysisProgress(percent, message) {
    document.getElementById('analysisProgress').style.width = `${percent}%`;
    document.getElementById('analysisProgressText').textContent = message;
}

// ============================================================================
// MODAL RÉSULTATS
// ============================================================================

function showResultsModal(data) {
    const modal = document.getElementById('resultsModal');
    modal.classList.remove('hidden');
    
    // Score confiance
    const confidence = (data.confidence_score * 100).toFixed(0);
    document.getElementById('confidenceScore').textContent = `${confidence}%`;
    document.getElementById('confidenceBar').style.width = `${confidence}%`;
    
    // Message confiance
    let confidenceMessage = '';
    let confidenceClass = '';
    
    if (data.confidence_score >= 0.85) {
        confidenceMessage = '✅ Conversion approuvée automatiquement - Haute confiance';
        confidenceClass = 'text-emerald-400';
    } else if (data.confidence_score >= 0.65) {
        confidenceMessage = '⚠️ Révision recommandée - Confiance moyenne';
        confidenceClass = 'text-amber-400';
    } else {
        confidenceMessage = '❌ Révision requise - Confiance faible';
        confidenceClass = 'text-red-400';
    }
    
    const msgEl = document.getElementById('confidenceMessage');
    msgEl.textContent = confidenceMessage;
    msgEl.className = `text-sm mt-3 text-center font-medium ${confidenceClass}`;
    
    // Indicateurs détectés
    const indicatorsHtml = data.indicators_detected.map(ind => {
        const indConfidence = (ind.confidence * 100).toFixed(0);
        return `
            <div class="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-white text-lg">${ind.indicator}</span>
                    <span class="text-emerald-400 text-sm font-medium">${indConfidence}%</span>
                </div>
                <div class="text-gray-400 text-sm">
                    ${Object.keys(ind.parameters).length} paramètre(s) détecté(s)
                </div>
                ${ind.atoms && ind.atoms.length > 0 ? `
                    <div class="mt-2 text-blue-400 text-xs font-medium">
                        ${ind.atoms.length} atome(s)
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    document.getElementById('indicatorsList').innerHTML = indicatorsHtml;
    
    // Statistiques atomes
    const totalAtoms = data.atoms_created + data.atoms_reused;
    document.getElementById('atomsTotal').textContent = totalAtoms;
    document.getElementById('atomsReusable').textContent = data.atoms_reused;
    document.getElementById('reuseRate').textContent = `${(data.reuse_rate * 100).toFixed(0)}%`;
}

function closeResultsModal() {
    document.getElementById('resultsModal').classList.add('hidden');
}

// ============================================================================
// MODAL DÉTAILS TECHNIQUES
// ============================================================================

function showDetailsModal() {
    if (!currentImportData) return;
    
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('hidden');
    
    // Générer détails pour chaque indicateur
    const detailsHtml = currentImportData.indicators_detected.map(ind => {
        const atomsHtml = ind.atoms && ind.atoms.length > 0 ? 
            ind.atoms.map((atom, idx) => `
                <div class="bg-gray-800/50 border border-white/10 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-mono text-purple-400 text-sm">${atom.atom_type}</span>
                        <span class="text-gray-500 text-xs">Niveau ${atom.level || 1}</span>
                    </div>
                    <p class="text-gray-300 text-sm mb-3">${atom.description}</p>
                    <div class="space-y-2">
                        <div>
                            <div class="text-gray-500 text-xs mb-1">Pine Script:</div>
                            <code class="block bg-black/50 text-green-400 text-xs p-2 rounded font-mono overflow-x-auto">
                                ${atom.pine_code}
                            </code>
                        </div>
                        <div>
                            <div class="text-gray-500 text-xs mb-1">Python:</div>
                            <code class="block bg-black/50 text-blue-400 text-xs p-2 rounded font-mono overflow-x-auto">
                                ${atom.python_code}
                            </code>
                        </div>
                    </div>
                </div>
            `).join('') :
            '<p class="text-gray-400 text-sm">Aucun atome disponible</p>';
        
        return `
            <div class="border border-blue-500/30 rounded-xl p-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
                <h4 class="text-2xl font-bold text-white mb-4">${ind.indicator}</h4>
                <div class="mb-4">
                    <span class="text-gray-400 text-sm">Paramètres:</span>
                    <code class="ml-2 text-amber-400 text-sm font-mono">
                        ${JSON.stringify(ind.parameters)}
                    </code>
                </div>
                <div class="space-y-3">
                    ${atomsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('detailsContent').innerHTML = detailsHtml;
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.add('hidden');
}

// ============================================================================
// ACTIONS RÉSULTATS
// ============================================================================

async function approveImport() {
    if (!currentImportData || !currentImportData.item_id) {
        showError('Aucune donnée d\'import disponible');
        return;
    }
    
    try {
        // Si déjà approved, juste recharger
        if (currentImportData.validation_status === 'approved') {
            closeResultsModal();
            showSuccess('✅ Stratégie ajoutée à la bibliothèque!');
            
            // Recharger liste bibliothèque
            await loadLibraryItems();
            
            // Reset formulaire
            document.getElementById('pineCodeInput').value = '';
            document.getElementById('strategyName').value = '';
            
            return;
        }
        
        // Sinon, approuver via API
        const response = await fetch(`${API_BASE}/api/library/items/${currentImportData.item_id}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de l\'approbation');
        }
        
        closeResultsModal();
        showSuccess('✅ Stratégie approuvée et ajoutée!');
        
        await loadLibraryItems();
        
        document.getElementById('pineCodeInput').value = '';
        document.getElementById('strategyName').value = '';
        
    } catch (error) {
        console.error('Erreur approbation:', error);
        showError(`Erreur: ${error.message}`);
    }
}

async function rejectImport() {
    if (!currentImportData || !currentImportData.item_id) {
        showError('Aucune donnée d\'import disponible');
        return;
    }
    
    if (!confirm('Êtes-vous sûr de vouloir rejeter cette importation ?')) {
        return;
    }
    
    try {
        // Supprimer l'item
        const response = await fetch(`${API_BASE}/api/library/items/${currentImportData.item_id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du rejet');
        }
        
        closeResultsModal();
        showSuccess('❌ Importation rejetée');
        
        // Reset formulaire
        document.getElementById('pineCodeInput').value = '';
        document.getElementById('strategyName').value = '';
        
    } catch (error) {
        console.error('Erreur rejet:', error);
        showError(`Erreur: ${error.message}`);
    }
}

// ============================================================================
// UTILITAIRES
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showError(message) {
    // Utiliser système notification existant ou créer toast
    alert('❌ ' + message);
}

function showSuccess(message) {
    // Utiliser système notification existant ou créer toast
    alert('✅ ' + message);
}

// Note: loadLibraryItems() est déjà définie dans bibliotheque.html
// On la réutilise directement pour recharger la bibliothèque

// ============================================================================
// INITIALISATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Mode paste par défaut
    showPasteMode();
    
    console.log('✅ Session 41 - Import Pine Script UI initialisé');
});

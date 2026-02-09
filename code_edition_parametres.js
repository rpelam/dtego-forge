// ============================================================================
// SESSION 39 - ÉDITION PARAMÈTRES
// À ajouter dans dtego-forge/bibliotheque.html dans la section <script>
// ============================================================================

// FONCTION 1: Éditer paramètres d'un filtre
async function editParameters(itemId) {
    try {
        // 1. Charger le filtre depuis Supabase
        const { data: item, error } = await supabase
            .from('library_items')
            .select('*')
            .eq('id', itemId)
            .single();
        
        if (error) throw error;
        
        // 2. Appeler endpoint extraction
        showLoadingModal('Analyse des paramètres...');
        
        const response = await fetch('https://api.dtego.net/api/forge/analyze-granule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pine_code: item.pine_code || '',
                filter_name: item.name
            })
        });
        
        const result = await response.json();
        hideLoadingModal();
        
        if (!result.success) {
            throw new Error(result.error || 'Erreur extraction');
        }
        
        // 3. Générer interface avec paramètres
        showParameterEditor(item, result.parameter_schema);
        
    } catch (error) {
        console.error('Erreur édition paramètres:', error);
        hideLoadingModal();
        alert('Erreur lors de l\'édition des paramètres: ' + error.message);
    }
}

// FONCTION 2: Afficher modal éditeur paramètres
function showParameterEditor(item, schema) {
    const modal = document.createElement('div');
    modal.id = 'parameterEditorModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    
    const parameters = schema.parameters || [];
    let currentValues = {};
    
    // Initialiser valeurs actuelles
    parameters.forEach(param => {
        currentValues[param.id] = param.default;
    });
    
    modal.innerHTML = `
        <div class="bg-gradient-to-br from-gray-900/95 to-gray-800/95 border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Éditer Paramètres</h2>
                <button onclick="closeParameterEditor()" class="text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <div class="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p class="text-amber-200 text-sm">${item.name}</p>
            </div>
            
            <div id="parametersContainer" class="space-y-4 mb-6">
                ${generateParameterInputs(parameters, currentValues)}
            </div>
            
            <div class="mb-6 p-4 bg-gray-800/50 rounded-lg">
                <h3 class="text-white font-semibold mb-2">Preview Code</h3>
                <pre id="codePreview" class="text-green-400 text-sm overflow-x-auto">${generateCodePreview(parameters, currentValues)}</pre>
            </div>
            
            <div class="flex gap-3">
                <button onclick="closeParameterEditor()" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                    Annuler
                </button>
                <button onclick="saveParameters('${item.id}')" class="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition font-semibold">
                    Sauvegarder
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Stocker valeurs courantes globalement
    window.currentParameterValues = currentValues;
    window.currentParameterItem = item;
    window.currentParameterSchema = schema;
}

// FONCTION 3: Générer inputs paramètres
function generateParameterInputs(parameters, values) {
    return parameters.map(param => {
        const value = values[param.id];
        
        if (param.type === 'int' || param.type === 'float') {
            const step = param.step || (param.type === 'int' ? 1 : 0.01);
            return `
                <div class="parameter-group">
                    <label class="block text-white font-medium mb-2">${param.label}</label>
                    <p class="text-gray-400 text-sm mb-2">${param.description}</p>
                    <div class="flex items-center gap-4">
                        <input type="range" 
                               id="slider_${param.id}" 
                               min="${param.min}" 
                               max="${param.max}" 
                               step="${step}"
                               value="${value}"
                               onchange="updateParameter('${param.id}', this.value)"
                               class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb">
                        <input type="number" 
                               id="input_${param.id}"
                               min="${param.min}" 
                               max="${param.max}" 
                               step="${step}"
                               value="${value}"
                               onchange="updateParameter('${param.id}', this.value)"
                               class="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center">
                    </div>
                </div>
            `;
        } else if (param.type === 'bool') {
            return `
                <div class="parameter-group">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" 
                               id="input_${param.id}"
                               ${value ? 'checked' : ''}
                               onchange="updateParameter('${param.id}', this.checked)"
                               class="w-5 h-5 rounded border-gray-600 bg-gray-700 text-amber-500">
                        <div>
                            <p class="text-white font-medium">${param.label}</p>
                            <p class="text-gray-400 text-sm">${param.description}</p>
                        </div>
                    </label>
                </div>
            `;
        } else if (param.type === 'string') {
            return `
                <div class="parameter-group">
                    <label class="block text-white font-medium mb-2">${param.label}</label>
                    <p class="text-gray-400 text-sm mb-2">${param.description}</p>
                    <input type="text" 
                           id="input_${param.id}"
                           value="${value}"
                           onchange="updateParameter('${param.id}', this.value)"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white">
                </div>
            `;
        }
    }).join('');
}

// FONCTION 4: Mettre à jour paramètre
function updateParameter(paramId, value) {
    window.currentParameterValues[paramId] = value;
    
    // Synchroniser slider et input
    const slider = document.getElementById(`slider_${paramId}`);
    const input = document.getElementById(`input_${paramId}`);
    
    if (slider) slider.value = value;
    if (input) input.value = value;
    
    // Mettre à jour preview
    const preview = document.getElementById('codePreview');
    if (preview) {
        preview.textContent = generateCodePreview(
            window.currentParameterSchema.parameters,
            window.currentParameterValues
        );
    }
}

// FONCTION 5: Générer preview code
function generateCodePreview(parameters, values) {
    return parameters.map(param => {
        const value = values[param.id];
        const displayValue = param.type === 'string' ? `"${value}"` : value;
        return `${param.type} ${param.id} = ${displayValue}`;
    }).join('\n');
}

// FONCTION 6: Sauvegarder paramètres
async function saveParameters(itemId) {
    try {
        const updatedCode = generateCodePreview(
            window.currentParameterSchema.parameters,
            window.currentParameterValues
        );
        
        // Mettre à jour dans Supabase
        const { error } = await supabase
            .from('library_items')
            .update({
                pine_code: updatedCode,
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId);
        
        if (error) throw error;
        
        closeParameterEditor();
        alert('Paramètres sauvegardés avec succès!');
        loadLibraryItems(); // Recharger la liste
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        alert('Erreur lors de la sauvegarde: ' + error.message);
    }
}

// FONCTION 7: Fermer modal
function closeParameterEditor() {
    const modal = document.getElementById('parameterEditorModal');
    if (modal) modal.remove();
    
    window.currentParameterValues = null;
    window.currentParameterItem = null;
    window.currentParameterSchema = null;
}

// FONCTION 8: Loading modal helpers
function showLoadingModal(message) {
    const modal = document.createElement('div');
    modal.id = 'loadingModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-gray-900 border border-white/10 rounded-2xl p-8 text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p class="text-white">${message}</p>
        </div>
    `;
    document.body.appendChild(modal);
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.remove();
}

// FONCTION 9: Ajouter bouton "Éditer" dans la liste des items
// Modifier la fonction renderLibraryItems existante pour ajouter le bouton
// Dans le HTML de chaque item, ajouter:
/*
<button onclick="editParameters('${item.id}')" 
        class="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 rounded-lg text-sm transition">
    Éditer Paramètres
</button>
*/

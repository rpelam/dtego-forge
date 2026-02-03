// Session 41: Import Pine Script (Version minimaliste)
const API_BASE = 'https://api.dtego.net';

async function importPineCode() {
    const pineCode = document.getElementById('pineCodeInput').value.trim();
    const name = document.getElementById('strategyName').value.trim();
    
    if (!pineCode || !name) {
        alert('❌ Code Pine et nom requis');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/library/import-pine`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({pine_code: pineCode, name: name})
        });
        
        if (!response.ok) throw new Error('Erreur API');
        
        const result = await response.json();
        
        alert(`✅ Stratégie importée!\n\nIndicateurs détectés: ${result.indicators_detected?.length || 0}\nConfiance: ${(result.confidence_score * 100).toFixed(0)}%`);
        
        // Recharger bibliothèque
        if (typeof loadLibraryItems === 'function') {
            await loadLibraryItems();
        }
        
        // Reset
        document.getElementById('pineCodeInput').value = '';
        document.getElementById('strategyName').value = '';
        
    } catch (error) {
        alert('❌ Erreur: ' + error.message);
    }
}

console.log('✅ Session 41 Import Pine chargé');

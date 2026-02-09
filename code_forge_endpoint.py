# ============================================================================
# ENDPOINT: /api/forge/analyze-granule (Session 38)
# À ajouter dans ~/Desktop/PROJET DTEGO/dtego-api/routes/forge.py
# ============================================================================

@forge_bp.route('/analyze-granule', methods=['POST'])
def analyze_granule():
    """Extrait les paramètres éditables d'un code Pine Script via Claude API"""
    try:
        data = request.get_json()
        pine_code = data.get('pine_code', '')
        filter_name = data.get('filter_name', 'Filtre')
        
        if not pine_code:
            return jsonify({'success': False, 'error': 'pine_code manquant'}), 400
        
        # Charger prompt system
        prompt_system = _load_extraction_prompt_system()
        
        # Message pour Claude
        user_message = f"""Analyse ce filtre Pine Script et extrait les paramètres éditables.

**Filtre:** {filter_name}

**Code Pine:**
```pine
{pine_code}
```

Retourne UNIQUEMENT le JSON des paramètres éditables selon le format spécifié."""
        
        # Appeler Claude API
        response = call_claude_forge_api(
            system_prompt=prompt_system,
            user_message=user_message,
            max_tokens=2000,
            temperature=0.0
        )
        
        # Parser JSON
        import json
        import re
        
        json_match = re.search(r'\{[\s\S]*"parameters"[\s\S]*\}', response)
        
        if not json_match:
            return jsonify({
                'success': False,
                'error': 'Format JSON invalide',
                'raw_response': response
            }), 500
        
        parameter_schema = json.loads(json_match.group(0))
        
        # Validation
        if 'parameters' not in parameter_schema:
            return jsonify({'success': False, 'error': 'Clé "parameters" manquante'}), 500
        
        for param in parameter_schema['parameters']:
            required = ['id', 'type', 'default', 'label', 'description']
            for field in required:
                if field not in param:
                    return jsonify({
                        'success': False,
                        'error': f'Champ "{field}" manquant'
                    }), 500
            
            if param['type'] in ['int', 'float']:
                if 'min' not in param or 'max' not in param:
                    return jsonify({
                        'success': False,
                        'error': f'min/max manquants pour {param["id"]}'
                    }), 500
        
        return jsonify({
            'success': True,
            'parameter_schema': parameter_schema,
            'filter_name': filter_name
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _load_extraction_prompt_system():
    """Charge le prompt system d'extraction"""
    import os
    
    prompt_path = os.path.join(
        os.path.dirname(__file__),
        '..',
        'prompts',
        'extraction_granules_system.txt'
    )
    
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        # Fallback inline
        return """Tu es un expert en analyse de code Pine Script pour Dtego.
Extrais UNIQUEMENT les paramètres éditables (input.int, input.float, constantes configurables).
NE PAS extraire les variables calculées (var, ta., request.security).
Retourne JSON: {"parameters": [{id, type, default, min, max, step, label, description}]}"""

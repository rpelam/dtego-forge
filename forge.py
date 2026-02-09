"""
Forge routes for DTEGO API
Routes: /api/forge/projects, /api/forge/chat, /api/forge/generate, /api/forge/versions, /api/forge/parse, /api/forge/convert
"""
import os
import json
import logging
import requests
from datetime import datetime
from flask import Blueprint, request, jsonify

from shared.config import SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

forge_bp = Blueprint('forge', __name__)


# --- FORGE: Liste des projets ---
@forge_bp.route('/api/forge/projects', methods=['GET'])
def forge_list_projects():
    """Liste tous les projets Forge actifs."""
    try:
        status_filter = request.args.get('status', 'active')

        url = f"{SUPABASE_URL}/rest/v1/forge_projects?status=eq.{status_filter}&order=updated_at.desc"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            projects = response.json()
            return jsonify({
                'success': True,
                'projects': projects,
                'count': len(projects)
            })
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error listing projects: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Nettoyer les projets de test ---
@forge_bp.route('/api/forge/cleanup-test-projects', methods=['POST'])
def forge_cleanup_test_projects():
    """Supprime tous les projets dont le nom contient 'test' (case insensitive)."""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }

        # Recuperer tous les projets de test
        get_url = f"{SUPABASE_URL}/rest/v1/forge_projects?name=ilike.*test*&status=eq.active"
        get_response = requests.get(get_url, headers=headers, timeout=10)

        if get_response.status_code != 200:
            return jsonify({'success': False, 'error': 'Erreur de recuperation'}), 500

        projects = get_response.json()
        deleted_count = 0

        for project in projects:
            # Supprimer les messages du projet
            msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project['id']}"
            requests.delete(msg_url, headers=headers, timeout=10)

            # Supprimer les versions du projet
            ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions?project_id=eq.{project['id']}"
            requests.delete(ver_url, headers=headers, timeout=10)

            # Supprimer le projet (hard delete)
            proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project['id']}"
            requests.delete(proj_url, headers=headers, timeout=10)
            deleted_count += 1

        logger.info(f"[FORGE] Cleanup: {deleted_count} test projects deleted")
        return jsonify({'success': True, 'deleted_count': deleted_count})

    except Exception as e:
        logger.error(f"[FORGE] Error cleaning up: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Purger les projets supprimes (hard delete) ---
@forge_bp.route('/api/forge/purge-deleted', methods=['POST'])
def forge_purge_deleted():
    """Supprime definitivement TOUS les projets avec status='deleted'."""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }

        # Recuperer tous les projets supprimes
        get_url = f"{SUPABASE_URL}/rest/v1/forge_projects?status=eq.deleted"
        get_response = requests.get(get_url, headers=headers, timeout=10)

        if get_response.status_code != 200:
            return jsonify({'success': False, 'error': 'Erreur de recuperation'}), 500

        projects = get_response.json()
        purged_count = 0

        for project in projects:
            project_id = project['id']

            # Supprimer les messages du projet
            msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}"
            requests.delete(msg_url, headers=headers, timeout=10)

            # Supprimer les versions du projet
            ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions?project_id=eq.{project_id}"
            requests.delete(ver_url, headers=headers, timeout=10)

            # Supprimer le projet (hard delete)
            proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"
            requests.delete(proj_url, headers=headers, timeout=10)
            purged_count += 1
            logger.info(f"[FORGE] Purged project: {project.get('name', project_id)}")

        logger.info(f"[FORGE] Purge complete: {purged_count} deleted projects permanently removed")
        return jsonify({'success': True, 'purged_count': purged_count})

    except Exception as e:
        logger.error(f"[FORGE] Error purging: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Creer un projet ---
@forge_bp.route('/api/forge/projects', methods=['POST'])
def forge_create_project():
    """Cree un nouveau projet Forge."""
    try:
        data = request.get_json() or {}
        name = data.get('name', '').strip()

        if not name:
            return jsonify({'success': False, 'error': 'Le nom du projet est requis'}), 400

        # Verifier unicite du nom parmi les projets actifs
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

        # Recuperer tous les projets actifs et verifier le nom en Python (case-insensitive)
        check_url = f"{SUPABASE_URL}/rest/v1/forge_projects?status=eq.active&select=name"
        check_response = requests.get(check_url, headers=headers, timeout=10)
        if check_response.status_code == 200:
            existing_names = [p.get('name', '').lower() for p in check_response.json()]
            if name.lower() in existing_names:
                return jsonify({'success': False, 'error': 'Un projet avec ce nom existe deja'}), 400

        project_data = {
            'name': name,
            'author': data.get('author') or None,
            'description': data.get('description', ''),
            'status': 'active',
            'current_version': 0,
            'tags': data.get('tags', [])
        }

        url = f"{SUPABASE_URL}/rest/v1/forge_projects"

        response = requests.post(url, headers=headers, json=project_data, timeout=10)

        if response.status_code in [200, 201]:
            project = response.json()[0] if isinstance(response.json(), list) else response.json()
            logger.info(f"[FORGE] Project created: {project.get('id')} - {name}")

            # Ajouter message systeme initial
            system_msg = {
                'project_id': project['id'],
                'role': 'assistant',
                'content': f"Projet '{name}' cree. Decrivez votre strategie ou posez vos questions. Tapez FORGE quand vous etes pret a generer le code.",
                'message_type': 'system'
            }
            msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages"
            requests.post(msg_url, headers=headers, json=system_msg, timeout=10)

            return jsonify({
                'success': True,
                'project': project
            })
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error creating project: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Detail d'un projet ---
@forge_bp.route('/api/forge/projects/<project_id>', methods=['GET'])
def forge_get_project(project_id):
    """Recupere un projet avec ses messages et versions."""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }

        # Recuperer le projet
        proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"
        proj_response = requests.get(proj_url, headers=headers, timeout=10)

        if proj_response.status_code != 200 or not proj_response.json():
            return jsonify({'success': False, 'error': 'Projet non trouve'}), 404

        project = proj_response.json()[0]

        # Recuperer les messages
        msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}&order=created_at.asc"
        msg_response = requests.get(msg_url, headers=headers, timeout=10)
        messages = msg_response.json() if msg_response.status_code == 200 else []

        # Recuperer les versions
        ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions?project_id=eq.{project_id}&order=version.desc"
        ver_response = requests.get(ver_url, headers=headers, timeout=10)
        versions = ver_response.json() if ver_response.status_code == 200 else []

        return jsonify({
            'success': True,
            'project': project,
            'messages': messages,
            'versions': versions
        })

    except Exception as e:
        logger.error(f"[FORGE] Error getting project {project_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Modifier un projet ---
@forge_bp.route('/api/forge/projects/<project_id>', methods=['PUT'])
def forge_update_project(project_id):
    """Modifie un projet (nom, description, author, status)."""
    try:
        data = request.get_json() or {}

        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

        # Si le nom est modifie, verifier l'unicite
        if 'name' in data and data['name']:
            new_name = data['name'].strip()

            # Recuperer tous les projets actifs SAUF le projet actuel
            check_url = f"{SUPABASE_URL}/rest/v1/forge_projects?status=eq.active&id=neq.{project_id}&select=name"
            check_response = requests.get(check_url, headers=headers, timeout=10)
            if check_response.status_code == 200:
                existing_names = [p.get('name', '').lower() for p in check_response.json()]
                if new_name.lower() in existing_names:
                    return jsonify({'success': False, 'error': 'Un projet avec ce nom existe deja'}), 400

        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'author' in data:
            update_data['author'] = data['author'] or None
        if 'description' in data:
            update_data['description'] = data['description']
        if 'status' in data:
            update_data['status'] = data['status']
        if 'tags' in data:
            update_data['tags'] = data['tags']

        if not update_data:
            return jsonify({'success': False, 'error': 'Aucune donnee a mettre a jour'}), 400

        update_data['updated_at'] = datetime.utcnow().isoformat() + 'Z'

        url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"

        response = requests.patch(url, headers=headers, json=update_data, timeout=10)

        if response.status_code == 200:
            project = response.json()[0] if response.json() else None
            logger.info(f"[FORGE] Project updated: {project_id}")
            return jsonify({
                'success': True,
                'project': project
            })
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error updating project {project_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Supprimer un projet ---
@forge_bp.route('/api/forge/projects/<project_id>', methods=['DELETE'])
def forge_delete_project(project_id):
    """Supprime un projet DEFINITIVEMENT (hard delete)."""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }

        # 1. Supprimer les messages du projet
        msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}"
        requests.delete(msg_url, headers=headers, timeout=10)

        # 2. Supprimer les versions du projet
        ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions?project_id=eq.{project_id}"
        requests.delete(ver_url, headers=headers, timeout=10)

        # 3. Supprimer le projet DEFINITIVEMENT
        proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"
        response = requests.delete(proj_url, headers=headers, timeout=10)

        if response.status_code in [200, 204]:
            logger.info(f"[FORGE] Project HARD DELETED: {project_id}")
            return jsonify({'success': True, 'message': 'Projet supprime definitivement'})
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error deleting project {project_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Effacer conversation ---
@forge_bp.route('/api/forge/projects/<project_id>/clear', methods=['POST'])
def forge_clear_chat(project_id):
    """Efface tous les messages d'un projet."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }

        response = requests.delete(url, headers=headers, timeout=10)

        if response.status_code in [200, 204]:
            logger.info(f"[FORGE] Chat cleared for project: {project_id}")
            return jsonify({'success': True, 'message': 'Conversation effacee'})
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error clearing chat {project_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def call_claude_forge_api(messages):
    """Appelle l'API Claude pour le chat Forge."""
    try:
        system_prompt = """Tu es l'assistant Dtego Forge, specialise dans la creation de strategies de trading algorithmique.

Ton role:
1. Comprendre les besoins de l'utilisateur en posant des questions pertinentes
2. Clarifier les parametres (indicateurs, seuils, conditions d'entree/sortie, gestion du risque)
3. Proposer des ameliorations si necessaire
4. Resumer la strategie avant generation

Regles:
- Sois concis et professionnel
- Pose une ou deux questions a la fois, pas plus
- Quand la strategie est claire, propose un recapitulatif et indique de taper FORGE
- Ne genere JAMAIS de code toi-meme, attends la commande FORGE

Indicateurs supportes: RSI, SMA, EMA, MACD, Bollinger Bands, ATR, ADX, Stochastique, Volume
Conditions: Croisements, seuils, comparaisons, filtres de tendance
Gestion risque: Stop Loss, Take Profit, Trailing Stop"""

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        }

        payload = {
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 1024,
            'system': system_prompt,
            'messages': messages
        }

        response = requests.post(url, headers=headers, json=payload, timeout=60)

        if response.status_code == 200:
            result = response.json()
            return result['content'][0]['text']
        else:
            logger.error(f"[FORGE] Claude API error: {response.status_code} - {response.text}")
            return "Erreur de communication avec l'IA. Veuillez reessayer."

    except Exception as e:
        logger.error(f"[FORGE] Claude API exception: {e}")
        return "Erreur de communication avec l'IA. Veuillez reessayer."


def forge_generate_internal(project_id, headers):
    """Genere le code Pine Script et Python (appele par forge_chat quand FORGE detecte)."""
    try:
        # Recuperer tout l'historique
        hist_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}&order=created_at.asc"
        hist_response = requests.get(hist_url, headers=headers, timeout=10)
        messages_history = hist_response.json() if hist_response.status_code == 200 else []

        # Construire le contexte complet
        conversation_text = "\n".join([
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in messages_history
        ])

        # Appel Claude pour generer le code
        if not ANTHROPIC_API_KEY:
            pine_code = "// Mode demonstration - Cle API non configuree\n// Votre strategie serait generee ici"
            python_code = "# Mode demonstration - Cle API non configuree\n# Votre strategie serait generee ici"
            summary = "Mode demonstration"
        else:
            pine_code, python_code, summary = generate_forge_strategy_code(conversation_text)

        # Recuperer la version actuelle
        proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}&select=current_version"
        proj_response = requests.get(proj_url, headers=headers, timeout=10)
        current_version = proj_response.json()[0]['current_version'] if proj_response.json() else 0
        new_version = current_version + 1

        # Sauvegarder la nouvelle version
        version_data = {
            'project_id': project_id,
            'version': new_version,
            'pine_code': pine_code,
            'python_code': python_code,
            'summary': summary,
            'trigger': 'forge_command'
        }
        ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions"
        requests.post(ver_url, headers=headers, json=version_data, timeout=10)

        # Mettre a jour current_version du projet
        proj_update_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"
        requests.patch(proj_update_url, headers=headers, json={
            'current_version': new_version,
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }, timeout=10)

        # Sauvegarder le message de resultat
        result_msg = {
            'project_id': project_id,
            'role': 'assistant',
            'content': f"Code genere (v{new_version}). {summary}",
            'message_type': 'forge_result',
            'metadata': json.dumps({
                'version': new_version,
                'pine_code': pine_code,
                'python_code': python_code
            })
        }
        msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages"
        msg_response = requests.post(msg_url, headers=headers, json=result_msg, timeout=10)
        result_message = msg_response.json()[0] if msg_response.status_code in [200, 201] else None

        logger.info(f"[FORGE] Code generated for project {project_id}, version {new_version}")

        return jsonify({
            'success': True,
            'is_forge_command': True,
            'version': new_version,
            'pine_code': pine_code,
            'python_code': python_code,
            'summary': summary,
            'message': result_message
        })

    except Exception as e:
        logger.error(f"[FORGE] Generate error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def convert_pine_with_claude_api(pine_code):
    """Convertit Pine Script vers Python en utilisant Claude API."""
    try:
        system_prompt = """Tu es un expert en conversion Pine Script vers Python pour trading algorithmique.

MISSION: Convertir le code Pine Script fourni en code Python fonctionnel et complet.

RÈGLES CRITIQUES:
1. TRADUIRE TOUTE LA LOGIQUE - Ne rien omettre
2. Variables 'var' Pine → attributs de classe Python avec gestion de reset
3. Indicateurs Pine (ta.sma, ta.atr, ta.rsi, etc.) → pandas/numpy équivalents
4. request.security() → manipulation de données multi-timeframe
5. Conditions et filtres → logique Python identique
6. Boucles et cumuls → itération sur DataFrame pandas
7. table.* et plot* → commentaires (non applicable en Python)

STRUCTURE PYTHON REQUISE:
```python
import pandas as pd
import numpy as np
from typing import Dict, Any

class ConvertedStrategy:
    def __init__(self):
        # Tous les paramètres Pine (inputs)
        pass
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        # Calcul de TOUS les indicateurs
        return df
    
    def apply_filters(self, df: pd.DataFrame) -> pd.DataFrame:
        # Application de TOUS les filtres
        # Retourner colonnes booléennes (passVolCum, passRange, etc.)
        return df
    
    def get_status(self, df: pd.DataFrame) -> pd.DataFrame:
        # Statut final (éliminé ou non)
        df['is_eliminated'] = ~(df['passFilter1'] & df['passFilter2'] & ...)
        return df
```

FORMAT DE RÉPONSE:
===PYTHON===
[code python complet ici]
===END===

IMPORTANT: Code Python UNIQUEMENT, aucun texte explicatif avant ou après."""

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        }

        payload = {
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 8192,  # Plus de tokens pour scripts complexes
            'system': system_prompt,
            'messages': [{
                'role': 'user',
                'content': f"Convertis ce Pine Script en Python:\n\n{pine_code}"
            }]
        }

        response = requests.post(url, headers=headers, json=payload, timeout=180)

        if response.status_code == 200:
            result = response.json()
            content = result['content'][0]['text']

            # Extraire le code Python
            if '===PYTHON===' in content and '===END===' in content:
                python_code = content.split('===PYTHON===')[1].split('===END===')[0].strip()
            elif '```python' in content:
                # Fallback si format Markdown
                parts = content.split('```python')
                if len(parts) > 1:
                    python_code = parts[1].split('```')[0].strip()
                else:
                    python_code = content
            else:
                python_code = content.strip()

            return python_code
        else:
            logger.error(f"[FORGE] Claude API conversion error: {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"[FORGE] Claude conversion exception: {e}")
        return None


def generate_forge_strategy_code(conversation_text):
    """Genere le code Pine Script et Python a partir de la conversation."""
    try:
        system_prompt = """Tu es un generateur de code de trading. A partir de la conversation fournie, genere:

1. CODE PINE SCRIPT (TradingView v6)
2. CODE PYTHON (avec pandas, classe complete avec calculate_indicators et generate_signals)
3. RESUME (une ligne decrivant la strategie)

Format de reponse STRICT (utilise exactement ces delimiteurs):
===PINE===
[code pine script ici]
===PYTHON===
[code python ici]
===SUMMARY===
[resume ici]

Regles:
- Pine Script version 6 (@version=6)
- Python avec pandas, numpy, classe bien structuree
- Inclure tous les indicateurs et conditions mentionnes
- Stop loss et take profit si mentionnes
- Code propre, commente, professionnel"""

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        }

        payload = {
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 4096,
            'system': system_prompt,
            'messages': [{
                'role': 'user',
                'content': f"Voici la conversation decrivant la strategie:\n\n{conversation_text}\n\nGenere le code."
            }]
        }

        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 200:
            result = response.json()
            content = result['content'][0]['text']

            # Parser la reponse
            pine_code = ""
            python_code = ""
            summary = "Strategie generee"

            if '===PINE===' in content and '===PYTHON===' in content:
                parts = content.split('===PYTHON===')
                pine_part = parts[0].split('===PINE===')[1] if '===PINE===' in parts[0] else parts[0]
                pine_code = pine_part.strip()

                if '===SUMMARY===' in parts[1]:
                    python_parts = parts[1].split('===SUMMARY===')
                    python_code = python_parts[0].strip()
                    summary = python_parts[1].strip()
                else:
                    python_code = parts[1].strip()
            else:
                # Fallback si format non respecte
                pine_code = "// Erreur de parsing - voir la reponse brute\n" + content
                python_code = "# Erreur de parsing"

            return pine_code, python_code, summary
        else:
            logger.error(f"[FORGE] Code generation API error: {response.status_code}")
            return "// Erreur API", "# Erreur API", "Erreur de generation"

    except Exception as e:
        logger.error(f"[FORGE] Code generation exception: {e}")
        return "// Erreur", "# Erreur", "Erreur de generation"


# --- FORGE: Chat (envoyer message + reponse IA) ---
@forge_bp.route('/api/forge/chat', methods=['POST'])
def forge_chat():
    """Envoie un message et recoit une reponse IA."""
    try:
        data = request.get_json() or {}
        project_id = data.get('project_id')
        user_message = data.get('message', '').strip()

        if not project_id or not user_message:
            return jsonify({'success': False, 'error': 'project_id et message requis'}), 400

        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

        # Sauvegarder le message utilisateur
        user_msg_data = {
            'project_id': project_id,
            'role': 'user',
            'content': user_message,
            'message_type': 'text'
        }
        msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages"
        requests.post(msg_url, headers=headers, json=user_msg_data, timeout=10)

        # Verifier si c'est la commande FORGE
        if user_message.upper() == 'FORGE':
            return forge_generate_internal(project_id, headers)

        # Recuperer l'historique pour le contexte
        hist_url = f"{SUPABASE_URL}/rest/v1/forge_messages?project_id=eq.{project_id}&order=created_at.asc&limit=50"
        hist_response = requests.get(hist_url, headers=headers, timeout=10)
        messages_history = hist_response.json() if hist_response.status_code == 200 else []

        # Construire le contexte pour Claude
        claude_messages = []
        for msg in messages_history:
            role = 'user' if msg['role'] == 'user' else 'assistant'
            claude_messages.append({
                'role': role,
                'content': msg['content']
            })

        # Appel API Claude
        if not ANTHROPIC_API_KEY:
            # Mode fallback sans IA
            ai_response = "Je suis en mode demonstration. Decrivez votre strategie et tapez FORGE pour generer le code."
        else:
            ai_response = call_claude_forge_api(claude_messages)

        # Sauvegarder la reponse IA
        ai_msg_data = {
            'project_id': project_id,
            'role': 'assistant',
            'content': ai_response,
            'message_type': 'text'
        }
        ai_response_db = requests.post(msg_url, headers=headers, json=ai_msg_data, timeout=10)
        ai_msg = ai_response_db.json()[0] if ai_response_db.status_code in [200, 201] else None

        return jsonify({
            'success': True,
            'message': ai_msg,
            'is_forge_command': False
        })

    except Exception as e:
        logger.error(f"[FORGE] Chat error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Generer manuellement (endpoint direct) ---
@forge_bp.route('/api/forge/generate', methods=['POST'])
def forge_generate():
    """Endpoint direct pour forcer la generation (alternative a taper FORGE dans le chat)."""
    try:
        data = request.get_json() or {}
        project_id = data.get('project_id')

        if not project_id:
            return jsonify({'success': False, 'error': 'project_id requis'}), 400

        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

        return forge_generate_internal(project_id, headers)

    except Exception as e:
        logger.error(f"[FORGE] Generate endpoint error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Liste des versions ---
@forge_bp.route('/api/forge/versions/<project_id>', methods=['GET'])
def forge_list_versions(project_id):
    """Liste toutes les versions d'un projet."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/forge_versions?project_id=eq.{project_id}&order=version.desc"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            versions = response.json()
            return jsonify({
                'success': True,
                'versions': versions,
                'count': len(versions)
            })
        else:
            return jsonify({'success': False, 'error': response.text}), response.status_code

    except Exception as e:
        logger.error(f"[FORGE] Error listing versions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# --- FORGE: Restaurer une version ---
@forge_bp.route('/api/forge/versions/<version_id>/restore', methods=['POST'])
def forge_restore_version(version_id):
    """Restaure une version precedente (cree une nouvelle version avec le meme contenu)."""
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

        # Recuperer la version a restaurer
        ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions?id=eq.{version_id}"
        ver_response = requests.get(ver_url, headers=headers, timeout=10)

        if ver_response.status_code != 200 or not ver_response.json():
            return jsonify({'success': False, 'error': 'Version non trouvee'}), 404

        old_version = ver_response.json()[0]
        project_id = old_version['project_id']

        # Recuperer la version actuelle du projet
        proj_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}&select=current_version"
        proj_response = requests.get(proj_url, headers=headers, timeout=10)
        current_version = proj_response.json()[0]['current_version'] if proj_response.json() else 0
        new_version = current_version + 1

        # Creer la nouvelle version
        new_version_data = {
            'project_id': project_id,
            'version': new_version,
            'pine_code': old_version['pine_code'],
            'python_code': old_version['python_code'],
            'summary': f"Restaure depuis v{old_version['version']}: {old_version.get('summary', '')}",
            'trigger': 'manual_save'
        }

        new_ver_url = f"{SUPABASE_URL}/rest/v1/forge_versions"
        requests.post(new_ver_url, headers=headers, json=new_version_data, timeout=10)

        # Mettre a jour le projet
        proj_update_url = f"{SUPABASE_URL}/rest/v1/forge_projects?id=eq.{project_id}"
        requests.patch(proj_update_url, headers=headers, json={
            'current_version': new_version,
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }, timeout=10)

        # Ajouter un message dans la conversation
        msg_data = {
            'project_id': project_id,
            'role': 'assistant',
            'content': f"Version v{old_version['version']} restauree en tant que v{new_version}.",
            'message_type': 'system'
        }
        msg_url = f"{SUPABASE_URL}/rest/v1/forge_messages"
        requests.post(msg_url, headers=headers, json=msg_data, timeout=10)

        logger.info(f"[FORGE] Version {old_version['version']} restored as v{new_version} for project {project_id}")

        return jsonify({
            'success': True,
            'new_version': new_version,
            'message': f"Version v{old_version['version']} restauree en v{new_version}"
        })

    except Exception as e:
        logger.error(f"[FORGE] Restore version error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# FORGE 2.0 - CONVERSION PINE SCRIPT
# ══════════════════════════════════════════════════════════════════════════════

@forge_bp.route('/api/forge/parse', methods=['POST'])
def forge_parse_pine():
    """
    Parse un code Pine Script et retourne sa structure JSON.

    Request body:
        {"pine_code": "...code Pine Script..."}

    Returns:
        JSON structure avec inputs, indicators, conditions, entries, exits
    """
    try:
        data = request.get_json() or {}
        pine_code = data.get('pine_code', '').strip()

        if not pine_code:
            return jsonify({'success': False, 'error': 'pine_code requis'}), 400

        if len(pine_code) < 20:
            return jsonify({'success': False, 'error': 'Code Pine trop court'}), 400

        # Parser le code
        from pine_parser import parse_pine_script, parsed_to_dict
        parsed = parse_pine_script(pine_code)
        result = parsed_to_dict(parsed)

        logger.info(f"[FORGE] Parsed Pine Script: {result.get('stats', {})}")

        return jsonify({
            'success': True,
            'parsed': result,
            'stats': result.get('stats', {})
        })

    except Exception as e:
        logger.error(f"[FORGE] Parse error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@forge_bp.route('/api/forge/convert', methods=['POST'])
def forge_convert_pine():
    """
    Convertit un code Pine Script en Python.
    Options: auto_save=true pour sauvegarder, use_ai=true pour utiliser Claude API
    
    Request body:
        {
            "pine_code": "...code Pine Script...",
            "use_ai": true,  // optionnel, default false - utilise Claude API pour meilleure conversion
            "auto_save": true,  // optionnel, default false
            "name": "Ma Strategie"  // requis si auto_save=true
        }
    
    Returns:
        {"success": true, "python_code": "...", "parsed": {...}, "saved": {...}, "conversion_method": "ai|classic"}
    """
    try:
        data = request.get_json() or {}
        pine_code = data.get('pine_code', '').strip()
        use_ai = data.get('use_ai', False)  # NOUVEAU paramètre
        auto_save = data.get('auto_save', False)
        custom_name = data.get('name', '').strip()

        if not pine_code:
            return jsonify({'success': False, 'error': 'pine_code requis'}), 400

        if len(pine_code) < 20:
            return jsonify({'success': False, 'error': 'Code Pine trop court'}), 400

        # Choisir la méthode de conversion
        conversion_method = 'ai' if use_ai else 'classic'
        python_code = None
        parsed_dict = {}

        if use_ai:
            # === NOUVELLE MÉTHODE: Conversion avec Claude API ===
            logger.info("[FORGE] Converting with Claude API...")
            
            if not ANTHROPIC_API_KEY:
                return jsonify({
                    'success': False,
                    'error': 'API Claude non configurée. Utilisez use_ai=false pour conversion classique.'
                }), 400
            
            python_code = convert_pine_with_claude_api(pine_code)
            
            if not python_code:
                return jsonify({
                    'success': False,
                    'error': 'Erreur lors de la conversion avec Claude API'
                }), 500
            
            # Parse quand même pour avoir les stats (optionnel, peut échouer)
            try:
                from pine_parser import parse_pine_script, parsed_to_dict
                parsed = parse_pine_script(pine_code)
                parsed_dict = parsed_to_dict(parsed)
            except:
                parsed_dict = {'stats': {}, 'conversion_method': 'ai'}
        
        else:
            # === MÉTHODE CLASSIQUE: Parser + Générateur ===
            logger.info("[FORGE] Converting with classic parser/generator...")
            
            from pine_parser import parse_pine_script, parsed_to_dict
            from pine_generator import generate_python_code

            parsed = parse_pine_script(pine_code)
            parsed_dict = parsed_to_dict(parsed)

            # Verifier les erreurs de parsing
            if parsed.errors:
                return jsonify({
                    'success': False,
                    'error': 'Erreurs de parsing',
                    'errors': parsed.errors,
                    'parsed': parsed_dict
                }), 400

            # Generer le code Python avec l'ancien système
            python_code = generate_python_code(parsed)

        logger.info(f"[FORGE] Converted Pine Script ({conversion_method}): {parsed_dict.get('stats', {})}")

        response_data = {
            'success': True,
            'python_code': python_code,
            'conversion_method': conversion_method,  # NOUVEAU: indique la méthode utilisée
            'parsed': parsed_dict,
            'stats': parsed_dict.get('stats', {})
        }

        # Auto-save dans library_items si demande
        if auto_save:
            strategy_info = parsed_dict.get('strategy') or {}
            item_name = custom_name or strategy_info.get('name') or 'Unnamed Strategy'
            item_type = 'strategy' if parsed_dict.get('script_type') == 'strategy' else 'indicator'

            # Determiner la categorie basee sur les indicateurs
            indicators = parsed_dict.get('indicators', [])
            category = 'trend'  # default
            if indicators:
                first_cat = indicators[0].get('category', 'other')
                category = first_cat if first_cat != 'other' else 'trend'

            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }

            # Verifier si existe deja
            check_url = f"{SUPABASE_URL}/rest/v1/library_items?name=eq.{item_name}&type=eq.{item_type}&select=id"
            check_response = requests.get(check_url, headers=headers, timeout=10)

            if check_response.status_code == 200 and check_response.json():
                # Existe deja - on met a jour
                existing_id = check_response.json()[0]['id']
                update_data = {
                    'pine_code': pine_code,
                    'python_code': python_code,
                    'parameters': parsed_dict.get('inputs', []),
                    'updated_at': datetime.utcnow().isoformat() + 'Z'
                }
                update_url = f"{SUPABASE_URL}/rest/v1/library_items?id=eq.{existing_id}"
                requests.patch(update_url, headers=headers, json=update_data, timeout=10)
                response_data['saved'] = {'id': existing_id, 'action': 'updated'}
                logger.info(f"[FORGE] Updated library item: {item_name}")
            else:
                # Creer nouveau
                item_data = {
                    'name': item_name,
                    'type': item_type,
                    'category': category,
                    'version': f"v{parsed_dict.get('version', 5)}",
                    'description': f"Converti depuis Pine Script par Forge 2.0",
                    'pine_code': pine_code,
                    'python_code': python_code,
                    'parameters': parsed_dict.get('inputs', []),
                    'tags': [ind.get('function', '') for ind in indicators[:5]],
                    'status': 'draft'
                }
                create_url = f"{SUPABASE_URL}/rest/v1/library_items"
                create_response = requests.post(create_url, headers=headers, json=item_data, timeout=10)

                if create_response.status_code in [200, 201]:
                    created = create_response.json()[0] if create_response.json() else {}
                    response_data['saved'] = {'id': created.get('id'), 'action': 'created', 'name': item_name}
                    logger.info(f"[FORGE] Created library item: {item_name}")
                else:
                    response_data['saved'] = {'error': 'Failed to save', 'details': create_response.text}

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"[FORGE] Convert error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

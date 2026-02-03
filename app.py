from flask import Flask, render_template, jsonify, request, send_from_directory
import requests
from functools import lru_cache
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
API_BASE = "https://www.sankavollerei.com"

# ============ VERCEL SERVERLESS STORAGE ============
# Note: Vercel doesn't support SQLite or background tasks
# Using in-memory storage (will reset on cold start)
NOTIFICATIONS = []

# Simple cache for Vercel (in-memory)
CACHE = {}
CACHE_DURATION = {
    'home': 300,
    'ongoing': 300,
    'completed': 600,
    'schedule': 1800,
    'unlimited': 3600,
    'genre': 3600,
    'anime': 600,
    'episode': 300,
    'search': 300,
    'server': 60,
    'batch': 600
}

def get_from_cache(cache_key):
    """Get data from memory cache"""
    if cache_key in CACHE:
        cached_time, cache_type, data = CACHE[cache_key]
        max_age = CACHE_DURATION.get(cache_type, 300)
        
        if datetime.now() - cached_time < timedelta(seconds=max_age):
            return data
    return None

def save_to_cache(cache_key, data, cache_type='home'):
    """Save data to memory cache"""
    CACHE[cache_key] = (datetime.now(), cache_type, data)

def fetch_api(endpoint, cache_type='home'):
    """Fetch data from API with caching"""
    cache_key = f"{cache_type}_{endpoint}"
    
    # Try cache first
    cached_data = get_from_cache(cache_key)
    if cached_data is not None:
        return cached_data
    
    try:
        response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Save to cache
        save_to_cache(cache_key, data, cache_type)
        
        return data
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": str(e)}

# ============ BOOKMARK PAGE (Client-side with localStorage) ============
@app.route('/bookmarks')
def bookmarks():
    """Bookmarks page - using client-side localStorage"""
    return render_template('bookmarks.html')

# ============ NOTIFICATION ROUTES (In-Memory) ============
@app.route('/api/notifications')
def api_notifications():
    """Get notifications"""
    return jsonify({
        'status': 'success',
        'data': {
            'notifications': NOTIFICATIONS[-10:],  # Last 10
            'unread_count': 0
        }
    })

@app.route('/api/notifications/clear', methods=['POST'])
def clear_notifications():
    """Clear notifications"""
    NOTIFICATIONS.clear()
    return jsonify({'status': 'success'})

# ============ ANIME ROUTES ============
@app.route('/')
def index():
    data = fetch_api('/anime/home', 'home')
    return render_template('home.html', data=data)

@app.route('/api/home')
def api_home():
    data = fetch_api('/anime/home', 'home')
    return jsonify(data)

@app.route('/anime/<anime_id>')
def anime_detail(anime_id):
    """Anime detail page"""
    data = fetch_api(f'/anime/anime/{anime_id}', 'anime')
    return render_template('detail.html', anime_id=anime_id, data=data)

@app.route('/api/anime/<anime_id>')
def api_anime_detail(anime_id):
    data = fetch_api(f'/anime/anime/{anime_id}', 'anime')
    return jsonify(data)

@app.route('/ongoing')
def ongoing():
    page = request.args.get('page', 1, type=int)
    data = fetch_api(f'/anime/ongoing-anime?page={page}', 'ongoing')
    return render_template('ongoing.html', data=data)

@app.route('/completed')
def completed():
    page = request.args.get('page', 1, type=int)
    data = fetch_api(f'/anime/complete-anime?page={page}', 'completed')
    return render_template('completed.html', data=data)

@app.route('/schedule')
def schedule():
    data = fetch_api('/anime/schedule', 'schedule')
    return render_template('schedule.html', data=data)

@app.route('/api/schedule')
def api_schedule():
    data = fetch_api('/anime/schedule', 'schedule')
    return jsonify(data)

@app.route('/all-anime')
def all_anime():
    data = fetch_api('/anime/unlimited', 'unlimited')
    return render_template('all_anime.html', data=data)

@app.route('/api/all-anime')
def api_all_anime():
    data = fetch_api('/anime/unlimited', 'unlimited')
    return jsonify(data)

@app.route('/episode/<episode_id>')
def episode_detail(episode_id):
    data = fetch_api(f'/anime/episode/{episode_id}', 'episode')
    return render_template('episode.html', episode_id=episode_id, data=data)

@app.route('/api/episode/<episode_id>')
def api_episode_detail(episode_id):
    data = fetch_api(f'/anime/episode/{episode_id}', 'episode')
    return jsonify(data)

@app.route('/search')
def search():
    keyword = request.args.get('q', '')
    if not keyword:
        return render_template('home.html', data=fetch_api('/anime/home', 'home'))
    
    data = fetch_api(f'/anime/search/{keyword}', 'search')
    return render_template('search.html', keyword=keyword, data=data)

@app.route('/api/search/<keyword>')
def api_search(keyword):
    data = fetch_api(f'/anime/search/{keyword}', 'search')
    return jsonify(data)

@app.route('/api/server/<server_id>')
def api_server(server_id):
    data = fetch_api(f'/anime/server/{server_id}', 'server')
    return jsonify(data)

@app.route('/batch/<slug>')
def batch_download(slug):
    """Batch download page"""
    data = fetch_api(f'/anime/batch/{slug}', 'batch')
    return render_template('batch.html', slug=slug, data=data)

@app.route('/api/batch/<slug>')
def api_batch(slug):
    data = fetch_api(f'/anime/batch/{slug}', 'batch')
    return jsonify(data)

@app.route('/genres')
def genres():
    data = fetch_api('/anime/genre', 'genre')
    return render_template('genres.html', data=data)

@app.route('/api/genres')
def api_genres():
    data = fetch_api('/anime/genre', 'genre')
    return jsonify(data)

@app.route('/genre/<genre_id>')
def genre_detail(genre_id):
    data = fetch_api(f'/anime/genre/{genre_id}', 'genre')
    genre_name = genre_id.replace('-', ' ').title()
    return render_template('genre_detail.html', genre_id=genre_id, genre_name=genre_name, data=data)

@app.route('/api/genre/<genre_id>')
def api_genre_detail(genre_id):
    data = fetch_api(f'/anime/genre/{genre_id}', 'genre')
    return jsonify(data)

@app.route("/sitemap.xml")
def sitemap():
    return send_from_directory("static", "sitemap.xml")

# Vercel needs this
if __name__ == '__main__':
    app.run(debug=True)

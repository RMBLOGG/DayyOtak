from flask import Flask, render_template, jsonify, request, Response, send_file
import requests
from datetime import datetime, timedelta
import os
import hashlib
import threading
import time

app = Flask(__name__)
API_BASE = "https://www.sankavollerei.com"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.sankavollerei.com/',
    'Origin': 'https://www.sankavollerei.com',
    'Connection': 'keep-alive',
}

# ============ VERCEL SERVERLESS STORAGE ============
NOTIFICATIONS = []

# ============ CACHE SYSTEM ============
CACHE = {}
CACHE_DURATION = {
    'home': 600,       # 10 menit
    'ongoing': 600,    # 10 menit
    'completed': 900,  # 15 menit
    'schedule': 3600,  # 60 menit
    'unlimited': 3600, # 60 menit
    'genre': 3600,     # 60 menit
    'anime': 1800,     # 30 menit
    'episode': 3600,   # 60 menit
    'search': 300,     # 5 menit
    'server': 120,     # 2 menit
    'batch': 1800,     # 30 menit
}

# ============ RATE LIMITER ============
# Maks 55 req/menit (aman di bawah limit 70)
_req_lock = threading.Lock()
_req_times = []
MAX_RPM = 55

def _rate_limit_wait():
    with _req_lock:
        now = time.time()
        # Buang timestamp > 60 detik
        while _req_times and now - _req_times[0] > 60:
            _req_times.pop(0)
        if len(_req_times) >= MAX_RPM:
            wait = 61 - (now - _req_times[0])
            print(f"⏳ Rate limit hit, tunggu {wait:.1f}s")
            time.sleep(max(wait, 0))
        _req_times.append(time.time())

# ============ IMAGE CACHE (In-Memory only - Vercel read-only FS) ============
IMAGE_CACHE = {}  # {url: {'content': bytes, 'mimetype': str, 'cached_at': datetime}}
IMAGE_CACHE_DURATION = timedelta(hours=6)  # 6 jam in-memory

def get_from_cache(cache_key):
    if cache_key in CACHE:
        cached_time, cache_type, data = CACHE[cache_key]
        max_age = CACHE_DURATION.get(cache_type, 600)
        if datetime.now() - cached_time < timedelta(seconds=max_age):
            return data
    return None

def save_to_cache(cache_key, data, cache_type='home'):
    CACHE[cache_key] = (datetime.now(), cache_type, data)

def fetch_api(endpoint, cache_type='home'):
    """Fetch data dari API dengan cache + rate limiter + retry otomatis"""
    cache_key = f"{cache_type}_{endpoint}"

    # Cek cache dulu
    cached_data = get_from_cache(cache_key)
    if cached_data is not None:
        print(f"✅ Cache HIT: {endpoint}")
        return cached_data

    print(f"🌐 API Request: {endpoint}")

    # Rate limit check
    _rate_limit_wait()

    last_error = None
    for attempt in range(3):  # Retry 3x
        try:
            response = requests.get(
                f"{API_BASE}{endpoint}",
                headers=HEADERS,
                timeout=15
            )

            if response.status_code in (403, 429):
                wait = (attempt + 1) * 6  # 6s, 12s, 18s
                print(f"⚠️ Rate limited ({response.status_code}), retry {attempt+1}/3 dalam {wait}s")
                time.sleep(wait)
                continue

            response.raise_for_status()
            data = response.json()
            save_to_cache(cache_key, data, cache_type)
            return data

        except Exception as e:
            last_error = e
            if attempt < 2:
                time.sleep(3)

    # Semua retry gagal - pakai stale cache jika ada
    if cache_key in CACHE:
        print(f"⚠️ Pakai stale cache: {endpoint}")
        return CACHE[cache_key][2]

    return {"status": "error", "message": str(last_error)}

# ============ IMAGE PROXY FUNCTIONS ============
# Note: Vercel filesystem read-only, pakai in-memory cache

def is_image_cached(url):
    """Check apakah image ada di in-memory cache dan masih valid"""
    if url in IMAGE_CACHE:
        cached_at = IMAGE_CACHE[url].get('cached_at')
        if cached_at and datetime.now() - cached_at < IMAGE_CACHE_DURATION:
            return True
    return False

def cache_image(url, image_content, mimetype='image/jpeg'):
    """Cache image ke in-memory"""
    IMAGE_CACHE[url] = {
        'content': image_content,
        'mimetype': mimetype,
        'cached_at': datetime.now(),
        'hits': 0,
    }

# ============ IMAGE PROXY ROUTE ============

@app.route('/api/proxy-image', methods=['GET', 'OPTIONS'])
def proxy_image():
    """
    Image proxy endpoint dengan aggressive caching
    TIDAK akan membebani API karena:
    1. Cache 30 hari per image
    2. Serve dari disk cache, bukan fetch ulang
    3. Zero API calls untuk cached images
    
    Usage: /api/proxy-image?url=https://example.com/image.jpg
    """
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    
    image_url = request.args.get('url')
    
    if not image_url:
        return jsonify({'error': 'URL parameter required'}), 400
    
    # ===== CHECK CACHE FIRST (ZERO API CALLS) =====
    if is_image_cached(image_url):
        cached = IMAGE_CACHE[image_url]
        cached['hits'] = cached.get('hits', 0) + 1
        response = Response(cached['content'], mimetype=cached.get('mimetype', 'image/jpeg'))
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['X-Cache-Status'] = 'HIT'
        response.headers['Cache-Control'] = 'public, max-age=86400'
        return response

    # ===== CACHE MISS - FETCH ONCE AND CACHE =====
    try:
        print(f"Fetching image: {image_url}")
        img_response = requests.get(
            image_url,
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        img_response.raise_for_status()

        image_content = img_response.content
        mimetype = img_response.headers.get('Content-Type', 'image/jpeg')

        # Cache in-memory (6 jam)
        cache_image(image_url, image_content, mimetype)

        response = Response(image_content, mimetype=mimetype)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['X-Cache-Status'] = 'MISS'
        response.headers['Cache-Control'] = 'public, max-age=86400'
        return response
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500
        
    except Exception as e:
        return jsonify({'error': f'Internal error: {str(e)}'}), 500

# ============ IMAGE CACHE STATS (Optional - untuk monitoring) ============

@app.route('/api/image-cache/stats')
def image_cache_stats():
    total_hits = sum(c.get('hits', 0) for c in IMAGE_CACHE.values())
    total_size = sum(len(c.get('content', b'')) for c in IMAGE_CACHE.values())
    return jsonify({
        'status': 'success',
        'data': {
            'total_cached_images': len(IMAGE_CACHE),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'total_hits': total_hits,
            'cache_duration_hours': 6,
        }
    })

@app.route('/api/image-cache/clear', methods=['POST'])
def clear_image_cache():
    IMAGE_CACHE.clear()
    return jsonify({'status': 'success', 'message': 'Image cache cleared'})

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

# Vercel needs this
if __name__ == '__main__':
    app.run(debug=True)

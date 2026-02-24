from flask import Flask, render_template, jsonify, request, Response, send_file, redirect, url_for, session
import requests
from functools import lru_cache, wraps
from datetime import datetime, timedelta
import json
import os
import hashlib
from io import BytesIO

# pip install authlib
from authlib.integrations.flask_client import OAuth
from werkzeug.middleware.proxy_fix import ProxyFix

# pip install supabase
from supabase import create_client, Client

app = Flask(__name__)

# ============ SECURITY: Environment Variables Only ============
# SECRET_KEY untuk Flask session
app.secret_key = os.environ.get('SECRET_KEY')
if not app.secret_key:
    raise ValueError("❌ SECRET_KEY must be set in environment variables")

# Fix HTTPS redirect URI di Vercel
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config['PREFERRED_URL_SCHEME'] = 'https'
API_BASE = "https://www.sankavollerei.com"

# ============ SUPABASE ============
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============ GOOGLE OAUTH ============
GOOGLE_CLIENT_ID     = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise ValueError("❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables")

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'token_endpoint_auth_method': 'client_secret_post'
    }
)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

@app.route('/login')
def login():
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/login/google')
def login_google():
    try:
        redirect_uri = url_for('auth_callback', _external=True, _scheme='https')
        return google.authorize_redirect(redirect_uri)
    except Exception as e:
        print(f"OAuth redirect error: {e}")
        return f"Login error: {str(e)}", 500

@app.route('/auth/callback')
def auth_callback():
    try:
        token     = google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            resp = google.get('https://openidconnect.googleapis.com/v1/userinfo')
            user_info = resp.json()
        if user_info:
            session['user'] = {
                'name'   : user_info.get('name'),
                'email'  : user_info.get('email'),
                'picture': user_info.get('picture'),
                'sub'    : user_info.get('sub'),
            }
            return redirect(url_for('index'))
        return redirect(url_for('login'))
    except Exception as e:
        print(f"OAuth callback error: {e}")
        return f"Callback error: {str(e)}", 500

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/api/me')
def api_me():
    if 'user' in session:
        return jsonify({'status': 'success', 'data': session['user']})
    return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

# ============ VERCEL SERVERLESS STORAGE ============
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

# ============ IMAGE CACHE CONFIGURATION ============
# Cache poster images selama 30 hari untuk menghindari rate limit API
IMAGE_CACHE_DIR = 'static/poster_cache'
IMAGE_CACHE_DURATION_DAYS = 30  # Cache 30 hari
IMAGE_CACHE = {}  # In-memory metadata {url: {'path': ..., 'cached_at': ..., 'hits': ...}}

# Create cache directory
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

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

# ============ IMAGE PROXY FUNCTIONS ============

def get_image_cache_path(url):
    """Generate cache filename dari URL"""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return os.path.join(IMAGE_CACHE_DIR, f'{url_hash}.jpg')

def is_image_cached(url):
    """Check apakah image sudah di-cache DAN masih valid"""
    cache_path = get_image_cache_path(url)
    
    # Check file exists
    if not os.path.exists(cache_path):
        return False
    
    # Check in-memory metadata
    if url in IMAGE_CACHE:
        cached_at = IMAGE_CACHE[url].get('cached_at')
        if cached_at:
            cached_date = datetime.fromisoformat(cached_at)
            expiry_date = cached_date + timedelta(days=IMAGE_CACHE_DURATION_DAYS)
            
            # Jika masih valid, return True
            if datetime.now() < expiry_date:
                return True
    
    # Check file modification time as fallback
    file_stat = os.stat(cache_path)
    file_age = datetime.now() - datetime.fromtimestamp(file_stat.st_mtime)
    
    if file_age < timedelta(days=IMAGE_CACHE_DURATION_DAYS):
        # Update in-memory cache
        IMAGE_CACHE[url] = {
            'path': cache_path,
            'cached_at': datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            'hits': IMAGE_CACHE.get(url, {}).get('hits', 0)
        }
        return True
    
    return False

def cache_image(url, image_content):
    """Cache image ke disk"""
    cache_path = get_image_cache_path(url)
    
    try:
        # Save image to disk
        with open(cache_path, 'wb') as f:
            f.write(image_content)
        
        # Update in-memory metadata
        IMAGE_CACHE[url] = {
            'path': cache_path,
            'cached_at': datetime.now().isoformat(),
            'hits': 0,
            'size': len(image_content)
        }
        
        return cache_path
    except Exception as e:
        print(f"Error caching image: {e}")
        return None

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
    
    image_url = request.args.get('url', '').strip()
    
    if not image_url:
        return jsonify({'error': 'URL parameter required'}), 400
    
    # Update hit counter
    if image_url in IMAGE_CACHE:
        IMAGE_CACHE[image_url]['hits'] = IMAGE_CACHE[image_url].get('hits', 0) + 1
    
    # Check if cached
    if is_image_cached(image_url):
        cache_path = get_image_cache_path(image_url)
        
        try:
            response = send_file(
                cache_path,
                mimetype='image/jpeg',
                as_attachment=False
            )
            
            # Add cache headers (30 days)
            response.headers['Cache-Control'] = f'public, max-age={IMAGE_CACHE_DURATION_DAYS * 24 * 3600}'
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['X-Cache-Status'] = 'HIT'
            
            return response
            
        except Exception as e:
            print(f"Error serving cached image: {e}")
            # Fall through to fetch fresh
    
    # Fetch from source
    try:
        img_response = requests.get(image_url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        img_response.raise_for_status()
        
        image_content = img_response.content
        
        # Cache the image
        cache_image(image_url, image_content)
        
        # Return image
        response = Response(image_content, mimetype='image/jpeg')
        response.headers['Cache-Control'] = f'public, max-age={IMAGE_CACHE_DURATION_DAYS * 24 * 3600}'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['X-Cache-Status'] = 'MISS'
        
        return response
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500

@app.route('/api/cache-stats')
def cache_stats():
    """Show cache statistics"""
    total_cached = len([f for f in os.listdir(IMAGE_CACHE_DIR) if f.endswith('.jpg')])
    
    # Calculate total cache size
    total_size = 0
    for filename in os.listdir(IMAGE_CACHE_DIR):
        if filename.endswith('.jpg'):
            filepath = os.path.join(IMAGE_CACHE_DIR, filename)
            total_size += os.path.getsize(filepath)
    
    # Top hit images
    top_hits = sorted(
        [(url, meta['hits']) for url, meta in IMAGE_CACHE.items() if 'hits' in meta],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    
    return jsonify({
        'total_cached_images': total_cached,
        'total_cache_size_mb': round(total_size / (1024 * 1024), 2),
        'cache_duration_days': IMAGE_CACHE_DURATION_DAYS,
        'top_10_hits': [{'url': url, 'hits': hits} for url, hits in top_hits]
    })

# ============ MAIN ROUTES ============

@app.route('/')
def index():
    data = fetch_api('/anime/home', 'home')
    return render_template('home.html', data=data)

@app.route('/api/home')
def api_home():
    data = fetch_api('/anime/home', 'home')
    return jsonify(data)

@app.route('/ongoing')
def ongoing():
    data = fetch_api('/anime/ongoing', 'ongoing')
    return render_template('ongoing.html', data=data)

@app.route('/api/ongoing')
def api_ongoing():
    data = fetch_api('/anime/ongoing', 'ongoing')
    return jsonify(data)

@app.route('/completed')
def completed():
    data = fetch_api('/anime/completed', 'completed')
    return render_template('completed.html', data=data)

@app.route('/api/completed')
def api_completed():
    data = fetch_api('/anime/completed', 'completed')
    return jsonify(data)

@app.route('/schedule')
def schedule():
    data = fetch_api('/anime/schedule', 'schedule')
    return render_template('schedule.html', data=data)

@app.route('/api/schedule')
def api_schedule():
    data = fetch_api('/anime/schedule', 'schedule')
    return jsonify(data)

@app.route('/unlimited')
def unlimited():
    data = fetch_api('/anime/unlimited', 'unlimited')
    return render_template('unlimited.html', data=data)

@app.route('/api/unlimited')
def api_unlimited():
    data = fetch_api('/anime/unlimited', 'unlimited')
    return jsonify(data)

@app.route('/anime/<anime_id>')
def anime_detail(anime_id):
    data = fetch_api(f'/anime/anime/{anime_id}', 'anime')
    return render_template('anime.html', anime_id=anime_id, data=data)

@app.route('/api/anime/<anime_id>')
def api_anime_detail(anime_id):
    data = fetch_api(f'/anime/anime/{anime_id}', 'anime')
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


# ============ HISTORY (Supabase) ============
def get_user_id():
    user = session.get('user')
    return user.get('sub') if user else None

@app.route('/history')
@login_required
def history_page():
    uid = get_user_id()
    try:
        res = supabase.table('watch_history')\
            .select('*')\
            .eq('user_sub', uid)\
            .order('watched_at', desc=True)\
            .limit(100)\
            .execute()
        items = res.data or []
    except Exception as e:
        print(f"Supabase history error: {e}")
        items = []
    return render_template('history.html', history=items)

@app.route('/api/history', methods=['GET'])
@login_required
def api_get_history():
    uid = get_user_id()
    try:
        res = supabase.table('watch_history')\
            .select('*')\
            .eq('user_sub', uid)\
            .order('watched_at', desc=True)\
            .limit(100)\
            .execute()
        return jsonify({'status': 'success', 'data': res.data or []})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/history/add', methods=['POST'])
@login_required
def api_add_history():
    uid = get_user_id()
    body = request.get_json() or {}
    episode_id    = body.get('episode_id', '').strip()
    episode_title = body.get('episode_title', '').strip()
    anime_id      = body.get('anime_id', '').strip()
    anime_title   = body.get('anime_title', '').strip()
    poster        = body.get('poster', '').strip()

    if not episode_id:
        return jsonify({'status': 'error', 'message': 'episode_id required'}), 400

    if anime_id and (not poster or not anime_title):
        try:
            anime_data = fetch_api(f'/anime/anime/{anime_id}', 'anime')
            if anime_data and anime_data.get('status') == 'success':
                d = anime_data.get('data', {})
                if not anime_title: anime_title = d.get('title', '')
                if not poster:      poster = d.get('poster', '')
        except Exception as e:
            print(f"Failed to fetch anime data: {e}")

    try:
        supabase.table('watch_history').upsert({
            'user_sub':      uid,
            'episode_id':    episode_id,
            'episode_title': episode_title,
            'anime_id':      anime_id,
            'anime_title':   anime_title,
            'poster':        poster,
            'watched_at':    datetime.now().isoformat()
        }, on_conflict='user_sub,episode_id').execute()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/history/clear', methods=['POST'])
@login_required
def api_clear_history():
    uid = get_user_id()
    try:
        supabase.table('watch_history').delete().eq('user_sub', uid).execute()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ============ KOMENTAR & RATING (Supabase) ============
@app.route('/api/comments/<anime_id>', methods=['GET'])
def api_get_comments(anime_id):
    try:
        res = supabase.table('comments')\
            .select('*')\
            .eq('anime_id', anime_id)\
            .order('posted_at', desc=True)\
            .execute()
        return jsonify({'status': 'success', 'data': res.data or []})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/comments/<anime_id>', methods=['POST'])
@login_required
def api_post_comment(anime_id):
    user = session.get('user')
    body = request.get_json() or {}
    comment = body.get('comment', '').strip()
    rating  = body.get('rating', 0)
    if not comment:
        return jsonify({'status': 'error', 'message': 'Komentar tidak boleh kosong'}), 400
    try:
        rating = max(1, min(10, int(rating)))
    except:
        rating = 0
    try:
        supabase.table('comments').upsert({
            'user_sub':  user.get('sub'),
            'user_name': user.get('name'),
            'user_pic':  user.get('picture'),
            'anime_id':  anime_id,
            'comment':   comment,
            'rating':    rating,
            'posted_at': datetime.now().isoformat()
        }, on_conflict='user_sub,anime_id').execute()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/comments/<anime_id>/delete', methods=['POST'])
@login_required
def api_delete_comment(anime_id):
    user = session.get('user')
    try:
        supabase.table('comments')\
            .delete()\
            .eq('user_sub', user.get('sub'))\
            .eq('anime_id', anime_id)\
            .execute()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ============ PROFILE ============
@app.route('/profile')
@login_required
def profile_page():
    uid  = get_user_id()
    user = session.get('user')

    try:
        hist_res = supabase.table('watch_history')\
            .select('*').eq('user_sub', uid)\
            .order('watched_at', desc=True).limit(100).execute()
        history = hist_res.data or []
    except:
        history = []

    try:
        comm_res = supabase.table('comments')\
            .select('*').eq('user_sub', uid)\
            .order('posted_at', desc=True).execute()
        my_comments = comm_res.data or []
    except:
        my_comments = []

    total_watched  = len(history)
    rated_comments = [c for c in my_comments if c.get('rating', 0) > 0]
    avg_rating     = round(sum(c['rating'] for c in rated_comments) / len(rated_comments), 1) if rated_comments else 0
    unique_anime   = list({h['anime_id']: h for h in history if h.get('anime_id')}.values())

    stats = {
        'total_watched':  total_watched,
        'total_anime':    len(unique_anime),
        'total_comments': len(my_comments),
        'avg_rating':     avg_rating,
    }

    return render_template('profile.html',
        user=user,
        history=history[:6],
        my_comments=my_comments,
        stats=stats
    )

# Vercel needs this
if __name__ == '__main__':
    app.run(debug=True)

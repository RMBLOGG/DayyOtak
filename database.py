import sqlite3
from datetime import datetime
import json

class NotificationDB:
    def __init__(self):
        self.conn = sqlite3.connect('notifications.db', check_same_thread=False)
        self.create_table()
    
    def create_table(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                link TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Table untuk tracking episode yang sudah dicek
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tracked_episodes (
                episode_id TEXT PRIMARY KEY,
                anime_title TEXT,
                episode_number TEXT,
                tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
    
    def add_notification(self, notif_type, title, message, link=None):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO notifications (type, title, message, link)
            VALUES (?, ?, ?, ?)
        ''', (notif_type, title, message, link))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_notifications(self, limit=10, unread_only=False):
        cursor = self.conn.cursor()
        query = 'SELECT * FROM notifications'
        if unread_only:
            query += ' WHERE is_read = 0'
        query += ' ORDER BY created_at DESC LIMIT ?'
        
        cursor.execute(query, (limit,))
        notifications = []
        for row in cursor.fetchall():
            notifications.append({
                'id': row[0],
                'type': row[1],
                'title': row[2],
                'message': row[3],
                'link': row[4],
                'is_read': row[5],
                'created_at': row[6]
            })
        return notifications
    
    def mark_as_read(self, notif_id):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', (notif_id,))
        self.conn.commit()
    
    def mark_all_as_read(self):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE notifications SET is_read = 1')
        self.conn.commit()
    
    def get_unread_count(self):
        cursor = self.conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM notifications WHERE is_read = 0')
        return cursor.fetchone()[0]
    
    def clear_all(self):
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM notifications')
        self.conn.commit()
    
    # Tracking episodes
    def is_episode_tracked(self, episode_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT episode_id FROM tracked_episodes WHERE episode_id = ?', (episode_id,))
        return cursor.fetchone() is not None
    
    def track_episode(self, episode_id, anime_title, episode_number):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO tracked_episodes (episode_id, anime_title, episode_number)
            VALUES (?, ?, ?)
        ''', (episode_id, anime_title, episode_number))
        self.conn.commit()


class BookmarkDB:
    def __init__(self):
        self.conn = sqlite3.connect('notifications.db', check_same_thread=False)
        self.create_table()
    
    def create_table(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anime_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                poster TEXT,
                status TEXT,
                rating TEXT,
                total_episode TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
    
    def add_bookmark(self, anime_id, title, poster=None, status=None, rating=None, total_episode=None):
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO bookmarks (anime_id, title, poster, status, rating, total_episode)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (anime_id, title, poster, status, rating, total_episode))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Already bookmarked
    
    def remove_bookmark(self, anime_id):
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM bookmarks WHERE anime_id = ?', (anime_id,))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def is_bookmarked(self, anime_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT id FROM bookmarks WHERE anime_id = ?', (anime_id,))
        return cursor.fetchone() is not None
    
    def get_bookmarks(self, limit=None, sort_by='created_at'):
        cursor = self.conn.cursor()
        query = f'SELECT * FROM bookmarks ORDER BY {sort_by} DESC'
        if limit:
            query += f' LIMIT {limit}'
        
        cursor.execute(query)
        bookmarks = []
        for row in cursor.fetchall():
            bookmarks.append({
                'id': row[0],
                'anime_id': row[1],
                'title': row[2],
                'poster': row[3],
                'status': row[4],
                'rating': row[5],
                'total_episode': row[6],
                'created_at': row[7]
            })
        return bookmarks
    
    def get_bookmark_count(self):
        cursor = self.conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM bookmarks')
        return cursor.fetchone()[0]
    
    def clear_all(self):
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM bookmarks')
        self.conn.commit()

# Instance global
notif_db = NotificationDB()
bookmark_db = BookmarkDB()
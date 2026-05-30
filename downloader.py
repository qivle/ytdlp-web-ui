import yt_dlp
import asyncio
import subprocess
import os
import sys
import re

def strip_ansi(text):
    if not text: return ""
    return re.sub(r'\x1b\[[0-9;]*m', '', str(text))

class ParseLogger:
    def __init__(self):
        self.logs = []
    def debug(self, msg):
        self.logs.append(strip_ansi(msg))
    def info(self, msg):
        self.logs.append(strip_ansi(msg))
    def warning(self, msg):
        self.logs.append(f"WARNING: {strip_ansi(msg)}")
    def error(self, msg):
        self.logs.append(f"ERROR: {strip_ansi(msg)}")

class DownloadLogger:
    def __init__(self, ws_queue, loop):
        self.ws_queue = ws_queue
        self.loop = loop
    def send_log(self, msg):
        try:
            clean_msg = strip_ansi(msg)
            self.loop.call_soon_threadsafe(
                self.ws_queue.put_nowait,
                {"status": "log", "message": clean_msg}
            )
        except Exception:
            pass
    def debug(self, msg):
        if msg.startswith('[download]') and ('ETA' in msg or '%' in msg):
            return
        self.send_log(msg)
    def info(self, msg):
        self.send_log(msg)
    def warning(self, msg):
        self.send_log(f"WARNING: {msg}")
    def error(self, msg):
        self.send_log(f"ERROR: {msg}")

def parse_video(url: str, cookie_browser: str = "auto"):
    try:
        if cookie_browser == "auto":
            browsers_to_try = ['chrome', 'firefox', None]
        elif cookie_browser == "none":
            browsers_to_try = [None]
        else:
            browsers_to_try = [cookie_browser]

        last_error = "Unknown error"
        
        info = None
        logger = ParseLogger()
        for browser in browsers_to_try:
            ydl_opts = {
                'extract_flat': False,
                'download': False,
                'quiet': False,
                'no_warnings': False,
                'logger': logger,
                'remote_components': ['ejs:github']
            }
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser, )
                
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    break # Exit loop if successful
            except Exception as e:
                last_error = str(e)
                continue # Try next browser
        else:
            # If the loop finished without breaking, it means all browsers failed
            return {"success": False, "error": last_error, "logs": logger.logs}

        if not info:
            return {"success": False, "error": "Could not extract video information.", "logs": logger.logs}

        formats = info.get('formats', [])
        filtered_formats = []
        
        # Helper to deduplicate formats somewhat
        added_res = set()

        # Get best audio size for estimating total size of video-only formats
        best_audio = next((f for f in reversed(formats) if f.get('vcodec') == 'none' and f.get('acodec') != 'none'), None)
        audio_size = best_audio.get('filesize') or best_audio.get('filesize_approx') or 0 if best_audio else 0

        for f in formats:
            resolution = f.get('resolution') or f"{f.get('width', '')}x{f.get('height', '')}"
            if resolution == 'x':
                resolution = 'Audio Only' if f.get('vcodec') == 'none' else 'Unknown'
            ext = f.get('ext')
            format_id = f.get('format_id')
            format_note = f.get('format_note', '')
            vcodec = str(f.get('vcodec', 'none')).split('.')[0]
            if vcodec == 'none': vcodec = ''
            
            # calculate size
            video_size = f.get('filesize') or f.get('filesize_approx') or 0
            total_size = video_size
            if f.get('vcodec') != 'none' and f.get('acodec') == 'none':
                if video_size > 0 and audio_size > 0:
                    total_size += audio_size
            
            size_str = f"{round(total_size / (1024*1024), 1)} MB" if total_size > 0 else ""

            # Simple heuristic to get good formats
            if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
                # Has both video and audio
                if resolution not in added_res:
                    filtered_formats.append({
                        'format_id': format_id,
                        'resolution': resolution,
                        'ext': ext,
                        'note': format_note,
                        'type': 'video+audio',
                        'vcodec': vcodec,
                        'size_str': size_str
                    })
                    added_res.add(resolution)
            elif f.get('vcodec') != 'none' and f.get('acodec') == 'none':
                # Video only (DASH) - needs merging
                if resolution not in added_res:
                    filtered_formats.append({
                        'format_id': format_id, # Frontend will append +bestaudio
                        'resolution': resolution,
                        'ext': ext,
                        'note': format_note + ' (Video)',
                        'type': 'video',
                        'vcodec': vcodec,
                        'size_str': size_str
                    })
                    added_res.add(resolution)
            elif f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                # Audio Only
                if 'Audio Only' not in added_res:
                    filtered_formats.append({
                        'format_id': format_id,
                        'resolution': 'Audio Only',
                        'ext': ext,
                        'note': f.get('abr', ''),
                        'type': 'audio',
                        'vcodec': '',
                        'size_str': f"{round(audio_size / (1024*1024), 1)} MB" if audio_size > 0 else ""
                    })
                    added_res.add('Audio Only')

        return {
            "success": True,
            "id": info.get('id'),
            "title": info.get('title'),
            "thumbnail": info.get('thumbnail'),
            "channel": info.get('uploader'),
            "duration": info.get('duration_string') or info.get('duration'),
            "formats": filtered_formats[::-1], # best to worst roughly
            "logs": logger.logs
        }
    except Exception as e:
        import traceback
        return {"success": False, "error": f"{str(e)}\n{traceback.format_exc()}", "logs": logger.logs if 'logger' in locals() else []}

async def download_video(url: str, format_id: str, ws_queue: asyncio.Queue, cookie_browser: str = "auto"):
    loop = asyncio.get_running_loop()

    def progress_hook(d):
        if d['status'] == 'downloading':
            percent_raw = strip_ansi(d.get('_percent_str', '0%')).strip()
            percent_clean = re.sub(r'[^\d\.]', '', percent_raw)
            percent = f"{percent_clean}%" if percent_clean else "0%"
            speed = strip_ansi(d.get('_speed_str', '0KiB/s')).strip()
            eta = strip_ansi(d.get('_eta_str', 'Unknown ETA')).strip()
            total = strip_ansi(d.get('_total_bytes_str') or d.get('_total_bytes_estimate_str') or 'Unknown size').strip()
            
            try:
                loop.call_soon_threadsafe(
                    ws_queue.put_nowait, 
                    {"status": "downloading", "percent": percent, "speed": speed, "eta": eta, "total": total}
                )
            except Exception:
                pass
        elif d['status'] == 'finished' or d['status'] == 'stream_finished':
            try:
                loop.call_soon_threadsafe(
                    ws_queue.put_nowait, 
                    {"status": "stream_finished", "filename": d.get('filename')}
                )
            except Exception:
                pass

    # For pure audio format, don't try to merge with bestaudio
    if format_id == 'bestaudio' or 'Audio' in format_id: # Just a heuristic, frontend can send 'bestaudio' for pure audio
        final_format = format_id
    else:
        # For video, ensure we grab audio if it's dash
        final_format = f'{format_id}+bestaudio/best' if format_id else 'best'

    logger = DownloadLogger(ws_queue, loop)
    ydl_opts = {
        'format': final_format,
        'outtmpl': 'downloads/%(title)s [%(id)s].%(ext)s',
        'progress_hooks': [progress_hook],
        'quiet': False,
        'no_warnings': False,
        'logger': logger,
        'remote_components': ['ejs:github']
    }
    
    os.makedirs('downloads', exist_ok=True)

    def run_ydl():
        if cookie_browser == "auto":
            browsers_to_try = ['chrome', 'firefox', None]
        elif cookie_browser == "none":
            browsers_to_try = [None]
        else:
            browsers_to_try = [cookie_browser]

        last_error = None
        
        for browser in browsers_to_try:
            opts = ydl_opts.copy()
            if browser:
                opts['cookiesfrombrowser'] = (browser, )
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([url])
                    return True
            except Exception as e:
                last_error = e
                continue
        
        # If all failed
        if last_error:
            try:
                loop = asyncio.get_running_loop()
                loop.call_soon_threadsafe(
                    ws_queue.put_nowait, 
                    {"status": "error", "message": str(last_error)}
                )
            except Exception:
                pass
        return False

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, run_ydl)

def update_ytdlp():
    try:
        process = subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"], capture_output=True, text=True)
        if process.returncode == 0:
            version_process = subprocess.run([sys.executable, "-m", "yt_dlp", "--version"], capture_output=True, text=True)
            version = version_process.stdout.strip()
            return {"success": True, "output": process.stdout + f"\n\n[Version Check] Successfully updated yt-dlp to version: {version}"}
        else:
            return {"success": False, "error": process.stderr}
    except Exception as e:
        return {"success": False, "error": str(e)}

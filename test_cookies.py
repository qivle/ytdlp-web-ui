import yt_dlp
import sys

url = "https://www.youtube.com/watch?v=A5w_k3GAwrQ"
browsers = ['chrome', 'firefox']

for browser in browsers:
    print(f"Testing browser: {browser}")
    ydl_opts = {
        'extract_flat': False,
        'download': False,
        'quiet': False,
        'no_warnings': False,
        'cookiesfrombrowser': (browser, ),
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            print(f"Success with {browser}!")
            print(f"Title: {info.get('title')}")
            sys.exit(0)
    except Exception as e:
        print(f"Failed with {browser}: {e}")

print("All browsers failed.")

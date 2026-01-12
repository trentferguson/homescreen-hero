from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import get_plex_server
import requests

def debug_transcode():
    config = load_config()
    server = get_plex_server(config)
    
    # Get a collection with a thumb
    col = None
    for section in server.library.sections():
        for c in section.collections():
            if getattr(c, 'thumb', None):
                col = c
                break
        if col: break
    
    if not col:
        print("No collection with thumb found.")
        return

    print(f"Collection: {col.title}")
    print(f"col.thumb: {col.thumb}")
    
    # Option 1: Current implementation (passing path string)
    url1 = server.transcodeImage(col.thumb, height=450, width=300, minSize=1)
    print(f"\nOption 1 (Current - col.thumb):\n{url1}")
    
    # Option 2: Suggestion (passing full URL)
    # Note: col.thumbUrl might not exist on all objects, using server.url() is safer to generate full URL
    full_thumb_url = server.url(col.thumb, includeToken=True)
    url2 = server.transcodeImage(full_thumb_url, height=450, width=300, minSize=1)
    print(f"\nOption 2 (Suggestion - full url):\n{url2}")

    # Test which one works
    print("\nTesting URLs...")
    try:
        r1 = requests.get(url1)
        print(f"Option 1 Status: {r1.status_code}")
    except Exception as e:
        print(f"Option 1 Failed: {e}")

    try:
        r2 = requests.get(url2)
        print(f"Option 2 Status: {r2.status_code}")
    except Exception as e:
        print(f"Option 2 Failed: {e}")

if __name__ == "__main__":
    debug_transcode()

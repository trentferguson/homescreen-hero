"""
Debug script to inspect Letterboxd HTML structure.
Run this to see what HTML elements are actually on the page.
"""

import requests

url = "https://boxd.it/hpNnC"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

print(f"Fetching: {url}")
response = requests.get(url, headers=headers)
print(f"Status Code: {response.status_code}")
print(f"Content Length: {len(response.content)} bytes")
print("\n" + "=" * 60)
print("First 2000 characters of HTML:")
print("=" * 60)
print(response.text[:2000])
print("\n" + "=" * 60)

# Try to find poster-related elements
html_lower = response.text.lower()
print(f"\nSearching for common Letterboxd patterns:")
print(f"  'poster-container' appears: {html_lower.count('poster-container')} times")
print(f"  'film-poster' appears: {html_lower.count('film-poster')} times")
print(f"  'data-film-slug' appears: {html_lower.count('data-film-slug')} times")
print(f"  'poster-list' appears: {html_lower.count('poster-list')} times")
print(f"  'film-detail' appears: {html_lower.count('film-detail')} times")

# Save full HTML to file for inspection
with open('letterboxd_debug.html', 'w', encoding='utf-8') as f:
    f.write(response.text)
print(f"\nFull HTML saved to: letterboxd_debug.html")
print("Open this file in a text editor to inspect the structure.")

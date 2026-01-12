#!/usr/bin/env python3
"""
Simple test script to verify Tautulli client connection.
Usage: python test_tautulli_connection.py <base_url> <api_key> [rating_key]
"""

import sys
import os

# Add the homescreen_hero module to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from homescreen_hero.core.integrations.tautulli_client import TautulliClient, TautulliConfig


def test_tautulli_connection(base_url, api_key, rating_key=None):
    print("=== Tautulli Connection Test ===\n")
    print(f"Connecting to Tautulli at: {base_url}")
    print("=" * 60)

    # Create client
    config = TautulliConfig(api_key=api_key, base_url=base_url)
    client = TautulliClient(config)

    # Test 1: Ping
    print("\n[1/3] Testing connection with ping...")
    ok, error = client.ping()
    if ok:
        print("SUCCESS: Ping successful! Tautulli is reachable")
    else:
        print(f"FAILED: Ping failed: {error}")
        return False

    # Test 2: Get libraries
    print("\n[2/3] Fetching libraries...")
    libraries = client.get_libraries()
    if libraries:
        print(f"SUCCESS: Found {len(libraries)} libraries:")
        for lib in libraries:
            section_id = lib.get('section_id', 'N/A')
            section_name = lib.get('section_name', 'Unknown')
            section_type = lib.get('section_type', 'Unknown')
            count = lib.get('count', 0)
            print(f"   - [{section_id}] {section_name} ({section_type}) - {count} items")
    else:
        print("WARNING: No libraries found")

    # Test 3: Get collection stats (if rating_key provided)
    if rating_key:
        print(f"\n[3/3] Testing collection stats for rating_key {rating_key}...")
        try:
            stats = client.get_collection_stats(int(rating_key))
            print(f"SUCCESS: Stats retrieved:")
            print(f"   - Total plays: {stats.get('total_plays', 0)}")
            print(f"   - Total duration: {stats.get('total_duration', 'N/A')} seconds")
            print(f"   - Total time: {stats.get('total_time', 'N/A')}")
        except Exception as e:
            print(f"WARNING: Error fetching stats: {e}")
    else:
        print("\n[3/3] Skipped collection stats test (no rating_key provided)")

    print("\n" + "=" * 60)
    print("SUCCESS: Test completed successfully!")
    print("\nYour Tautulli configuration:")
    print(f"  base_url: \"{base_url}\"")
    print(f"  api_key: \"{api_key[:10]}...\" (first 10 chars)")
    print("\nYou can add this to your config.yaml:")
    print(f"""
tautulli:
  enabled: true
  base_url: "{base_url}"
  # api_key: "YOUR_API_KEY"  # Or use HSH_TAUTULLI_API_KEY env var
  collect_on_rotation: true
  collect_interval_hours: 24
""")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_tautulli_connection.py <base_url> <api_key> [rating_key]")
        print("\nExample:")
        print('  python test_tautulli_connection.py "http://localhost:8181" "YOUR_API_KEY"')
        print('  python test_tautulli_connection.py "http://localhost:8181" "YOUR_API_KEY" 12345')
        sys.exit(1)

    base_url = sys.argv[1]
    api_key = sys.argv[2]
    rating_key = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        success = test_tautulli_connection(base_url, api_key, rating_key)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nWARNING: Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nERROR: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

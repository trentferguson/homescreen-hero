"""
Test script for Letterboxd sync functionality.

This tests the complete sync flow without actually modifying Plex.
Run this to verify the sync logic works before integrating with the API.
"""

import sys
import logging
from unittest.mock import Mock, MagicMock, patch
from homescreen_hero.core.integrations.letterboxd_sync import sync_single_letterboxd_source
from homescreen_hero.core.config.schema import LetterboxdSource, AppConfig, PlexSettings, RotationSettings

# Enable debug logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_sync():
    """Test the Letterboxd sync with mocked Plex server."""

    logger.info("=" * 60)
    logger.info("Testing Letterboxd Sync")
    logger.info("=" * 60)
    logger.info("")

    # Create a test source
    source = LetterboxdSource(
        name="MCU Infinity Saga",
        url="https://boxd.it/hpNnC",  # Your test list
        plex_library="Movies"
    )

    logger.info(f"Test source: {source.name}")
    logger.info(f"List URL: {source.url}")
    logger.info(f"Target library: {source.plex_library}")
    logger.info("")

    # Create a minimal config (not actually used in this test)
    config = Mock(spec=AppConfig)

    # Mock the Plex server
    mock_server = Mock()
    mock_library = Mock()

    # Mock library.section() to return our mock library
    mock_server.library.section.return_value = mock_library

    # Mock search to simulate finding some movies
    def mock_search(title=None, year=None, **kwargs):
        """Simulate Plex search - find some movies, miss others."""
        # Simulate that we find some movies
        if title and "Captain America" in title:
            mock_item = Mock()
            mock_item.title = title
            mock_item.ratingKey = hash(title) % 10000
            mock_item.addCollection = Mock()
            mock_item.removeCollection = Mock()
            return [mock_item]
        elif title and "Iron Man" in title:
            mock_item = Mock()
            mock_item.title = title
            mock_item.ratingKey = hash(title) % 10000
            mock_item.addCollection = Mock()
            mock_item.removeCollection = Mock()
            return [mock_item]
        else:
            # Simulate not finding other movies
            return []

    mock_library.search = mock_search

    # Mock existing collection (empty for this test)
    mock_collection = Mock()
    mock_collection.items.return_value = []

    def mock_get_collection(name):
        """Return mock collection or raise if doesn't exist."""
        if name == source.name:
            return mock_collection
        raise Exception("Collection not found")

    mock_library.collection = mock_get_collection

    try:
        logger.info("Starting sync...")
        logger.info("This will scrape the Letterboxd list and simulate matching to Plex")
        logger.info("")

        # Mock the database recording function to skip DB operations
        with patch('homescreen_hero.core.integrations.letterboxd_sync.record_missing_items_in_db'):
            # Run the sync
            total, matched = sync_single_letterboxd_source(mock_server, config, source)

        logger.info("")
        logger.info("=" * 60)
        logger.info("SYNC RESULTS")
        logger.info("=" * 60)
        logger.info(f"Total movies in list: {total}")
        logger.info(f"Movies matched in Plex: {matched}")
        logger.info(f"Movies missing from Plex: {total - matched}")
        logger.info("")

        if total > 0:
            logger.info(f"Match rate: {matched}/{total} ({100*matched/total:.1f}%)")

        logger.info("")
        logger.info("=" * 60)
        logger.info("TEST COMPLETED SUCCESSFULLY!")
        logger.info("=" * 60)
        logger.info("")
        logger.info("Note: This was a DRY RUN with a mocked Plex server.")
        logger.info("No actual changes were made to your Plex library.")
        logger.info("")
        logger.info("The sync found movies in the Letterboxd list and simulated")
        logger.info("matching them to your Plex library. In reality, only movies")
        logger.info("with 'Captain America' or 'Iron Man' in the title were 'found'.")

        return True

    except Exception as e:
        logger.error("=" * 60)
        logger.error("TEST FAILED")
        logger.error("=" * 60)
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_sync()
    sys.exit(0 if success else 1)

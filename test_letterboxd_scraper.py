"""
Quick test script for the Letterboxd scraper.

Run this to verify the scraper works before integrating it into the main app.
Usage: python test_letterboxd_scraper.py
"""

import sys
import logging
from homescreen_hero.core.integrations.letterboxd_scraper import get_letterboxd_scraper

# Enable debug logging to see what's happening
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_scraper():
    """Test the Letterboxd scraper with a sample list."""

    # Using the URL you provided as an example
    test_url = "https://boxd.it/hpNnC"

    logger.info("=" * 60)
    logger.info("Testing Letterboxd Scraper")
    logger.info("=" * 60)
    logger.info(f"Test URL: {test_url}")
    logger.info("")

    try:
        scraper = get_letterboxd_scraper()
        logger.info("Scraper initialized successfully")

        # First, test URL normalization
        normalized_url = scraper.normalize_url(test_url)
        logger.info(f"Normalized URL: {normalized_url}")
        logger.info("")

        # Now scrape the list
        logger.info("Starting to scrape list...")
        logger.info("This may take a minute depending on list size...")
        logger.info("")

        movies = scraper.get_list_movies(test_url)

        logger.info("=" * 60)
        logger.info(f"SUCCESS! Found {len(movies)} movies")
        logger.info("=" * 60)
        logger.info("")

        # Show first 10 movies as a sample
        logger.info("First 10 movies:")
        for i, movie in enumerate(movies[:10], 1):
            year_str = f"({movie.year})" if movie.year else "(year unknown)"
            logger.info(f"  {i}. {movie.title} {year_str}")
            logger.info(f"     Slug: {movie.slug}")

        if len(movies) > 10:
            logger.info(f"  ... and {len(movies) - 10} more")

        logger.info("")
        logger.info("=" * 60)
        logger.info("Test completed successfully!")
        logger.info("=" * 60)

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
    success = test_scraper()
    sys.exit(0 if success else 1)

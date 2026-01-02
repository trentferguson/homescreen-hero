import logging
import re
import time
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# Represents a movie scraped from a Letterboxd list
@dataclass
class LetterboxdMovie:
    title: str
    year: Optional[int]
    slug: str  # e.g., "the-shawshank-redemption"
    letterboxd_url: str


# Scrapes movie data from Letterboxd public list pages
class LetterboxdScraper:
    def __init__(self, base_url: str = "https://letterboxd.com", rate_limit_delay: float = 1.0):
        # Initialize the scraper.
        # Args:
        #    base_url: Base URL for Letterboxd (default: https://letterboxd.com)
        #    rate_limit_delay: Delay in seconds between requests (default: 1.0)
        self.base_url = base_url
        self.rate_limit_delay = rate_limit_delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; HomescreenHero/1.0; +https://github.com/your-repo)'
        })

    # Normalize a Letterboxd URL to its canonical form
    def normalize_url(self, url: str) -> str:
        # Follow redirects for short URLs
        if 'boxd.it' in url:
            try:
                response = self.session.head(url, allow_redirects=True, timeout=10)
                url = response.url
            except requests.RequestException as e:
                logger.warning(f"Failed to resolve short URL {url}: {e}")

        # Ensure URL ends with /
        if not url.endswith('/'):
            url += '/'

        return url

    # Scrape all movies from a Letterboxd list, handling pagination
    def get_list_movies(self, list_url: str) -> List[LetterboxdMovie]:
        list_url = self.normalize_url(list_url)
        logger.info(f"Scraping Letterboxd list: {list_url}")

        movies = []
        page = 1

        while True:
            # Construct page URL (page 1 has no /page/1/, subsequent pages do)
            if page == 1:
                page_url = list_url
            else:
                # Remove trailing slash, add page, then slash
                page_url = list_url.rstrip('/') + f'/page/{page}/'

            logger.debug(f"Fetching page {page}: {page_url}")
            page_movies = self._scrape_page(page_url)

            if not page_movies:
                logger.info(f"No movies found on page {page}, stopping pagination")
                break

            logger.info(f"Found {len(page_movies)} movies on page {page}")
            movies.extend(page_movies)

            # Rate limit just to be safe
            if page_movies:  # Only delay if we're continuing
                time.sleep(self.rate_limit_delay)

            page += 1

        logger.info(f"Scraped {len(movies)} total movies from list")
        return movies

    # Scrape a single page of a Letterboxd list
    def _scrape_page(self, url: str) -> List[LetterboxdMovie]:
        try:
            response = self.session.get(url, timeout=30)

            if response.status_code == 404:
                return []

            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch page {url}: {e}")
            return []

        soup = BeautifulSoup(response.content, 'html.parser')
        movies = []

        # Letterboxd uses li.posteritem for each movie in a list
        for item in soup.select('li.posteritem'):
            movie = self._parse_movie_element(item)
            if movie:
                movies.append(movie)

        return movies

    # Extract movie data from a poster item element
    def _parse_movie_element(self, element) -> Optional[LetterboxdMovie]:
        try:
            # The data attributes are on a nested div.react-component, not the li itself
            react_div = element.select_one('div.react-component')
            if not react_div:
                return None

            # Get the slug from data-item-slug attribute
            slug = react_div.get('data-item-slug')
            if not slug:
                return None

            # Get full display name (includes year)
            full_name = react_div.get('data-item-full-display-name', '')
            if not full_name:
                # Fallback to data-item-name
                full_name = react_div.get('data-item-name', '')

            if not full_name:
                return None

            # Parse title and year from full_name
            title, year = self._parse_title_year(full_name)

            letterboxd_url = urljoin(self.base_url, f'/film/{slug}/')

            return LetterboxdMovie(
                title=title,
                year=year,
                slug=slug,
                letterboxd_url=letterboxd_url
            )

        except Exception as e:
            logger.warning(f"Failed to parse movie element: {e}")
            return None

    # Parse a movie title and year from text- ex. "The Shawshank Redemption (1994)"
    def _parse_title_year(self, text: str) -> tuple[str, Optional[int]]:
        # Match year in parentheses at the end
        match = re.search(r'^(.+?)\s*\((\d{4})\)$', text.strip())

        if match:
            title = match.group(1).strip()
            try:
                year = int(match.group(2))
                return title, year
            except ValueError:
                pass

        # No year found, return full text as title
        return text.strip(), None

# Factory function to create a LetterboxdScraper instance
def get_letterboxd_scraper() -> LetterboxdScraper:
    return LetterboxdScraper()

#!/usr/bin/env python3
"""
Reset demo database to initial state.
This script is called during Railway demo restarts to ensure a clean state.
"""

import os
import sys
from pathlib import Path

# Add the app to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.db.base import get_session
from homescreen_hero.core.db.history import init_db
from homescreen_hero.core.db.seed_demo_data import seed_demo_rotation_history
from homescreen_hero.core.db.models import RotationRecord, CollectionUsage


def reset_demo_database():
    """Clear and reseed the demo database."""
    print("Resetting demo database...")

    # Initialize the database schema
    init_db()

    # Get a session
    session = get_session()

    try:
        # Clear existing data
        deleted_rotations = session.query(RotationRecord).delete()
        deleted_usage = session.query(CollectionUsage).delete()
        session.commit()
        print(f"Cleared {deleted_rotations} rotation records and {deleted_usage} usage records")

        # Reseed demo data
        seed_demo_rotation_history(session)
        session.commit()
        print("Demo database reset complete!")

    except Exception as e:
        print(f"Error resetting database: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    reset_demo_database()

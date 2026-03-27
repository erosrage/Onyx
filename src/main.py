"""Application entry point."""
import sys
from app import ObsidianApp


def main() -> None:
    app = ObsidianApp(sys.argv)
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

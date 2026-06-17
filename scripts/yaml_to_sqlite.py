import argparse
import sqlite3
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_YAML_PATH = PROJECT_ROOT / "src" / "pylotto" / "lotto_results.yaml"
DEFAULT_SQLITE_PATH = PROJECT_ROOT / "src" / "pylotto" / "lotto_results.sqlite"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert the lotto YAML dataset into an SQLite database."
    )
    parser.add_argument(
        "--yaml",
        dest="yaml_path",
        type=Path,
        default=DEFAULT_YAML_PATH,
        help="Path to the source YAML file.",
    )
    parser.add_argument(
        "--sqlite",
        dest="sqlite_path",
        type=Path,
        default=DEFAULT_SQLITE_PATH,
        help="Path to the output SQLite database file.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Overwrite the destination database if it already exists.",
    )
    return parser


def load_yaml_draws(yaml_path: Path) -> tuple[dict, list[dict]]:
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    lotto_results = data["lotto_results"]
    draws = lotto_results["draws"]
    return lotto_results, draws


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE dataset_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE draws (
            draw_id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_index INTEGER NOT NULL UNIQUE,
            draw_date TEXT NOT NULL,
            n1 INTEGER NOT NULL,
            n2 INTEGER NOT NULL,
            n3 INTEGER NOT NULL,
            n4 INTEGER NOT NULL,
            n5 INTEGER NOT NULL,
            n6 INTEGER NOT NULL
        );

        CREATE INDEX idx_draws_date ON draws(draw_date);

        CREATE TABLE draw_numbers (
            draw_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            number INTEGER NOT NULL,
            PRIMARY KEY (draw_id, position),
            FOREIGN KEY (draw_id) REFERENCES draws(draw_id) ON DELETE CASCADE
        );

        CREATE INDEX idx_draw_numbers_number ON draw_numbers(number);
        """
    )


def insert_metadata(
    connection: sqlite3.Connection, lotto_results: dict, draw_count: int
) -> None:
    metadata_rows = [
        ("source_yaml", str(lotto_results)),
        ("recorded_total_draws", str(lotto_results.get("total_draws", ""))),
        ("recorded_first_draw", str(lotto_results.get("first_draw", ""))),
        ("recorded_last_draw", str(lotto_results.get("last_draw", ""))),
        ("actual_total_draws", str(draw_count)),
    ]
    connection.executemany(
        "INSERT INTO dataset_metadata (key, value) VALUES (?, ?)",
        metadata_rows,
    )


def insert_draws(connection: sqlite3.Connection, draws: list[dict]) -> None:
    for source_index, item in enumerate(draws):
        numbers = item["numbers"]
        if len(numbers) != 6:
            raise ValueError(
                f"Draw at source index {source_index} on {item['date']} does not have 6 numbers"
            )

        cursor = connection.execute(
            """
            INSERT INTO draws (
                source_index, draw_date, n1, n2, n3, n4, n5, n6
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (source_index, item["date"], *numbers),
        )
        draw_id = cursor.lastrowid
        connection.executemany(
            """
            INSERT INTO draw_numbers (draw_id, position, number)
            VALUES (?, ?, ?)
            """,
            [(draw_id, position, number) for position, number in enumerate(numbers, start=1)],
        )


def convert_yaml_to_sqlite(yaml_path: Path, sqlite_path: Path, replace: bool) -> None:
    if not yaml_path.is_absolute():
        yaml_path = (PROJECT_ROOT / yaml_path).resolve()
    if not sqlite_path.is_absolute():
        sqlite_path = (PROJECT_ROOT / sqlite_path).resolve()

    if not yaml_path.exists():
        raise FileNotFoundError(f"YAML file not found: {yaml_path}")

    if sqlite_path.exists():
        if not replace:
            raise FileExistsError(
                f"SQLite file already exists: {sqlite_path}. Use --replace to overwrite it."
            )
        sqlite_path.unlink()

    sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    lotto_results, draws = load_yaml_draws(yaml_path)
    with sqlite3.connect(sqlite_path) as connection:
        initialize_database(connection)
        insert_metadata(connection, lotto_results, len(draws))
        insert_draws(connection, draws)
        connection.commit()


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    convert_yaml_to_sqlite(args.yaml_path, args.sqlite_path, args.replace)
    print(f"Created SQLite database at: {args.sqlite_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

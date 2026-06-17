import argparse
import sqlite3
from itertools import combinations
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_PATH = PROJECT_ROOT / "src" / "pylotto" / "combinations_1_to_49.sqlite"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate all 6-number combinations from the range 1..49 "
            "and store them in an SQLite database."
        )
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
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10000,
        help="Number of combinations inserted per batch.",
    )
    return parser


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE combinations (
            combination_id INTEGER PRIMARY KEY AUTOINCREMENT,
            n1 INTEGER NOT NULL,
            n2 INTEGER NOT NULL,
            n3 INTEGER NOT NULL,
            n4 INTEGER NOT NULL,
            n5 INTEGER NOT NULL,
            n6 INTEGER NOT NULL,
            combination_text TEXT NOT NULL UNIQUE
        );

        CREATE INDEX idx_combinations_n1_n6
            ON combinations (n1, n2, n3, n4, n5, n6);
        """
    )


def insert_metadata(connection: sqlite3.Connection) -> None:
    metadata_rows = [
        ("number_min", "1"),
        ("number_max", "49"),
        ("draw_size", "6"),
    ]
    connection.executemany(
        "INSERT INTO metadata (key, value) VALUES (?, ?)",
        metadata_rows,
    )


def batched_combinations(batch_size: int):
    batch: list[tuple[int, int, int, int, int, int, str]] = []
    for combo in combinations(range(1, 50), 6):
        batch.append((*combo, ",".join(str(number) for number in combo)))
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def populate_combinations(connection: sqlite3.Connection, batch_size: int) -> int:
    total_inserted = 0
    for batch in batched_combinations(batch_size):
        connection.executemany(
            """
            INSERT INTO combinations (n1, n2, n3, n4, n5, n6, combination_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        total_inserted += len(batch)
        connection.commit()
    return total_inserted


def create_combinations_database(sqlite_path: Path, replace: bool, batch_size: int) -> int:
    if not sqlite_path.is_absolute():
        sqlite_path = (PROJECT_ROOT / sqlite_path).resolve()

    if sqlite_path.exists():
        if not replace:
            raise FileExistsError(
                f"SQLite file already exists: {sqlite_path}. Use --replace to overwrite it."
            )
        sqlite_path.unlink()

    sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(sqlite_path) as connection:
        initialize_database(connection)
        insert_metadata(connection)
        total_inserted = populate_combinations(connection, batch_size)
        connection.execute(
            "INSERT INTO metadata (key, value) VALUES (?, ?)",
            ("total_combinations", str(total_inserted)),
        )
        connection.commit()

    return total_inserted


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be a positive integer")

    total_inserted = create_combinations_database(
        sqlite_path=args.sqlite_path,
        replace=args.replace,
        batch_size=args.batch_size,
    )
    print(f"Created SQLite database at: {args.sqlite_path}")
    print(f"Stored combinations: {total_inserted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

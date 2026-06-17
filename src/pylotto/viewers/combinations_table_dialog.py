import sqlite3
from math import ceil
from pathlib import Path

from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)


class CombinationsTableDialog(QDialog):
    def __init__(
        self,
        sqlite_path: Path,
        allowed_differences: set[int] | None = None,
        allowed_gaps: set[int] | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("All Combinations")
        self.resize(1100, 800)

        self._sqlite_path = sqlite_path
        self._allowed_differences = set(range(1, 45)) if allowed_differences is None else set(allowed_differences)
        self._allowed_gaps = set(range(0, 101)) if allowed_gaps is None else set(allowed_gaps)
        self._page_size = 500
        self._current_page = 1
        self._total_rows = 0
        self._total_pages = 1

        self.status_label = QLabel(self)
        self.filter_label = QLabel(self)

        self.table = QTableWidget(self)
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels(
            ["ID", "N1", "N2", "N3", "N4", "N5", "N6", "Text"]
        )
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)

        self.previous_button = QPushButton("Previous", self)
        self.previous_button.clicked.connect(self.show_previous_page)

        self.page_spinbox = QSpinBox(self)
        self.page_spinbox.setMinimum(1)
        self.page_spinbox.valueChanged.connect(self.go_to_page)

        self.next_button = QPushButton("Next", self)
        self.next_button.clicked.connect(self.show_next_page)

        self.apply_filter_button = QPushButton("Apply Filter", self)
        self.apply_filter_button.clicked.connect(self.apply_filter)

        controls_layout = QHBoxLayout()
        controls_layout.addWidget(self.previous_button)
        controls_layout.addWidget(QLabel("Page", self))
        controls_layout.addWidget(self.page_spinbox)
        controls_layout.addWidget(self.next_button)
        controls_layout.addWidget(self.apply_filter_button)
        controls_layout.addStretch()

        layout = QVBoxLayout(self)
        layout.addWidget(self.status_label)
        layout.addWidget(self.filter_label)
        layout.addWidget(self.table)
        layout.addLayout(controls_layout)

        self.load_page(1)

    def set_allowed_differences(self, allowed_differences: set[int]) -> None:
        self._allowed_differences = set(allowed_differences)

    def set_allowed_gaps(self, allowed_gaps: set[int]) -> None:
        self._allowed_gaps = set(allowed_gaps)

    def _build_filter_sql(self) -> tuple[str, list[int]]:
        if not self._allowed_differences or not self._allowed_gaps:
            return "WHERE 1 = 0", []

        difference_placeholders = ",".join("?" for _ in sorted(self._allowed_differences))
        gap_placeholders = ",".join("?" for _ in sorted(self._allowed_gaps))
        clause = (
            f"WHERE (n2 - n1) IN ({difference_placeholders}) "
            f"AND (n3 - n2) IN ({difference_placeholders}) "
            f"AND (n4 - n3) IN ({difference_placeholders}) "
            f"AND (n5 - n4) IN ({difference_placeholders}) "
            f"AND (n6 - n5) IN ({difference_placeholders}) "
            f"AND (n2 - n1 - 1) IN ({gap_placeholders}) "
            f"AND (n3 - n2 - 1) IN ({gap_placeholders}) "
            f"AND (n4 - n3 - 1) IN ({gap_placeholders}) "
            f"AND (n5 - n4 - 1) IN ({gap_placeholders}) "
            f"AND (n6 - n5 - 1) IN ({gap_placeholders})"
        )
        values = sorted(self._allowed_differences) * 5 + sorted(self._allowed_gaps) * 5
        return clause, values

    def load_page(self, page: int) -> None:
        if not self._sqlite_path.exists():
            QMessageBox.warning(
                self,
                "Database Missing",
                f"Could not find combinations database:\n{self._sqlite_path}",
            )
            return

        try:
            with sqlite3.connect(self._sqlite_path) as connection:
                filter_sql, filter_values = self._build_filter_sql()
                self._total_rows = connection.execute(
                    f"SELECT COUNT(*) FROM combinations {filter_sql}",
                    filter_values,
                ).fetchone()[0]
                self._total_pages = max(1, ceil(self._total_rows / self._page_size))
                self._current_page = max(1, min(page, self._total_pages))
                offset = (self._current_page - 1) * self._page_size
                rows = connection.execute(
                    f"""
                    SELECT combination_id, n1, n2, n3, n4, n5, n6, combination_text
                    FROM combinations
                    {filter_sql}
                    ORDER BY combination_id
                    LIMIT ? OFFSET ?
                    """,
                    [*filter_values, self._page_size, offset],
                ).fetchall()
        except sqlite3.Error as exc:
            QMessageBox.critical(
                self,
                "Database Error",
                f"Could not load combinations from SQLite.\n\n{exc}",
            )
            return

        self.table.setRowCount(len(rows))
        for row_index, row_values in enumerate(rows):
            for column_index, value in enumerate(row_values):
                self.table.setItem(row_index, column_index, QTableWidgetItem(str(value)))

        self.page_spinbox.blockSignals(True)
        self.page_spinbox.setMaximum(self._total_pages)
        self.page_spinbox.setValue(self._current_page)
        self.page_spinbox.blockSignals(False)

        start_row = 0 if self._total_rows == 0 else ((self._current_page - 1) * self._page_size + 1)
        end_row = min(self._current_page * self._page_size, self._total_rows)
        self.status_label.setText(
            f"Showing rows {start_row} to {end_row} of {self._total_rows}"
        )
        if len(self._allowed_differences) == 44:
            differences_text = "all"
        elif self._allowed_differences:
            differences_text = ", ".join(str(value) for value in sorted(self._allowed_differences))
        else:
            differences_text = "none"

        if len(self._allowed_gaps) == 101:
            gaps_text = "all"
        elif self._allowed_gaps:
            gaps_text = ", ".join(str(value) for value in sorted(self._allowed_gaps))
        else:
            gaps_text = "none"

        self.filter_label.setText(
            f"Allowed differences: {differences_text} | Allowed gaps: {gaps_text}"
        )

        self.previous_button.setEnabled(self._current_page > 1)
        self.next_button.setEnabled(self._current_page < self._total_pages)
        self.table.resizeColumnsToContents()

    def show_previous_page(self) -> None:
        self.load_page(self._current_page - 1)

    def show_next_page(self) -> None:
        self.load_page(self._current_page + 1)

    def go_to_page(self, page: int) -> None:
        self.load_page(page)

    def apply_filter(self) -> None:
        self.load_page(1)

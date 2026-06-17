from pathlib import Path
import sys

from PySide6.QtCore import QAbstractTableModel, QModelIndex, Qt
from PySide6.QtWidgets import (
    QApplication,
    QHeaderView,
    QMainWindow,
    QTableView,
)

from src.pylotto.draw_history import DrawHistory


class DrawHistoryGapTableModel(QAbstractTableModel):
    def __init__(self, history: DrawHistory):
        super().__init__()
        self._draws = sorted(history.draws, key=lambda draw: draw.draw_date, reverse=True)
        self._headers = ["Date", "G1", "G2", "G3", "G4", "G5", "G6", "Sum"]

    def rowCount(self, parent=QModelIndex()):
        if parent.isValid():
            return 0
        return len(self._draws)

    def columnCount(self, parent=QModelIndex()):
        if parent.isValid():
            return 0
        return len(self._headers)

    def data(self, index: QModelIndex, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or role != Qt.ItemDataRole.DisplayRole:
            return None

        draw = self._draws[index.row()]
        sorted_gaps = sorted(number.gap for number in draw.numbers())
        values = [draw.draw_date.isoformat(), *sorted_gaps, draw.gap_total]
        return str(values[index.column()])

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole:
            return None

        if orientation == Qt.Orientation.Horizontal:
            return self._headers[section]

        return str(section + 1)


class DrawHistoryGapWindow(QMainWindow):
    def __init__(self, history: DrawHistory):
        super().__init__()
        self.setWindowTitle("Lotto Draw Gap History")
        self.resize(900, 700)

        table = QTableView(self)
        table.setModel(DrawHistoryGapTableModel(history))
        table.setSortingEnabled(False)
        table.verticalHeader().setVisible(False)
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        table.setAlternatingRowColors(True)

        self.setCentralWidget(table)


def main():
    app = QApplication(sys.argv)
    yaml_path = Path(__file__).parent.with_name("lotto_results.yaml")
    history = DrawHistory.from_yaml(yaml_path)
    window = DrawHistoryGapWindow(history)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

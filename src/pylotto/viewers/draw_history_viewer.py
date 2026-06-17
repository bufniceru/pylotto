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


class DrawHistoryTableModel(QAbstractTableModel):
    def __init__(self, history: DrawHistory):
        super().__init__()
        self._draws = sorted(history.draws, key=lambda draw: draw.draw_date, reverse=True)
        self._headers = ["Date", "N1", "N2", "N3", "N4", "N5", "N6", "Sum"]

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
        values = [
            draw.draw_date.isoformat(),
            int(draw.n1),
            int(draw.n2),
            int(draw.n3),
            int(draw.n4),
            int(draw.n5),
            int(draw.n6),
            draw.total,
        ]
        return str(values[index.column()])

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole:
            return None

        if orientation == Qt.Orientation.Horizontal:
            return self._headers[section]

        return str(section + 1)


class DrawHistoryWindow(QMainWindow):
    def __init__(self, history: DrawHistory):
        super().__init__()
        self.setWindowTitle("Lotto Draw History")
        self.resize(900, 700)

        table = QTableView(self)
        table.setModel(DrawHistoryTableModel(history))
        table.setSortingEnabled(False)
        table.verticalHeader().setVisible(False)
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        table.setAlternatingRowColors(True)

        self.setCentralWidget(table)


def main():
    app = QApplication(sys.argv)
    yaml_path = Path(__file__).parent.with_name("lotto_results.yaml")
    history = DrawHistory.from_yaml(yaml_path)
    window = DrawHistoryWindow(history)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

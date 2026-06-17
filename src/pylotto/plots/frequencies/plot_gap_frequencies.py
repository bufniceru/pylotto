import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import QApplication, QDialog, QMainWindow, QVBoxLayout, QWidget

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow | QDialog] = []


def build_gap_frequencies_figure(history: DrawHistory) -> Figure:
    gap_frequencies = history.gap_frequencies()

    gaps = sorted(gap_frequencies)
    frequencies = [gap_frequencies[gap] for gap in gaps]

    figure = Figure(figsize=(14, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.bar(gaps, frequencies, width=0.8, color="goldenrod", edgecolor="black")

    for gap, frequency in zip(gaps, frequencies):
        axis.text(gap, frequency, str(frequency), fontsize=10, ha="center", va="bottom")

    axis.set_xlabel("Gap")
    axis.set_ylabel("Frequency")
    axis.set_title("Gap Frequencies Across All Draw Numbers")
    axis.set_xticks(gaps)
    axis.grid(axis="y", linestyle="--", alpha=0.4)

    figure.tight_layout()
    return figure


def create_gap_frequencies_widget(history: DrawHistory) -> QWidget:
    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(FigureCanvasQTAgg(build_gap_frequencies_figure(history)))
    return container


class GapFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Gap Frequencies")
        self.resize(1200, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_gap_frequencies_widget(history))


def plot_gap_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = GapFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog

import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import QApplication, QDialog, QMainWindow, QVBoxLayout, QWidget

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow | QDialog] = []


def build_draw_gap_sum_frequencies_figure(history: DrawHistory) -> Figure:
    gap_sum_frequencies = history.draw_gap_sum_frequencies()

    sums = sorted(gap_sum_frequencies)
    frequencies = [gap_sum_frequencies[gap_sum] for gap_sum in sums]

    figure = Figure(figsize=(14, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.bar(sums, frequencies, width=0.9, color="darkorange", edgecolor="black")

    for gap_sum, frequency in zip(sums, frequencies):
        axis.text(
            gap_sum,
            frequency,
            str(frequency),
            fontsize=10,
            ha="center",
            va="bottom",
        )

    axis.set_xlabel("Gap Sum")
    axis.set_ylabel("Frequency")
    axis.set_title("Draw Gap Sum Frequencies")
    axis.set_xticks(sums[:: max(1, len(sums) // 20)])
    axis.grid(axis="y", linestyle="--", alpha=0.4)

    figure.tight_layout()
    return figure


def create_draw_gap_sum_frequencies_widget(history: DrawHistory) -> QWidget:
    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(FigureCanvasQTAgg(build_draw_gap_sum_frequencies_figure(history)))
    return container


class DrawGapSumFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Draw Gap Sum Frequencies")
        self.resize(1300, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_draw_gap_sum_frequencies_widget(history))


def plot_draw_gap_sum_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = DrawGapSumFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog

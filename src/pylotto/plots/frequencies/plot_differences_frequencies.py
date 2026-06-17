import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import QApplication, QDialog, QMainWindow, QVBoxLayout, QWidget

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow | QDialog] = []


def build_differences_frequencies_figure(history: DrawHistory) -> Figure:
    difference_frequencies = history.difference_frequencies()

    differences = sorted(difference_frequencies)
    frequencies = [difference_frequencies[difference] for difference in differences]

    figure = Figure(figsize=(14, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.bar(differences, frequencies, width=0.8, color="steelblue", edgecolor="black")

    for difference, frequency in zip(differences, frequencies):
        axis.text(
            difference,
            frequency,
            str(frequency),
            fontsize=10,
            ha="center",
            va="bottom",
        )

    axis.set_xlabel("Difference")
    axis.set_ylabel("Frequency")
    axis.set_title("Sorted Draw Number Difference Frequencies")
    axis.set_xticks(differences)
    axis.grid(axis="y", linestyle="--", alpha=0.4)

    figure.tight_layout()
    return figure


def create_differences_frequencies_widget(history: DrawHistory) -> QWidget:
    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(FigureCanvasQTAgg(build_differences_frequencies_figure(history)))
    return container


class DifferencesFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Differences Frequencies")
        self.resize(1300, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_differences_frequencies_widget(history))


def plot_differences_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = DifferencesFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog

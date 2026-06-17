import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import QApplication, QDialog, QMainWindow, QVBoxLayout, QWidget

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow | QDialog] = []


def build_number_frequencies_figure(history: DrawHistory) -> Figure:
    number_frequencies = history.number_frequencies()

    numbers = sorted(number_frequencies)
    frequencies = [number_frequencies[number] for number in numbers]

    figure = Figure(figsize=(16, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.bar(numbers, frequencies, width=0.8, color="steelblue", edgecolor="black")

    for number, frequency in zip(numbers, frequencies):
        axis.text(number, frequency, str(frequency), fontsize=9, ha="center", va="bottom")

    axis.set_xlabel("Number")
    axis.set_ylabel("Frequency")
    axis.set_title("Number Frequencies Across All Draws")
    axis.set_xticks(numbers)
    axis.grid(axis="y", linestyle="--", alpha=0.4)

    figure.tight_layout()
    return figure


def create_number_frequencies_widget(history: DrawHistory) -> QWidget:
    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(FigureCanvasQTAgg(build_number_frequencies_figure(history)))
    return container


class NumberFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Number Frequencies")
        self.resize(1300, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_number_frequencies_widget(history))


def plot_number_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = NumberFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog

import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import (
    QApplication,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow] = []


class LastSeenHighlightWindow(QMainWindow):
    def __init__(self, history: DrawHistory, count: int | None = None):
        super().__init__()
        self.setWindowTitle("Last Seen Highlight")
        self.resize(1400, 900)

        self.setCentralWidget(create_last_seen_highlight_widget(history, count))


def _limit_history(history: DrawHistory, count: int | None) -> DrawHistory:
    if count is None:
        return history

    if count <= 0:
        raise ValueError("count must be a positive integer")

    limited_history = DrawHistory(
        draws=[draw.model_copy(deep=True) for draw in history.draws[-count:]]
    )
    limited_history.refresh_number_gaps()
    return limited_history


def _last_seen_index_for_reference_draw(
    history: DrawHistory, reference_draw_index: int
) -> dict[int, int | None]:
    last_seen = {n: None for n in range(1, 50)}

    for idx, draw in enumerate(history.draws[: reference_draw_index + 1]):
        for number in draw.numbers():
            last_seen[int(number)] = idx

    return last_seen


def build_last_seen_highlight_figure(
    history: DrawHistory,
    count: int | None = None,
    reference_draw_offset: int = 0,
) -> Figure:
    history_to_plot = _limit_history(history, count)
    if not history_to_plot.draws:
        figure = Figure(figsize=(18, 10), dpi=100)
        axis = figure.add_subplot(111)
        axis.set_title("Last Seen Highlight")
        figure.tight_layout()
        return figure

    max_reference_offset = len(history_to_plot.draws) - 1
    reference_draw_offset = min(max(reference_draw_offset, 0), max_reference_offset)
    reference_draw_index = len(history_to_plot.draws) - 1 - reference_draw_offset
    last_seen = _last_seen_index_for_reference_draw(history_to_plot, reference_draw_index)

    numbers = []
    indices = []

    for number in sorted(last_seen):
        if last_seen[number] is not None:
            numbers.append(number)
            indices.append(last_seen[number])

    max_index = len(history_to_plot.draws) - 1
    draw_indices = list(range(0, max_index + 1))
    row_map = {draw_index: row for row, draw_index in enumerate(draw_indices)}

    figure_height = max(10, len(draw_indices) * 0.35)
    figure = Figure(figsize=(18, figure_height), dpi=100)
    axis = figure.add_subplot(111)

    for draw_index in draw_indices:
        row = row_map[draw_index]
        draw_numbers = sorted(history_to_plot.draws[draw_index].numbers())

        line_width = 1.4 if (max_index - draw_index + 1) % 5 == 0 else 0.5
        axis.hlines(y=row, xmin=1, xmax=49, linewidth=line_width, color="lightgray")
        axis.scatter(draw_numbers, [row] * len(draw_numbers), s=220, color="royalblue", zorder=1)
        for number in draw_numbers:
            axis.text(
                int(number),
                row,
                str(number.gap),
                fontsize=11,
                ha="center",
                va="center",
                color="yellow",
                zorder=2,
            )

    for number, draw_index in zip(numbers, indices):
        row = row_map[draw_index]
        axis.scatter([number], [row], s=220, color="red", zorder=2)
        draw_number = next(
            n for n in history_to_plot.draws[draw_index].numbers() if int(n) == number
        )
        axis.text(
            number,
            row,
            str(draw_number.gap),
            fontsize=11,
            ha="center",
            va="center",
            color="yellow",
            zorder=3,
        )

    y_tick_step = max(1, len(draw_indices) // 30)
    y_tick_positions = list(range(0, len(draw_indices), y_tick_step))
    y_tick_labels = [str(max_index - draw_indices[i] + 1) for i in y_tick_positions]

    axis.set_xticks(range(0, 51))
    axis.set_yticks(y_tick_positions, y_tick_labels, fontsize=8)
    axis.set_xlim(0.5, 49.5)

    reference_draw = history_to_plot.draws[reference_draw_index]
    axis.set_xlabel("Number")
    axis.set_ylabel("Draw Index")
    axis.set_title(
        f"Last Draw (Index) Where Each Number Appeared up to {reference_draw.draw_date.isoformat()}"
    )
    axis.grid(False)

    for x_value in range(0, 51):
        line_width = 1.4 if x_value % 5 == 0 else 0.6
        line_alpha = 0.65 if x_value % 5 == 0 else 0.25
        axis.axvline(
            x=x_value,
            linestyle="--",
            linewidth=line_width,
            color="gray",
            alpha=line_alpha,
            zorder=0,
        )

    figure.tight_layout()
    return figure


class LastSeenHighlightWidget(QWidget):
    def __init__(self, history: DrawHistory, count: int | None = None):
        super().__init__()
        self._history = history
        self._count = count
        self._history_to_plot = _limit_history(history, count)
        self._reference_draw_offset = 0

        self._previous_button = QPushButton("Previous Draw", self)
        self._previous_button.clicked.connect(self._show_previous_draw)
        self._next_button = QPushButton("Next Draw", self)
        self._next_button.clicked.connect(self._show_next_draw)
        self._reference_label = QLabel(self)

        toolbar_layout = QHBoxLayout()
        toolbar_layout.setContentsMargins(0, 0, 0, 0)
        toolbar_layout.addWidget(self._previous_button)
        toolbar_layout.addWidget(self._next_button)
        toolbar_layout.addWidget(self._reference_label)
        toolbar_layout.addStretch()

        self._scroll_area = QScrollArea(self)
        self._scroll_area.setWidgetResizable(False)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addLayout(toolbar_layout)
        layout.addWidget(self._scroll_area)

        self._update_plot()

    def _max_reference_draw_offset(self) -> int:
        return max(0, len(self._history_to_plot.draws) - 1)

    def _current_reference_draw_index(self) -> int:
        return len(self._history_to_plot.draws) - 1 - self._reference_draw_offset

    def _update_plot(self) -> None:
        canvas = FigureCanvasQTAgg(
            build_last_seen_highlight_figure(
                self._history,
                self._count,
                self._reference_draw_offset,
            )
        )
        canvas.setFixedSize(canvas.sizeHint())

        existing_widget = self._scroll_area.takeWidget()
        if existing_widget is not None:
            existing_widget.deleteLater()

        self._scroll_area.setWidget(canvas)

        if self._history_to_plot.draws:
            reference_draw = self._history_to_plot.draws[self._current_reference_draw_index()]
            self._reference_label.setText(
                f"Reference draw: {reference_draw.draw_date.isoformat()}"
            )
        else:
            self._reference_label.setText("Reference draw: none")

        self._previous_button.setEnabled(
            self._reference_draw_offset < self._max_reference_draw_offset()
        )
        self._next_button.setEnabled(self._reference_draw_offset > 0)

    def _show_previous_draw(self) -> None:
        if self._reference_draw_offset < self._max_reference_draw_offset():
            self._reference_draw_offset += 1
            self._update_plot()

    def _show_next_draw(self) -> None:
        if self._reference_draw_offset > 0:
            self._reference_draw_offset -= 1
            self._update_plot()


def create_last_seen_highlight_widget(
    history: DrawHistory, count: int | None = None
) -> QWidget:
    return LastSeenHighlightWidget(history, count)


def plot_last_seen_highlight(history: DrawHistory, count: int | None = None):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    window = LastSeenHighlightWindow(history, count)
    window.show()
    _OPEN_WINDOWS.append(window)

    if owns_app:
        app.exec()

    return window

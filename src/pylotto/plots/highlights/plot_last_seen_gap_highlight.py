import sys

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtWidgets import QApplication, QMainWindow, QScrollArea, QVBoxLayout, QWidget

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow] = []


class LastSeenGapHighlightWindow(QMainWindow):
    def __init__(self, history: DrawHistory, count: int | None = None):
        super().__init__()
        self.setWindowTitle("Last Seen Gap Highlight")
        self.resize(1400, 900)

        self.setCentralWidget(create_last_seen_gap_highlight_widget(history, count))


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


def build_last_seen_gap_highlight_figure(history: DrawHistory, count: int | None = None) -> Figure:
    history_to_plot = _limit_history(history, count)
    last_seen = history_to_plot.gap_last_seen_index()
    gap_gap_maps = history_to_plot.gap_gap_map_by_draw()

    gaps = []
    indices = []

    for gap in sorted(last_seen):
        if last_seen[gap] is not None:
            gaps.append(gap)
            indices.append(last_seen[gap])

    max_index = max(indices)
    draw_indices = list(range(0, max_index + 1))
    row_map = {draw_index: row for row, draw_index in enumerate(draw_indices)}
    max_gap = max(gaps)

    figure_height = max(10, len(draw_indices) * 0.35)
    figure = Figure(figsize=(18, figure_height), dpi=100)
    axis = figure.add_subplot(111)

    for draw_index in draw_indices:
        row = row_map[draw_index]
        draw_numbers = sorted(
            history_to_plot.draws[draw_index].numbers(),
            key=lambda number: number.gap,
        )

        line_width = 1.4 if (max_index - draw_index + 1) % 5 == 0 else 0.5
        axis.hlines(y=row, xmin=0, xmax=max_gap, linewidth=line_width, color="lightgray")
        axis.scatter(
            [number.gap for number in draw_numbers],
            [row] * len(draw_numbers),
            s=220,
            color="royalblue",
            zorder=1,
        )
        for number in draw_numbers:
            axis.text(
                number.gap,
                row,
                str(gap_gap_maps[draw_index][number.gap]),
                fontsize=11,
                ha="center",
                va="center",
                color="yellow",
                zorder=2,
            )

    for gap, draw_index in zip(gaps, indices):
        row = row_map[draw_index]
        axis.scatter([gap], [row], s=220, color="red", zorder=2)
        axis.text(
            gap,
            row,
            str(gap_gap_maps[draw_index][gap]),
            fontsize=11,
            ha="center",
            va="center",
            color="yellow",
            zorder=3,
        )

    y_tick_step = max(1, len(draw_indices) // 30)
    y_tick_positions = list(range(0, len(draw_indices), y_tick_step))
    y_tick_labels = [str(max_index - draw_indices[i] + 1) for i in y_tick_positions]

    axis.set_xticks(range(0, max_gap + 1))
    axis.set_yticks(y_tick_positions, y_tick_labels, fontsize=8)
    axis.set_xlim(-0.5, max_gap + 0.5 if max_gap > 0 else 1)

    axis.set_xlabel("Gap")
    axis.set_ylabel("Draw Index")
    axis.set_title("Last Draw (Index) Where Each Number Appeared, Positioned by Gap")
    axis.grid(False)

    for x_value in range(0, max_gap + 1):
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


def create_last_seen_gap_highlight_widget(
    history: DrawHistory, count: int | None = None
) -> QWidget:
    canvas = FigureCanvasQTAgg(build_last_seen_gap_highlight_figure(history, count))
    canvas.setFixedSize(canvas.sizeHint())

    scroll_area = QScrollArea()
    scroll_area.setWidget(canvas)
    scroll_area.setWidgetResizable(False)

    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(scroll_area)
    return container


def plot_last_seen_gap_highlight(history: DrawHistory, count: int | None = None):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    window = LastSeenGapHighlightWindow(history, count)
    window.show()
    _OPEN_WINDOWS.append(window)

    if owns_app:
        app.exec()

    return window

import subprocess
import sys
import tempfile
from pathlib import Path

from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtCore import QPoint, QTimer, Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QFileDialog,
    QMainWindow,
    QMenu,
    QMessageBox,
    QVBoxLayout,
    QWidget,
)

from src.pylotto.draw_history import DrawHistory


_OPEN_WINDOWS: list[QMainWindow | QDialog] = []
_FFMPEG_EXE = Path(__file__).resolve().parents[4] / "utils" / "ffmpeg" / "bin" / "ffmpeg.exe"
_EXPORT_ERROR_LOG = Path(__file__).resolve().parents[4] / "dynamic_draw_sum_export_error.log"


def build_draw_sum_frequencies_figure(history: DrawHistory) -> Figure:
    sum_frequencies = history.draw_sum_frequencies()

    sums = sorted(sum_frequencies)
    frequencies = [sum_frequencies[draw_sum] for draw_sum in sums]

    figure = Figure(figsize=(14, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.bar(sums, frequencies, width=0.9, color="seagreen", edgecolor="black")

    for draw_sum, frequency in zip(sums, frequencies):
        axis.text(
            draw_sum,
            frequency,
            str(frequency),
            fontsize=10,
            ha="center",
            va="bottom",
        )

    axis.set_xlabel("Draw Sum")
    axis.set_ylabel("Draw Frequency")
    axis.set_title("Draw Sum Frequencies")
    axis.set_xticks(sums[:: max(1, len(sums) // 20)])
    axis.grid(axis="y", linestyle="--", alpha=0.4)

    figure.tight_layout()
    return figure


def build_dynamic_draw_sum_frequencies_figure(history: DrawHistory) -> Figure:
    figure = Figure(figsize=(14, 7), dpi=100)
    axis = figure.add_subplot(111)
    axis.set_xlabel("Draw Sum")
    axis.set_ylabel("Cumulative Frequency")
    axis.set_title("Evolution of Draw Sum Frequencies")
    figure.tight_layout()
    return figure


def create_draw_sum_frequencies_widget(history: DrawHistory) -> QWidget:
    container = QWidget()
    layout = QVBoxLayout(container)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(FigureCanvasQTAgg(build_draw_sum_frequencies_figure(history)))
    return container


def create_dynamic_draw_sum_frequencies_widget(history: DrawHistory) -> QWidget:
    return DynamicDrawSumFrequenciesWidget(history)


class DynamicDrawSumFrequenciesWidget(QWidget):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._draw_sums = [draw.total for draw in history.draws]
        self._min_sum = min(self._draw_sums, default=21)
        self._max_sum = max(self._draw_sums, default=279)
        self._x_values = list(range(self._min_sum, self._max_sum + 1))
        self._states = self._build_states()
        self._frame_index = 0
        self._target_cycle_duration_ms = 8000
        self._timer_interval_ms = 80
        self._frame_step = max(
            1,
            (len(self._states) + max(1, self._target_cycle_duration_ms // self._timer_interval_ms) - 1)
            // max(1, self._target_cycle_duration_ms // self._timer_interval_ms),
        )

        self._figure = build_dynamic_draw_sum_frequencies_figure(history)
        self._canvas = FigureCanvasQTAgg(self._figure)
        self._axis = self._figure.axes[0]
        self._bars = self._axis.bar(
            self._x_values,
            [0] * len(self._x_values),
            width=0.9,
            color="seagreen",
            edgecolor="black",
        )
        self._axis.set_xticks(self._x_values[:: max(1, len(self._x_values) // 20)])
        self._axis.set_xlim(self._min_sum - 1, self._max_sum + 1)
        self._axis.set_ylim(0, max(history.draw_sum_frequencies().values(), default=0) + 1)
        self._axis.grid(axis="y", linestyle="--", alpha=0.4)
        self._status_text = self._axis.text(0.02, 0.95, "", transform=self._axis.transAxes, va="top")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._canvas)

        self._canvas.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self._canvas.customContextMenuRequested.connect(self._show_context_menu)

        self._timer = QTimer(self)
        self._timer.setInterval(self._timer_interval_ms)
        self._timer.timeout.connect(self._advance_frame)

        self._render_frame(0)
        if self._draw_sums:
            self._timer.start()

    def _build_states(self) -> list[list[int]]:
        cumulative_frequencies: dict[int, int] = {x_value: 0 for x_value in self._x_values}
        states: list[list[int]] = []

        for draw_sum in self._draw_sums:
            cumulative_frequencies[draw_sum] += 1
            states.append([cumulative_frequencies[x_value] for x_value in self._x_values])

        if not states:
            return [[0] * len(self._x_values)]
        return states

    def _advance_frame(self) -> None:
        self._frame_index = (self._frame_index + self._frame_step) % len(self._states)
        self._render_frame(self._frame_index)

    def _render_frame(self, frame_index: int) -> None:
        y_values = self._states[frame_index]
        for bar, height in zip(self._bars, y_values):
            bar.set_height(height)

        if self._draw_sums:
            self._status_text.set_text(
                f"Draws included: {frame_index + 1}/{len(self._draw_sums)}"
            )
        else:
            self._status_text.set_text("Draws included: 0/0")

        self._canvas.draw_idle()

    def _show_context_menu(self, position: QPoint) -> None:
        menu = QMenu(self)
        save_action = QAction("Save Animation As...", self)
        save_action.triggered.connect(self._save_animation)
        menu.addAction(save_action)
        menu.exec(self._canvas.mapToGlobal(position))

    def _save_animation(self) -> None:
        file_path, selected_filter = QFileDialog.getSaveFileName(
            self,
            "Save Animation",
            "draw-sum-frequencies.mp4",
            "MP4 Video (*.mp4);;GIF Files (*.gif)",
        )
        if not file_path:
            return

        output_path = Path(file_path)
        if selected_filter.startswith("MP4") and output_path.suffix.lower() != ".mp4":
            output_path = output_path.with_suffix(".mp4")
        if selected_filter.startswith("GIF") and output_path.suffix.lower() != ".gif":
            output_path = output_path.with_suffix(".gif")

        was_running = self._timer.isActive()
        if was_running:
            self._timer.stop()

        current_frame_index = self._frame_index

        try:
            if not _FFMPEG_EXE.exists():
                raise FileNotFoundError(f"ffmpeg executable not found at {_FFMPEG_EXE}")

            frame_indices = list(range(0, len(self._states), self._frame_step))
            if not frame_indices:
                frame_indices = [0]
            elif frame_indices[-1] != len(self._states) - 1:
                frame_indices.append(len(self._states) - 1)

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_dir_path = Path(temp_dir)

                for sequence_index, frame_index in enumerate(frame_indices):
                    self._render_frame(frame_index)
                    frame_path = temp_dir_path / f"frame_{sequence_index:05d}.png"
                    self._figure.savefig(frame_path, dpi=self._figure.dpi)

                fps = max(1, round(1000 / self._timer_interval_ms))
                input_pattern = str(temp_dir_path / "frame_%05d.png")
                ffmpeg_command = [
                    str(_FFMPEG_EXE),
                    "-y",
                    "-framerate",
                    str(fps),
                    "-i",
                    input_pattern,
                ]

                if output_path.suffix.lower() == ".mp4":
                    ffmpeg_command.extend(
                        [
                            "-vf",
                            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                            "-c:v",
                            "libx264",
                            "-pix_fmt",
                            "yuv420p",
                            str(output_path),
                        ]
                    )
                else:
                    ffmpeg_command.extend(["-vf", "fps=12", str(output_path)])

                completed = subprocess.run(
                    ffmpeg_command,
                    check=False,
                    capture_output=True,
                    text=True,
                )
                if completed.returncode != 0:
                    raise RuntimeError(
                        completed.stderr.strip()
                        or completed.stdout.strip()
                        or "ffmpeg export failed"
                    )
        except Exception as exc:
            error_text = str(exc)
            _EXPORT_ERROR_LOG.write_text(error_text, encoding="utf-8")

            message_box = QMessageBox(self)
            message_box.setIcon(QMessageBox.Icon.Critical)
            message_box.setWindowTitle("Save Animation Failed")
            message_box.setText("Could not save the animation.")
            message_box.setInformativeText(
                f"Full error was also written to:\n{_EXPORT_ERROR_LOG}"
            )
            message_box.setDetailedText(error_text)
            message_box.exec()
        else:
            QMessageBox.information(
                self,
                "Animation Saved",
                f"Saved animation to:\n{output_path}",
            )
        finally:
            self._frame_index = current_frame_index
            self._render_frame(self._frame_index)
            if was_running and self._draw_sums:
                self._timer.start()


class DrawSumFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Draw Sum Frequencies")
        self.resize(1300, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_draw_sum_frequencies_widget(history))


class DynamicDrawSumFrequenciesDialog(QDialog):
    def __init__(self, history: DrawHistory, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Dynamic Draw Sum Frequencies")
        self.resize(1300, 800)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(create_dynamic_draw_sum_frequencies_widget(history))


def plot_draw_sum_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = DrawSumFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog


def plot_dynamic_draw_sum_frequencies(history: DrawHistory):
    app = QApplication.instance()
    owns_app = app is None
    if app is None:
        app = QApplication(sys.argv)

    dialog = DynamicDrawSumFrequenciesDialog(history)
    dialog.show()
    _OPEN_WINDOWS.append(dialog)

    if owns_app:
        app.exec()

    return dialog

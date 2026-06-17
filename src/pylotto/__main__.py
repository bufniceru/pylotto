import sys
from pathlib import Path

import yaml
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QLabel,
    QMainWindow,
    QScrollArea,
    QSpinBox,
    QTabWidget,
    QToolBar,
    QVBoxLayout,
    QWidget,
)

from src.pylotto.draw_history import DrawHistory
from src.pylotto.plots.frequencies.plot_differences_frequencies import (
    DifferencesFrequenciesDialog,
)
from src.pylotto.plots.frequencies.plot_draw_gap_sum_frequencies import (
    DrawGapSumFrequenciesDialog,
)
from src.pylotto.plots.frequencies.plot_draw_sum_frequencies import (
    DrawSumFrequenciesDialog,
    DynamicDrawSumFrequenciesDialog,
)
from src.pylotto.plots.frequencies.plot_gap_frequencies import GapFrequenciesDialog
from src.pylotto.plots.highlights.plot_last_seen_difference_highlight import (
    create_last_seen_difference_highlight_widget,
)
from src.pylotto.plots.highlights.plot_last_seen_gap_highlight import (
    create_last_seen_gap_highlight_widget,
)
from src.pylotto.plots.highlights.plot_last_seen_offset_highlight import (
    create_last_seen_offset_highlight_widget,
)
from src.pylotto.plots.highlights.plot_last_seen_highlight import (
    create_last_seen_highlight_widget,
)
from src.pylotto.plots.frequencies.plot_number_frequencies import (
    NumberFrequenciesDialog,
)
from src.pylotto.viewers.combinations_table_dialog import CombinationsTableDialog


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("PyLotto")
        self._history = DrawHistory.from_yaml(Path(__file__).with_name("lotto_results.yaml"))
        self._combinations_sqlite_path = Path(__file__).with_name("combinations_1_to_49.sqlite")
        self._combinations_settings_path = Path(__file__).with_name("combinations_settings.yaml")
        default_plot_count = min(250, len(self._history.draws))
        self._last_seen_highlight_count = default_plot_count
        self._last_seen_gap_highlight_count = default_plot_count
        self._last_seen_difference_highlight_count = default_plot_count
        self._last_seen_offset_highlight_count = default_plot_count
        self._allowed_combination_differences = self._load_allowed_combination_differences()
        self._allowed_combination_gaps = self._load_allowed_combination_gaps()

        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.setCentralWidget(self.tabs)

        toolbar = QToolBar("Main Toolbar", self)
        self.addToolBar(toolbar)

        last_seen_action = QAction("Last Seen Highlight", self)
        last_seen_action.triggered.connect(self.show_last_seen_highlight_tab)
        toolbar.addAction(last_seen_action)

        last_seen_gap_action = QAction("Last Seen Gap Highlight", self)
        last_seen_gap_action.triggered.connect(self.show_last_seen_gap_highlight_tab)
        toolbar.addAction(last_seen_gap_action)

        last_seen_difference_action = QAction("Last Seen Difference Highlight", self)
        last_seen_difference_action.triggered.connect(self.show_last_seen_difference_highlight_tab)
        toolbar.addAction(last_seen_difference_action)

        last_seen_offset_action = QAction("Last Seen Offset Highlight", self)
        last_seen_offset_action.triggered.connect(self.show_last_seen_offset_highlight_tab)
        toolbar.addAction(last_seen_offset_action)

        gap_frequencies_action = QAction("Gap Frequencies", self)
        gap_frequencies_action.triggered.connect(self.show_gap_frequencies_dialog)

        number_frequencies_action = QAction("Number Frequencies", self)
        number_frequencies_action.triggered.connect(self.show_number_frequencies_dialog)

        draw_sum_frequencies_action = QAction("Draw Sum Frequencies", self)
        draw_sum_frequencies_action.triggered.connect(self.show_draw_sum_frequencies_dialog)

        dynamic_draw_sum_frequencies_action = QAction("Dynamic Draw Sum Frequencies", self)
        dynamic_draw_sum_frequencies_action.triggered.connect(
            self.show_dynamic_draw_sum_frequencies_dialog
        )

        draw_gap_sum_frequencies_action = QAction("Draw Gap Sum Frequencies", self)
        draw_gap_sum_frequencies_action.triggered.connect(
            self.show_draw_gap_sum_frequencies_dialog
        )

        differences_frequencies_action = QAction("Differences Frequencies", self)
        differences_frequencies_action.triggered.connect(
            self.show_differences_frequencies_dialog
        )

        combinations_table_action = QAction("All Combinations Table", self)
        combinations_table_action.triggered.connect(self.show_combinations_table_dialog)

        settings_action = QAction("Program Settings", self)
        settings_action.triggered.connect(self.show_settings_dialog)
        combinations_settings_action = QAction("Filter Settings", self)
        combinations_settings_action.triggered.connect(self.show_combinations_settings_dialog)

        file_menu = self.menuBar().addMenu("File")
        frequencies_menu = file_menu.addMenu("Frequencies")
        frequencies_menu.addAction(number_frequencies_action)
        frequencies_menu.addAction(gap_frequencies_action)
        frequencies_menu.addAction(draw_sum_frequencies_action)
        frequencies_menu.addAction(dynamic_draw_sum_frequencies_action)
        frequencies_menu.addAction(draw_gap_sum_frequencies_action)
        frequencies_menu.addAction(differences_frequencies_action)
        combinations_menu = file_menu.addMenu("Combinations")
        combinations_menu.addAction(combinations_table_action)

        settings_menu = self.menuBar().addMenu("Settings")
        settings_menu.addAction(settings_action)
        combinations_settings_menu = self.menuBar().addMenu("Combinations Settings")
        combinations_settings_menu.addAction(combinations_settings_action)

    def show_last_seen_highlight_tab(self) -> None:
        self._show_or_replace_tab(
            "Last Seen Highlight",
            create_last_seen_highlight_widget(
                self._history,
                self._last_seen_highlight_count,
            ),
        )

    def show_last_seen_gap_highlight_tab(self) -> None:
        self._show_or_replace_tab(
            "Last Seen Gap Highlight",
            create_last_seen_gap_highlight_widget(
                self._history,
                self._last_seen_gap_highlight_count,
            ),
        )

    def show_last_seen_difference_highlight_tab(self) -> None:
        self._show_or_replace_tab(
            "Last Seen Difference Highlight",
            create_last_seen_difference_highlight_widget(
                self._history,
                self._last_seen_difference_highlight_count,
            ),
        )

    def show_last_seen_offset_highlight_tab(self) -> None:
        self._show_or_replace_tab(
            "Last Seen Offset Highlight",
            create_last_seen_offset_highlight_widget(
                self._history,
                self._last_seen_offset_highlight_count,
            ),
        )

    def _show_or_replace_tab(self, tab_title: str, plot_widget) -> None:
        existing_index = self._find_tab(tab_title)

        if existing_index != -1:
            existing_widget = self.tabs.widget(existing_index)
            self.tabs.removeTab(existing_index)
            if existing_widget is not None:
                existing_widget.deleteLater()
            self.tabs.insertTab(existing_index, plot_widget, tab_title)
            self.tabs.setCurrentIndex(existing_index)
            return

        new_index = self.tabs.addTab(plot_widget, tab_title)
        self.tabs.setCurrentIndex(new_index)

    def _refresh_plot_tab_if_open(self, tab_title: str) -> None:
        existing_index = self._find_tab(tab_title)
        if existing_index == -1:
            return

        if tab_title == "Last Seen Highlight":
            self.show_last_seen_highlight_tab()
            return

        if tab_title == "Last Seen Gap Highlight":
            self.show_last_seen_gap_highlight_tab()
            return

        if tab_title == "Last Seen Difference Highlight":
            self.show_last_seen_difference_highlight_tab()
            return

        if tab_title == "Last Seen Offset Highlight":
            self.show_last_seen_offset_highlight_tab()

    def _find_tab(self, title: str) -> int:
        for index in range(self.tabs.count()):
            if self.tabs.tabText(index) == title:
                return index
        return -1

    def close_tab(self, index: int) -> None:
        widget = self.tabs.widget(index)
        self.tabs.removeTab(index)
        if widget is not None:
            widget.deleteLater()

    def show_settings_dialog(self) -> None:
        dialog = ProgramSettingsDialog(
            last_seen_highlight_count=self._last_seen_highlight_count,
            last_seen_gap_highlight_count=self._last_seen_gap_highlight_count,
            last_seen_difference_highlight_count=self._last_seen_difference_highlight_count,
            last_seen_offset_highlight_count=self._last_seen_offset_highlight_count,
            max_draw_count=len(self._history.draws),
            parent=self,
        )
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._last_seen_highlight_count = dialog.last_seen_highlight_count()
            self._last_seen_gap_highlight_count = dialog.last_seen_gap_highlight_count()
            self._last_seen_difference_highlight_count = (
                dialog.last_seen_difference_highlight_count()
            )
            self._last_seen_offset_highlight_count = dialog.last_seen_offset_highlight_count()
            self._refresh_plot_tab_if_open("Last Seen Highlight")
            self._refresh_plot_tab_if_open("Last Seen Gap Highlight")
            self._refresh_plot_tab_if_open("Last Seen Difference Highlight")
            self._refresh_plot_tab_if_open("Last Seen Offset Highlight")

    def show_combinations_settings_dialog(self) -> None:
        dialog = CombinationsSettingsDialog(
            allowed_differences=self._allowed_combination_differences,
            allowed_gaps=self._allowed_combination_gaps,
            parent=self,
        )
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._allowed_combination_differences = dialog.allowed_differences()
            self._allowed_combination_gaps = dialog.allowed_gaps()
            self._save_combination_filters()

    def show_gap_frequencies_dialog(self) -> None:
        dialog = GapFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_number_frequencies_dialog(self) -> None:
        dialog = NumberFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_draw_sum_frequencies_dialog(self) -> None:
        dialog = DrawSumFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_dynamic_draw_sum_frequencies_dialog(self) -> None:
        dialog = DynamicDrawSumFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_draw_gap_sum_frequencies_dialog(self) -> None:
        dialog = DrawGapSumFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_differences_frequencies_dialog(self) -> None:
        dialog = DifferencesFrequenciesDialog(self._history, self)
        dialog.exec()

    def show_combinations_table_dialog(self) -> None:
        dialog = CombinationsTableDialog(
            self._combinations_sqlite_path,
            self._allowed_combination_differences,
            self._allowed_combination_gaps,
            self,
        )
        dialog.exec()

    def _load_allowed_combination_differences(self) -> set[int]:
        default_differences = set(range(1, 45))
        data = self._load_combinations_settings_data()
        if data is None:
            return default_differences

        allowed_differences = data.get("allowed_differences")
        if not isinstance(allowed_differences, list):
            return default_differences

        normalized = {
            value
            for value in allowed_differences
            if isinstance(value, int) and 1 <= value <= 44
        }
        return normalized if normalized else default_differences

    def _load_allowed_combination_gaps(self) -> set[int]:
        default_gaps = set(range(0, 101))
        data = self._load_combinations_settings_data()
        if data is None:
            return default_gaps

        allowed_gaps = data.get("allowed_gaps")
        if not isinstance(allowed_gaps, list):
            return default_gaps

        normalized = {
            value
            for value in allowed_gaps
            if isinstance(value, int) and 0 <= value <= 100
        }
        return normalized if normalized else default_gaps

    def _load_combinations_settings_data(self) -> dict | None:
        if not self._combinations_settings_path.exists():
            return None

        try:
            return yaml.safe_load(
                self._combinations_settings_path.read_text(encoding="utf-8")
            ) or {}
        except yaml.YAMLError:
            return None

    def _save_combination_filters(self) -> None:
        settings = {
            "allowed_differences": sorted(self._allowed_combination_differences),
            "allowed_gaps": sorted(self._allowed_combination_gaps),
        }
        self._combinations_settings_path.write_text(
            yaml.safe_dump(settings, sort_keys=False),
            encoding="utf-8",
        )


class ProgramSettingsDialog(QDialog):
    def __init__(
        self,
        last_seen_highlight_count: int,
        last_seen_gap_highlight_count: int,
        last_seen_difference_highlight_count: int,
        last_seen_offset_highlight_count: int,
        max_draw_count: int,
        parent: QMainWindow | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Program Settings")
        self.resize(500, 350)

        plots_group = QGroupBox("Plots", self)
        plots_layout = QFormLayout(plots_group)

        self.last_seen_highlight_count_spinbox = QSpinBox(plots_group)
        self.last_seen_highlight_count_spinbox.setRange(1, max_draw_count)
        self.last_seen_highlight_count_spinbox.setValue(last_seen_highlight_count)
        plots_layout.addRow(
            "Last Seen Highlight draw count",
            self.last_seen_highlight_count_spinbox,
        )

        self.last_seen_gap_highlight_count_spinbox = QSpinBox(plots_group)
        self.last_seen_gap_highlight_count_spinbox.setRange(1, max_draw_count)
        self.last_seen_gap_highlight_count_spinbox.setValue(last_seen_gap_highlight_count)
        plots_layout.addRow(
            "Last Seen Gap Highlight draw count",
            self.last_seen_gap_highlight_count_spinbox,
        )

        self.last_seen_difference_highlight_count_spinbox = QSpinBox(plots_group)
        self.last_seen_difference_highlight_count_spinbox.setRange(1, max_draw_count)
        self.last_seen_difference_highlight_count_spinbox.setValue(
            last_seen_difference_highlight_count
        )
        plots_layout.addRow(
            "Last Seen Difference Highlight draw count",
            self.last_seen_difference_highlight_count_spinbox,
        )

        self.last_seen_offset_highlight_count_spinbox = QSpinBox(plots_group)
        self.last_seen_offset_highlight_count_spinbox.setRange(1, max_draw_count)
        self.last_seen_offset_highlight_count_spinbox.setValue(
            last_seen_offset_highlight_count
        )
        plots_layout.addRow(
            "Last Seen Offset Highlight draw count",
            self.last_seen_offset_highlight_count_spinbox,
        )

        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel,
            parent=self,
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(plots_group)
        layout.addStretch()
        layout.addWidget(button_box)

    def last_seen_highlight_count(self) -> int:
        return self.last_seen_highlight_count_spinbox.value()

    def last_seen_gap_highlight_count(self) -> int:
        return self.last_seen_gap_highlight_count_spinbox.value()

    def last_seen_difference_highlight_count(self) -> int:
        return self.last_seen_difference_highlight_count_spinbox.value()

    def last_seen_offset_highlight_count(self) -> int:
        return self.last_seen_offset_highlight_count_spinbox.value()


class CombinationsSettingsDialog(QDialog):
    def __init__(
        self,
        allowed_differences: set[int],
        allowed_gaps: set[int],
        parent: QMainWindow | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Combinations Filter Settings")
        self.resize(700, 550)

        self._difference_checkboxes: dict[int, QCheckBox] = {}
        self._gap_checkboxes: dict[int, QCheckBox] = {}

        tabs = QTabWidget(self)
        tabs.addTab(
            self._build_checkbox_tab(
                title="Differences Between Numbers",
                description="Select allowed adjacent differences for combinations.",
                values=range(1, 45),
                selected_values=allowed_differences,
                checkbox_store=self._difference_checkboxes,
                columns=6,
            ),
            "Differences",
        )
        tabs.addTab(
            self._build_checkbox_tab(
                title="Gaps Between Numbers",
                description="Select allowed adjacent gaps for combinations.",
                values=range(0, 101),
                selected_values=allowed_gaps,
                checkbox_store=self._gap_checkboxes,
                columns=8,
            ),
            "Gaps",
        )

        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel,
            parent=self,
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addWidget(tabs)
        layout.addWidget(button_box)

    def _build_checkbox_tab(
        self,
        title: str,
        description: str,
        values: range,
        selected_values: set[int],
        checkbox_store: dict[int, QCheckBox],
        columns: int,
    ) -> QWidget:
        container = QGroupBox(title, self)
        grid = QGridLayout(container)

        for index, value in enumerate(values):
            checkbox = QCheckBox(str(value), container)
            checkbox.setChecked(value in selected_values)
            checkbox_store[value] = checkbox
            row = index // columns
            column = index % columns
            grid.addWidget(checkbox, row, column)

        content = QVBoxLayout()
        content.addWidget(QLabel(description, self))
        content.addWidget(container)
        content.addStretch()

        content_widget = QWidget(self)
        content_widget.setLayout(content)

        scroll_area = QScrollArea(self)
        scroll_area.setWidgetResizable(True)
        scroll_area.setWidget(content_widget)
        return scroll_area

    def allowed_differences(self) -> set[int]:
        return {
            difference
            for difference, checkbox in self._difference_checkboxes.items()
            if checkbox.isChecked()
        }

    def allowed_gaps(self) -> set[int]:
        return {
            gap
            for gap, checkbox in self._gap_checkboxes.items()
            if checkbox.isChecked()
        }


def main() -> int:
    app = QApplication(sys.argv)
    window = MainWindow()
    window.showMaximized()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())

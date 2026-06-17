from collections import Counter
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# Example input: array of records, each with 6 integers
records = [
    [1, 5, 8, 10, 22, 35],
    [3, 7, 12, 18, 25, 40],
    [2, 6, 11, 13, 28, 30],
    [1, 5, 8, 10, 22, 35],
    [4, 9, 14, 15, 20, 21],
    [3, 7, 12, 18, 25, 40],
]

# Compute sums
sums = [sum(record) for record in records]

# For lotto-like 6/49 data, possible sums are from 21 to 279
min_sum = 21
max_sum = 279
x_values = list(range(min_sum, max_sum + 1))

# Build cumulative frequency states
counter = Counter()
states = []

for s in sums:
    counter[s] += 1
    states.append([counter[x] for x in x_values])

# Set up plot
fig, ax = plt.subplots(figsize=(14, 6))
bars = ax.bar(x_values, [0] * len(x_values))

ax.set_title("Evolution of Sum Frequencies")
ax.set_xlabel("Sum of the 6 numbers")
ax.set_ylabel("Cumulative Frequency")
ax.set_xlim(min_sum - 1, max_sum + 1)
ax.set_ylim(0, max(max(state) for state in states) + 1)

text = ax.text(0.02, 0.95, "", transform=ax.transAxes, va="top")

def update(frame):
    y_values = states[frame]

    for bar, height in zip(bars, y_values):
        bar.set_height(height)

    text.set_text(f"Records included: {frame + 1}/{len(records)}")
    ax.set_title("Evolution of Sum Frequencies")
    return list(bars) + [text]

ani = FuncAnimation(
    fig,
    update,
    frames=len(states),
    interval=500,   # milliseconds between frames
    blit=False,
    repeat=True
)

plt.tight_layout()
plt.show()

import { GRADE_RULES, Grade, SPRITES, SpriteKey } from "./market-data";

export function PixelSprite({
  spriteKey,
  label,
  small = false,
}: {
  spriteKey: SpriteKey;
  label: string;
  small?: boolean;
}) {
  const sprite = SPRITES[spriteKey];
  return (
    <div
      className={`pixel-sprite${small ? " pixel-sprite--small" : ""}`}
      role="img"
      aria-label={`${label}像素圖卡`}
    >
      {sprite.pixels.flatMap((row, rowIndex) =>
        row.split("").map((pixel, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className="pixel-sprite__cell"
            style={{
              backgroundColor:
                pixel === "."
                  ? "transparent"
                  : sprite.palette[pixel as keyof typeof sprite.palette],
            }}
          />
        )),
      )}
    </div>
  );
}

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className={`grade-badge grade-badge--${grade.toLowerCase()}`}>
      <strong>{grade}</strong>
      <span>{GRADE_RULES[grade].name}</span>
    </span>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__face" aria-hidden="true">□‿□</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

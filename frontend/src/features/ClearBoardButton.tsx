export function ClearBoardButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="clear-board" onClick={onClick}>
      Clear board
    </button>
  );
}

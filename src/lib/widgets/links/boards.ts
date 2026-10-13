/**
 * Verzeichnis der Link-Boards auf der Page, damit `1…9` ohne Fokus auf einem Board das
 * erste Board (in Dokument-Reihenfolge) ansprechen kann.
 */
export type BoardHandle = { element: HTMLElement; openNth: (n: number) => void };

const boards = new Set<BoardHandle>();

export function registerBoard(board: BoardHandle): () => void {
	boards.add(board);
	return () => boards.delete(board);
}

export function firstBoard(): BoardHandle | undefined {
	return [...boards]
		.filter((board) => board.element.isConnected)
		.sort((a, b) =>
			a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
		)[0];
}

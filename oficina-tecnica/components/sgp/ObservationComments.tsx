"use client";

export type ObservationComment = {
  id: string;
  observationId: string;
  author: string;
  message: string;
  createdAt: string;
};

type ObservationCommentsProps = {
  comments: ObservationComment[];
  onAddComment: (message: string) => void;
};

export function ObservationComments({ comments, onAddComment }: ObservationCommentsProps) {
  const handleSubmit = (formData: FormData) => {
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    onAddComment(message);
  };

  return (
    <div className="flex min-h-0 flex-col rounded border border-border bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
        <p className="text-[12px] font-semibold text-stone-800">Comentarios</p>
        <span className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
          {comments.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-stone-50 text-stone-500">
            <tr>
              <th className="w-[150px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Fecha</th>
              <th className="w-[130px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Autor</th>
              <th className="border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {comments.length ? (
              comments.map((comment) => (
                <tr key={comment.id} className="border-b border-stone-100 align-top">
                  <td className="px-2 py-1.5 text-stone-500">{comment.createdAt}</td>
                  <td className="px-2 py-1.5 font-medium text-stone-700">{comment.author}</td>
                  <td className="whitespace-pre-wrap px-2 py-1.5 text-stone-700">{comment.message}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-2 py-6 text-center text-[11px] text-stone-400">
                  Sin comentarios registrados en preview.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        action={handleSubmit}
        className="flex flex-none items-end gap-2 border-t border-stone-200 bg-stone-50 px-2 py-2"
      >
        <label className="min-w-0 flex-1 text-[10.5px] font-medium text-stone-500">
          Nuevo comentario
          <textarea
            name="message"
            rows={2}
            className="mt-1 w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500"
            placeholder="Escribe un comentario para el historial local"
          />
        </label>
        <button
          type="submit"
          className="h-8 rounded border border-teal-700 bg-teal-700 px-3 text-[11px] font-semibold text-white hover:bg-teal-800"
        >
          Añadir
        </button>
      </form>
    </div>
  );
}

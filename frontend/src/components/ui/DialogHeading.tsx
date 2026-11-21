import type { ReactNode } from "react";

/** Kicker + headline + description used at the top of every dialog. */
export function DialogHeading({ kicker, title, description }: { kicker: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <>
      <span className="modal-kicker">{kicker}</span>
      <h2>
        {title}
        <span>.</span>
      </h2>
      {description && <p className="modal-description">{description}</p>}
    </>
  );
}

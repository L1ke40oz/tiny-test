import { useEffect, useState } from "react";

export function Preferences() {
  const [reduced, setReduced] = useState(
    () => localStorage.getItem("pbp-reduced-motion") === "true",
  );
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
    localStorage.setItem("pbp-reduced-motion", String(reduced));
  }, [reduced]);
  return (
    <label className="view-settings">
      <input
        type="checkbox"
        checked={reduced}
        onChange={(event) => setReduced(event.target.checked)}
      />
      减少动画
    </label>
  );
}

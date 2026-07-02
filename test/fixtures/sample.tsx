import { on, ss } from "tailess";

export const a = ss({ base: "flex", md: "text-2xl text-red-500", hover: "opacity-100" });
export const b = on(["dark", "hover"], "bg-black");

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pantry Tracker" },
    {
      name: "description",
      content: "Current food pantry inventory and availability.",
    },
  ];
}

export default function Home() {
  return <main className="pantry-canvas" />;
}

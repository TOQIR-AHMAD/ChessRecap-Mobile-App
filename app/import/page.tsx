"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Import now lives on the home page. We redirect on the client so this route is
// compatible with the static export used for the mobile build — a server-side
// redirect() isn't emitted into a static export.
export default function ImportPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}

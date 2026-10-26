"use client";

import { useLinkStatus } from "next/link";
import Spinner from "@/components/Spinner";

export default function TabPendingIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span className="ml-1.5 inline-flex align-middle">
      <Spinner />
    </span>
  );
}

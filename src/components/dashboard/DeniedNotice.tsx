"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export default function DeniedNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get("denied") === "1") {
      toast("You don't have permission to access that page.", "error");
      // Clean up the URL
      router.replace("/dashboard");
    }
  }, [searchParams, toast, router]);

  return null;
}

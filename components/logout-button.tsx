"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function LogoutButton({ onClick, disabled, ...props }: React.ComponentProps<typeof Button>) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Uspesno odjavljen nalog.");
          router.replace("/login");
          router.refresh();
        },
        onError: (error) => {
          toast.error(`Neuspesna odjava: ${error.error.message}`);
        },
      },
    });
    setIsPending(false);
  }

  return (
    <Button
      {...props}
      disabled={isPending || disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        void handleLogout();
      }}
    >
      Odjavi se
    </Button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { type AppLanguage } from "@/lib/i18n";

type Props = React.ComponentProps<typeof Button> & {
  language?: AppLanguage;
};

const logoutCopy = {
  sr: {
    label: "Odjavi se",
    success: "Uspesno odjavljen nalog.",
    errorPrefix: "Neuspesna odjava:",
  },
  en: {
    label: "Logout",
    success: "Logged out successfully.",
    errorPrefix: "Logout failed:",
  },
} as const;

export function LogoutButton({ onClick, disabled, language = "sr", ...props }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const copy = logoutCopy[language];

  async function handleLogout() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success(copy.success);
          router.replace("/login");
          router.refresh();
        },
        onError: (error) => {
          toast.error(`${copy.errorPrefix} ${error.error.message}`);
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
      {copy.label}
    </Button>
  );
}

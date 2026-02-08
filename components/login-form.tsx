"use client";

import { toast } from "sonner";
import { RiArrowRightUpLine, RiLockPasswordLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Unesite ispravnu email adresu."),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera."),
});

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    authClient.signIn.email(
      { email: data.email, password: data.password, callbackURL: "/" },
      {
        onSuccess: () => {
          toast.success("Uspesna prijava.");
        },
        onError: (error) => {
          toast.error(error.error.message || "Prijava nije uspela.");
        },
        onResponse: () => {
          form.resetField("password");
        },
      },
    );
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-primary/20 bg-background/85 backdrop-blur">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2">
            <RiLockPasswordLine />
            Prijavi se na svoj nalog
          </CardTitle>
          <CardDescription>
            Unesi svoje podatke i nastavi na kontrolnu tablu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email adresa</FieldLabel>
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="ime@primer.rs"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Lozinka</FieldLabel>
                    </div>
                    <Input
                      aria-invalid={fieldState.invalid}
                      {...field}
                      id="password"
                      type="password"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Field>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Prijavljivanje..." : "Prijavi se"}
                  <RiArrowRightUpLine data-icon="inline-end" />
                </Button>

                <FieldDescription className="text-center">
                  Nemas nalog?{" "}
                  <Link href="/register" className="font-medium underline underline-offset-2">
                    Registruj se
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthCardProps = {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  title: string;
  contentClassName?: string;
} & ComponentPropsWithoutRef<typeof Card>;

export function AuthCard({
  children,
  className,
  description,
  footer,
  title,
  contentClassName,
  ...cardProps
}: AuthCardProps) {
  return (
    <Card className={cn("flex flex-col gap-6", className)} {...cardProps}>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

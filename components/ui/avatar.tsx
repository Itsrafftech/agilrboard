import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  email,
  image,
  className,
  size = "sm",
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClasses = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
  }[size];

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={name ?? email ?? "avatar"}
        className={cn("shrink-0 rounded-full object-cover", sizeClasses, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700",
        sizeClasses,
        className
      )}
      title={name ?? email ?? undefined}
    >
      {initials(name, email)}
    </div>
  );
}

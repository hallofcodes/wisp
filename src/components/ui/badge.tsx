import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[#FF5A1F] text-[#FFFFFF] [a]:hover:bg-[#E04812]",
        secondary:
          "border-[#E5E5E5] bg-[#F5F5F5] text-[#525252] [a]:hover:bg-[#EBEBEB]",
        destructive:
          "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] focus-visible:ring-destructive/20 [a]:hover:bg-[#FEE2E2]",
        outline:
          "border-[#D4D4D4] bg-[#FFFFFF] text-[#171717] [a]:hover:bg-[#F5F5F5]",
        ghost: "hover:bg-[#F5F5F5] hover:text-[#171717]",
        link: "text-[#C23B0A] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
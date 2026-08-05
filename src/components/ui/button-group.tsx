import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const buttonGroupVariants = cva(
  'inline-flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 ' +
    '[&>:first-child_button]:rounded-l-[calc(var(--radius)-1px)] ' +
    '[&>:last-child_button]:rounded-r-[calc(var(--radius)-1px)]',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        outline: 'rounded-md border border-input bg-transparent',
      },
      orientation: {
        horizontal: '',
        vertical:
          'flex-col [&>:first-child_button]:rounded-l-none [&>:first-child_button]:rounded-t-[calc(var(--radius)-1px)] [&>:last-child_button]:rounded-r-none [&>:last-child_button]:rounded-b-[calc(var(--radius)-1px)]',
      },
    },
    defaultVariants: {
      variant: 'outline',
      orientation: 'horizontal',
    },
  }
)

function ButtonGroup({
  className,
  variant,
  orientation,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation ?? 'horizontal'}
      className={cn(buttonGroupVariants({ variant, orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      className={cn(
        'bg-muted shadow-xs flex items-center gap-2 rounded-md border px-4 text-sm font-medium [&_svg:not([class*=\'size-\'])]:size-4 [&_svg]:pointer-events-none',
        className
      )}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        'relative !m-0 self-stretch bg-input data-[orientation=vertical]:h-auto data-[orientation=vertical]:w-px',
        className
      )}
      {...props}
    />
  )
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
}

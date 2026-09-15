import { Toast } from '@base-ui/react/toast'

export function UndoToast() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="flex min-h-11 translate-y-0 items-center gap-3 rounded-full bg-foreground py-1 pl-4 pr-1 text-body-sm font-medium text-background opacity-100 transition-[opacity,translate] duration-500 ease-spring motion-reduce:translate-y-0 motion-reduce:transition-[opacity] motion-reduce:duration-200 data-ending-style:translate-y-3 data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:translate-y-3 data-starting-style:opacity-0"
          >
            <Toast.Content className="flex items-center gap-3">
              <Toast.Title />
              {toast.actionProps ? (
                <Toast.Action className="min-h-target rounded-full border-l border-background/20 pl-3 pr-3 font-semibold text-background hover:bg-background/10" />
              ) : null}
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

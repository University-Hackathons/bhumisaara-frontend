"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl transition data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-3" />}>
          <X /><span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("space-y-2 pr-8", className)} {...props} />;
const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
const DialogTitle = ({ className, ...props }: DialogPrimitive.Title.Props) => <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
const DialogDescription = ({ className, ...props }: DialogPrimitive.Description.Props) => <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };

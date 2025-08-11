import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { moduleCategories, orderedGroupTitles, NavItem } from "@/lib/navigation";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GroupKey = typeof orderedGroupTitles[number]["key"];

function getDefaultOrder(): Record<GroupKey, string[]> {
  return {
    daily: moduleCategories.daily.map((i) => i.path),
    share: moduleCategories.share.map((i) => i.path),
    homelab: moduleCategories.homelab.map((i) => i.path),
    account: moduleCategories.account.map((i) => i.path),
  };
}

function deriveOrderedItems(
  groupKey: GroupKey,
  orderMap: Partial<Record<string, string[]>>
): NavItem[] {
  const base = moduleCategories[groupKey];
  const order = orderMap[groupKey] ?? [];
  if (!order.length) return base;
  const pathToItem = new Map(base.map((i) => [i.path, i] as const));
  const seen = new Set<string>();
  const orderedExisting = order
    .map((p) => {
      const item = pathToItem.get(p);
      if (item && !seen.has(p)) {
        seen.add(p);
        return item;
      }
      return null;
    })
    .filter(Boolean) as NavItem[];
  const remaining = base.filter((i) => !seen.has(i.path));
  return [...orderedExisting, ...remaining];
}

export const NavigationCustomizeDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { sidebarOrder, setSidebarOrder, resetSidebarOrder } = useSettings();

  const initialOrder: Record<GroupKey, string[]> = useMemo(() => {
    const defaults = getDefaultOrder();
    return {
      daily: (sidebarOrder["daily"] as string[] | undefined) ?? defaults.daily,
      share: (sidebarOrder["share"] as string[] | undefined) ?? defaults.share,
      homelab: (sidebarOrder["homelab"] as string[] | undefined) ?? defaults.homelab,
      account: (sidebarOrder["account"] as string[] | undefined) ?? defaults.account,
    };
  }, [sidebarOrder]);

  const [workingOrder, setWorkingOrder] = useState<Record<GroupKey, string[]>>(initialOrder);
  React.useEffect(() => {
    if (open) {
      setWorkingOrder(initialOrder);
    }
  }, [open, initialOrder]);

  const move = (group: GroupKey, index: number, direction: -1 | 1) => {
    setWorkingOrder((prev) => {
      const next = { ...prev };
      const arr = [...next[group]];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      next[group] = arr;
      return next;
    });
  };

  const orderedGroups = orderedGroupTitles.map(({ key, title }) => ({
    key: key as GroupKey,
    title,
    items: deriveOrderedItems(key as GroupKey, workingOrder),
  }));

  const onSave = () => {
    setSidebarOrder(workingOrder);
    onOpenChange(false);
  };

  const onReset = () => {
    const defaults = getDefaultOrder();
    setWorkingOrder(defaults);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize Navigation</DialogTitle>
          <DialogDescription>Reorder sidebar items and choose your default page.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Sidebar order</div>
              <Button variant="secondary" size="sm" onClick={onReset}>Reset order</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orderedGroups.map((group) => (
                <div key={group.key} className="rounded-md border">
                  <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
                    {group.title}
                  </div>
                  <ul className="divide-y">
                    {group.items.map((item, idx) => (
                      <li key={item.path} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7", idx === 0 && "opacity-50 pointer-events-none")}
                            onClick={() => move(group.key, idx, -1)}
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7", idx === group.items.length - 1 && "opacity-50 pointer-events-none")}
                            onClick={() => move(group.key, idx, 1)}
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NavigationCustomizeDialog;



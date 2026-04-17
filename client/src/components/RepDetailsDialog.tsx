import { useEffect, useRef, useState } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientTerritory } from "@/pages/home";

interface ColorOption {
  name: string;
  value: string;
}

interface RepDetailsDialogProps {
  territory: ClientTerritory;
  colors: ColorOption[];
  /** Colors already used by OTHER territories (excluded: the one being edited) */
  usedColors: Set<string>;
  onSave: (
    updates: Partial<
      Pick<ClientTerritory, "name" | "title" | "phone" | "email" | "color">
    >
  ) => void;
  onClose: () => void;
}

/**
 * Simple modal for editing a rep's details (name, title, phone, email).
 * Closes on Escape or backdrop click.
 */
export default function RepDetailsDialog({
  territory,
  colors,
  usedColors,
  onSave,
  onClose,
}: RepDetailsDialogProps) {
  const [name, setName] = useState(territory.name);
  const [title, setTitle] = useState(territory.title ?? "");
  const [phone, setPhone] = useState(territory.phone ?? "");
  const [email, setEmail] = useState(territory.email ?? "");
  const [color, setColor] = useState(territory.color);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first field on mount
  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      title: title.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      color,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="rep-details-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rep-details-title"
    >
      <div
        className="bg-card rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Branded header bar */}
        <div
          className="px-4 py-3 flex items-center justify-between text-white"
          style={{ backgroundColor: "hsl(var(--brand-teal))" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-white/25 transition-colors"
              style={{ backgroundColor: color }}
            />
            <h2
              id="rep-details-title"
              className="text-sm font-semibold tracking-wide truncate"
            >
              Edit Rep Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              ref={firstInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rep name"
              data-testid="rep-name-input"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Regional Sales Manager"
              data-testid="rep-title-input"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Color
            </label>
            <div className="flex flex-wrap gap-1.5" data-testid="rep-color-picker">
              {colors.map((c) => {
                const isUsedByOther = usedColors.has(c.value) && c.value !== territory.color;
                const isSelected = color === c.value;
                return (
                  <div key={c.value} className="relative w-6 h-6 flex items-center justify-center">
                    <button
                      type="button"
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        isSelected
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      } ${isUsedByOther ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ backgroundColor: c.value }}
                      disabled={isUsedByOther}
                      title={isUsedByOther ? `${c.name} (already used)` : c.name}
                      onClick={() => setColor(c.value)}
                      data-testid={`rep-color-${c.name.toLowerCase()}`}
                    />
                    {isUsedByOther && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-1/2 w-[22px] h-[2px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Phone
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                data-testid="rep-phone-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rep@company.com"
                data-testid="rep-email-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="rep-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              data-testid="rep-save-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

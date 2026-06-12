import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle,
  ClipboardList,
  FileText,
  Map,
  PackageCheck,
  PartyPopper,
  ShieldCheck,
  Warehouse,
} from "lucide-react";

import {
  logDeliveryAttempt,
  uploadDeliveryAttemptPhoto,
} from "../lib/driverData";
import type { DriverDeliveryItem, DriverDeliveryStop, DriverProfile } from "../lib/types";
import { ActionBar, Button, ConfirmDialog, ErrorState, Textarea } from "./ui";

type WorkflowStep =
  | "warehouse"
  | "items"
  | "drive"
  | "id-check"
  | "id-photo"
  | "signature"
  | "invoice-photo"
  | "handoff"
  | "complete";

type PhotoStep = Extract<WorkflowStep, "id-photo" | "invoice-photo">;

const invoiceSlipId = "invoice-slip";

export function DeliveryWorkflowScreen({
  order,
  profile,
  onReturnToRoute,
}: {
  order: DriverDeliveryStop;
  profile: DriverProfile;
  onReturnToRoute: () => void;
}) {
  const requiresWarehouse = order.items.some(
    (item) => item.inventoryLocation === "warehouse",
  );
  const workflowOrderKey = order.medusaOrderId || order.orderId;
  const workflowStorageKey = `bayblaze-driver-workflow:${profile.uid}:${workflowOrderKey}`;
  const savedWorkflow = readSavedWorkflow(workflowStorageKey);
  const [step, setStep] = useState<WorkflowStep>(
    savedWorkflow?.step ?? (requiresWarehouse ? "warehouse" : "items"),
  );
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    savedWorkflow?.checkedItems ?? {},
  );
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  const [idChecks, setIdChecks] = useState(
    savedWorkflow?.idChecks ?? {
      over21: false,
      unexpired: false,
      photoMatches: false,
    },
  );
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [photoAttempt, setPhotoAttempt] = useState<File | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [error, setError] = useState("");

  const boxChecklist = useMemo(
    () => [
      ...order.items.map((item) => item.id),
      invoiceSlipId,
    ],
    [order.items],
  );
  const allItemsChecked = boxChecklist.every((itemId) => checkedItems[itemId]);
  const allIdChecksPassed = Object.values(idChecks).every(Boolean);
  const currentPhotoTitle =
    step === "id-photo" ? "Take Photo" : "Take Photo of Merchant Invoice";
  const currentPhotoCopy =
    step === "id-photo"
      ? "Please take a clear photo of the customers ID. Please make sure the photo isn't blurry and has all 4 corners of the ID showing."
      : "Please take a clear photo of the signed merchant invoice. Please make sure the photo isn't blurry and the full invoice is visible.";

  useEffect(() => {
    writeSavedWorkflow(workflowStorageKey, {
      checkedItems,
      idChecks,
      step,
    });
  }, [checkedItems, idChecks, step, workflowStorageKey]);

  function openMaps(address: string) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function logAndAdvance(nextStep: WorkflowStep, type?: "warehouse_arrival" | "out_for_delivery" | "customer_arrival" | "completed") {
    setSavingEvent(true);
    setError("");

    try {
      if (type) {
        await logDeliveryAttempt({
          orderId: order.medusaOrderId || order.orderId,
          type,
        });
      }
      if (nextStep === "complete") {
        clearSavedWorkflow(workflowStorageKey);
      }
      setStep(nextStep);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delivery log failed.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleCancelOrder() {
    if (!showCancelReason) {
      setShowCancelReason(true);
      return;
    }

    if (!cancelReason.trim()) {
      setError("Add a cancellation reason before cancelling the order.");
      return;
    }

    setSavingEvent(true);
    setError("");

    try {
      await logDeliveryAttempt({
        orderId: order.medusaOrderId || order.orderId,
        type: "cancelled",
        note: cancelReason,
      });
      clearSavedWorkflow(workflowStorageKey);
      onReturnToRoute();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cancellation log failed.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function acceptPhoto(photoStep: PhotoStep) {
    if (!photoAttempt) {
      setError("Take or choose a photo before continuing.");
      return;
    }

    setSavingPhoto(true);
    setError("");

    try {
      await uploadDeliveryAttemptPhoto({
        orderId: order.medusaOrderId || order.orderId,
        type: photoStep === "id-photo" ? "id_photo" : "merchant_invoice_photo",
        photoFile: photoAttempt,
      });
      setPhotoAttempt(null);
      setStep(photoStep === "id-photo" ? "signature" : "handoff");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo log failed.");
    } finally {
      setSavingPhoto(false);
    }
  }

  if (step === "complete") {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
        <div className="confetti-burst" aria-hidden="true" />
        <PartyPopper className="size-14 text-[var(--bayblaze-green)]" />
        <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          You successfully completed this order. Good Job!
        </h2>
        <Button className="mt-8" fullWidth onClick={onReturnToRoute}>
          Return to Delivery Route
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <button
        type="button"
        className="flex w-fit items-center gap-2 text-sm font-black text-[var(--bayblaze-green-dark)]"
        onClick={onReturnToRoute}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Route
      </button>

      {step === "warehouse" ? (
        <StepShell icon={<Warehouse size={25} />} title="Warehouse Pickup">
          <p className="text-base font-semibold leading-7 text-[var(--bayblaze-muted)]">
            This order contains products not in your vehicle. Please drive back to the
            warehouse to complete the order.
          </p>
          <OpenMapsButton onClick={() => openMaps("BayBlaze warehouse Tampa FL")} />
          <PrimaryButton
            loading={savingEvent}
            onClick={() => void logAndAdvance("items", "warehouse_arrival")}
          >
            I'm Here
          </PrimaryButton>
        </StepShell>
      ) : null}

      {step === "items" ? (
        <StepShell icon={<PackageCheck size={25} />} title="Add Items to Box">
          <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
            {order.items.map((item) => (
              <OrderItemRow
                checked={Boolean(checkedItems[item.id])}
                item={item}
                key={item.id}
                onClick={() => setConfirmingItemId(item.id)}
              />
            ))}
            <ChecklistRow
              checked={Boolean(checkedItems[invoiceSlipId])}
              icon={<FileText size={18} aria-hidden="true" />}
              label="Add Invoice Slip"
              onClick={() =>
                setCheckedItems((current) => ({
                  ...current,
                  [invoiceSlipId]: !current[invoiceSlipId],
                }))
              }
            />
          </div>
          <PrimaryButton
            disabled={!allItemsChecked}
            loading={savingEvent}
            onClick={() => void logAndAdvance("drive", "out_for_delivery")}
          >
            Next
          </PrimaryButton>
        </StepShell>
      ) : null}

      {step === "drive" ? (
        <StepShell icon={<Map size={25} />} title="Drive to the customer">
          <p className="text-base font-semibold leading-7 text-[var(--bayblaze-muted)]">
            {order.customerName} - {order.customerAddress}
          </p>
          <OpenMapsButton onClick={() => openMaps(order.customerAddress)} />
          <PrimaryButton
            loading={savingEvent}
            onClick={() => void logAndAdvance("id-check", "customer_arrival")}
          >
            I'm Here
          </PrimaryButton>
        </StepShell>
      ) : null}

      {step === "id-check" ? (
        <StepShell icon={<ShieldCheck size={25} />} title="Check Customer's ID">
          <p className="text-sm font-semibold leading-6 text-[var(--bayblaze-muted)]">
            Please politely ask the customer for their ID. Check off this checklist to
            ensure the ID is valid.
          </p>
          <div className="grid gap-3">
            <ChecklistRow
              checked={idChecks.over21}
              label="Customer Over 21?"
              onClick={() =>
                setIdChecks((current) => ({ ...current, over21: !current.over21 }))
              }
            />
            <ChecklistRow
              checked={idChecks.unexpired}
              label="ID Unexpired?"
              onClick={() =>
                setIdChecks((current) => ({
                  ...current,
                  unexpired: !current.unexpired,
                }))
              }
            />
            <ChecklistRow
              checked={idChecks.photoMatches}
              label="ID Photo Matches Customer?"
              onClick={() =>
                setIdChecks((current) => ({
                  ...current,
                  photoMatches: !current.photoMatches,
                }))
              }
            />
          </div>
          {showCancelReason ? (
            <Textarea
              className="[&>textarea]:min-h-24 [&>textarea]:border-[var(--bb-danger-soft)] [&>textarea]:bg-[var(--bb-danger-soft)] [&>textarea]:text-[var(--bb-danger-strong)]"
              placeholder="Cancellation reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          ) : null}
          <ActionBar>
            <Button
              disabled={!allIdChecksPassed}
              onClick={() => setStep("id-photo")}
              size="sm"
            >
              Take Photo
            </Button>
            <Button
              onClick={() => void handleCancelOrder()}
              size="sm"
              variant="danger"
            >
              {showCancelReason ? "Submit Cancel" : "Cancel Order"}
            </Button>
          </ActionBar>
        </StepShell>
      ) : null}

      {step === "id-photo" || step === "invoice-photo" ? (
        <PhotoStepCard
          copy={currentPhotoCopy}
          file={photoAttempt}
          loading={savingPhoto}
          title={currentPhotoTitle}
          onAccept={() => void acceptPhoto(step)}
          onPhotoChange={(file) => setPhotoAttempt(file)}
        />
      ) : null}

      {step === "signature" ? (
        <StepShell
          icon={<ClipboardList size={25} />}
          title="Have Customer Sign Merchant Invoice"
        >
          <PrimaryButton onClick={() => setStep("invoice-photo")}>
            Customer Signed
          </PrimaryButton>
        </StepShell>
      ) : null}

      {step === "handoff" ? (
        <StepShell
          icon={<CheckCircle size={25} />}
          title="Hand off Package and Complete Order"
        >
          <PrimaryButton
            loading={savingEvent}
            onClick={() => void logAndAdvance("complete", "completed")}
          >
            Order is Complete
          </PrimaryButton>
        </StepShell>
      ) : null}

      {error ? (
        <ErrorState>{error}</ErrorState>
      ) : null}

      {confirmingItemId ? (
        <ConfirmationDialog
          item={order.items.find((item) => item.id === confirmingItemId)}
          onCancel={() => setConfirmingItemId(null)}
          onConfirm={() => {
            setCheckedItems((current) => ({ ...current, [confirmingItemId]: true }));
            setConfirmingItemId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StepShell({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
          {icon}
        </span>
        <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function OpenMapsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button fullWidth onClick={onClick} variant="secondary">
      <Map size={20} aria-hidden="true" />
      Open Maps
    </Button>
  );
}

function PrimaryButton({
  children,
  disabled,
  loading,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="mt-auto"
      disabled={disabled}
      fullWidth
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ChecklistRow({
  checked,
  icon,
  label,
  onClick,
}: {
  checked: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-[22px] border border-[var(--bayblaze-line)] bg-white p-4 text-left shadow-sm"
      onClick={onClick}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full border ${
          checked
            ? "border-[var(--bayblaze-green)] bg-[var(--bayblaze-green)] text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        <Check size={17} aria-hidden="true" />
      </span>
      {icon ? (
        <span className="shrink-0 text-[var(--bayblaze-green-dark)]">{icon}</span>
      ) : null}
      <span className="min-w-0 text-base font-black text-[var(--bayblaze-ink)]">
        {label}
      </span>
    </button>
  );
}

function OrderItemRow({
  checked,
  item,
  onClick,
}: {
  checked: boolean;
  item: DriverDeliveryItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-[22px] border border-[var(--bayblaze-line)] bg-white p-3 text-left shadow-sm"
      onClick={onClick}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full border ${
          checked
            ? "border-[var(--bayblaze-green)] bg-[var(--bayblaze-green)] text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        <Check size={17} aria-hidden="true" />
      </span>
      <img
        src={item.imageUrl}
        alt=""
        className="size-14 shrink-0 rounded-2xl object-cover"
      />
      <span className="min-w-0">
        <span className="block truncate text-base font-black text-[var(--bayblaze-ink)]">
          {item.name}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-[var(--bayblaze-muted)]">
          {item.variant} / Qty {item.quantity}
        </span>
      </span>
    </button>
  );
}

function ConfirmationDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item?: DriverDeliveryItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) {
    return null;
  }

  return (
    <ConfirmDialog
      body="Confirm you put the right variant and quantity in the box."
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Confirm item"
    >
      <div className="rounded-2xl bg-[var(--bb-surface-warm)] p-4">
        <p className="font-black text-[var(--bb-charcoal)]">{item.name}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--bb-muted)]">
          {item.variant} / Qty {item.quantity}
        </p>
      </div>
    </ConfirmDialog>
  );
}

function PhotoStepCard({
  copy,
  file,
  loading,
  title,
  onAccept,
  onPhotoChange,
}: {
  copy: string;
  file: File | null;
  loading: boolean;
  title: string;
  onAccept: () => void;
  onPhotoChange: (file: File | null) => void;
}) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    onPhotoChange(event.target.files?.[0] ?? null);
  }

  return (
    <StepShell icon={<Camera size={25} />} title={title}>
      <p className="text-sm font-semibold leading-6 text-[var(--bayblaze-muted)]">
        {copy}
      </p>
      <label className="relative grid min-h-64 cursor-pointer place-items-center overflow-hidden rounded-[24px] border border-dashed border-[var(--bayblaze-green)] bg-[var(--bayblaze-cream)] text-center">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <span className="relative z-10 grid size-14 place-items-center rounded-full bg-white text-[var(--bayblaze-green-dark)] shadow-lg">
          <Camera size={25} aria-hidden="true" />
        </span>
        <span className="relative z-10 mt-20 text-sm font-black text-[var(--bayblaze-green-dark)]">
          {file ? "Retake photo" : "Take photo"}
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
        />
      </label>
      <PrimaryButton disabled={!file} loading={loading} onClick={onAccept}>
        Accept Photo
      </PrimaryButton>
    </StepShell>
  );
}


type SavedWorkflowState = {
  step: WorkflowStep;
  checkedItems: Record<string, boolean>;
  idChecks: {
    over21: boolean;
    unexpired: boolean;
    photoMatches: boolean;
  };
};

function readSavedWorkflow(key: string): SavedWorkflowState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SavedWorkflowState>;
    if (
      !parsed.step ||
      parsed.step === "complete" ||
      !parsed.checkedItems ||
      !parsed.idChecks
    ) {
      return null;
    }

    return {
      step: parsed.step,
      checkedItems: parsed.checkedItems,
      idChecks: parsed.idChecks,
    };
  } catch {
    return null;
  }
}

function writeSavedWorkflow(key: string, state: SavedWorkflowState) {
  if (typeof window === "undefined" || state.step === "complete") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(state));
}

function clearSavedWorkflow(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
